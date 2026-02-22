import 'dotenv/config';
import express from 'express';
import { z } from 'zod';

const app = express();
const PORT = Number(process.env.PORT || 8787);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const OPEN_FOOD_FACTS_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

app.use(express.json({ limit: '12mb' }));

const mealSchema = z.object({
  title: z.string().min(1).max(120),
  ingredients: z.array(z.string().min(1).max(80)).max(40),
  calories: z.number().min(0).max(3000),
  protein: z.number().min(0).max(200),
  carbs: z.number().min(0).max(300),
  fat: z.number().min(0).max(150),
  summary: z.string().max(500).optional().default(''),
  allergens: z.array(z.string().min(1).max(80)).max(20).optional().default([]),
});

const verifyResponseSchema = z.object({
  verifiedMeal: mealSchema,
  confidence: z.number().min(0).max(100),
  flags: z.array(z.string().min(1).max(200)).max(20),
});

function cleanJsonText(text) {
  return String(text || '').replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
}

function sanitizeMeal(meal) {
  return {
    title: String(meal.title || 'Mahlzeit').slice(0, 120),
    ingredients: Array.isArray(meal.ingredients)
      ? meal.ingredients.map((item) => String(item).trim()).filter(Boolean).slice(0, 40)
      : [],
    calories: Number.isFinite(Number(meal.calories)) ? Math.max(0, Math.round(Number(meal.calories))) : 0,
    protein: Number.isFinite(Number(meal.protein)) ? Math.max(0, Math.round(Number(meal.protein))) : 0,
    carbs: Number.isFinite(Number(meal.carbs)) ? Math.max(0, Math.round(Number(meal.carbs))) : 0,
    fat: Number.isFinite(Number(meal.fat)) ? Math.max(0, Math.round(Number(meal.fat))) : 0,
    summary: String(meal.summary || ''),
    allergens: Array.isArray(meal.allergens)
      ? meal.allergens.map((item) => String(item).trim()).filter(Boolean).slice(0, 20)
      : [],
  };
}

function runLocalChecks(primaryMeal, verifiedMeal, currentFlags) {
  const flags = [...currentFlags];

  const kcalFromMacrosPrimary = primaryMeal.protein * 4 + primaryMeal.carbs * 4 + primaryMeal.fat * 9;
  const kcalFromMacrosVerified = verifiedMeal.protein * 4 + verifiedMeal.carbs * 4 + verifiedMeal.fat * 9;

  if (primaryMeal.calories > 0) {
    const delta = Math.abs(kcalFromMacrosPrimary - primaryMeal.calories) / primaryMeal.calories;
    if (delta > 0.45) flags.push('Primäranalyse: Kalorien wirken im Verhältnis zu Makros unplausibel.');
  }

  if (verifiedMeal.calories > 0) {
    const delta = Math.abs(kcalFromMacrosVerified - verifiedMeal.calories) / verifiedMeal.calories;
    if (delta > 0.45) flags.push('Gegencheck: Kalorien wirken im Verhältnis zu Makros unplausibel.');
  }

  if (verifiedMeal.ingredients.length === 0) {
    flags.push('Keine Zutaten erkannt. Bitte Mahlzeit manuell prüfen.');
  }

  return [...new Set(flags)];
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function fetchOpenFoodFactsReference(meal) {
  const queryParts = [meal.title, ...(meal.ingredients || []).slice(0, 3)]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  if (queryParts.length === 0) {
    return null;
  }

  const searchTerms = queryParts.join(' ');
  const url = new URL(OPEN_FOOD_FACTS_SEARCH_URL);
  url.searchParams.set('search_terms', searchTerms);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', '8');
  url.searchParams.set('fields', 'product_name,nutriments');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`OpenFoodFacts Fehler: ${response.status}`);
  }

  const data = await response.json();
  const products = Array.isArray(data.products) ? data.products : [];

  const refs = products
    .map((product) => {
      const nutriments = product?.nutriments || {};
      return {
        caloriesPer100g: toFiniteNumber(nutriments['energy-kcal_100g'] ?? nutriments.energy_kcal_100g),
        proteinPer100g: toFiniteNumber(nutriments.proteins_100g),
        carbsPer100g: toFiniteNumber(nutriments.carbohydrates_100g),
        fatPer100g: toFiniteNumber(nutriments.fat_100g),
      };
    })
    .filter((ref) => (
      ref.caloriesPer100g != null
      || ref.proteinPer100g != null
      || ref.carbsPer100g != null
      || ref.fatPer100g != null
    ));

  if (refs.length === 0) {
    return {
      matched: false,
      query: searchTerms,
      sampleSize: 0,
      referencePer100g: null,
      estimatedPortionGrams: 150,
    };
  }

  const avg = (field) => {
    const values = refs.map((row) => row[field]).filter((value) => value != null);
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  return {
    matched: true,
    query: searchTerms,
    sampleSize: refs.length,
    referencePer100g: {
      calories: avg('caloriesPer100g'),
      protein: avg('proteinPer100g'),
      carbs: avg('carbsPer100g'),
      fat: avg('fatPer100g'),
    },
    estimatedPortionGrams: 150,
  };
}

function appendOpenFoodFactsFlags(verifiedMeal, openFoodFacts, currentFlags) {
  if (!openFoodFacts?.matched || !openFoodFacts.referencePer100g) {
    return currentFlags;
  }

  const flags = [...currentFlags];
  const portionFactor = (openFoodFacts.estimatedPortionGrams || 150) / 100;
  const expected = {
    calories: openFoodFacts.referencePer100g.calories != null
      ? openFoodFacts.referencePer100g.calories * portionFactor
      : null,
    protein: openFoodFacts.referencePer100g.protein != null
      ? openFoodFacts.referencePer100g.protein * portionFactor
      : null,
    carbs: openFoodFacts.referencePer100g.carbs != null
      ? openFoodFacts.referencePer100g.carbs * portionFactor
      : null,
    fat: openFoodFacts.referencePer100g.fat != null
      ? openFoodFacts.referencePer100g.fat * portionFactor
      : null,
  };

  const checkField = (field, label, threshold = 0.6) => {
    const expectedValue = expected[field];
    const actualValue = verifiedMeal[field];
    if (expectedValue == null || !Number.isFinite(actualValue) || expectedValue <= 0) return;
    const ratio = Math.abs(actualValue - expectedValue) / expectedValue;
    if (ratio > threshold) {
      flags.push(`OpenFoodFacts: ${label} weicht stark vom Referenzwert ab.`);
    }
  };

  checkField('calories', 'Kalorien');
  checkField('protein', 'Protein');
  checkField('carbs', 'Kohlenhydrate');
  checkField('fat', 'Fett');

  return [...new Set(flags)];
}

async function callGemini(parts, temperature = 0.2) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY ist nicht gesetzt.');
  }

  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API Fehler: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/meals/verify', async (req, res) => {
  const { imageBase64, childContext } = req.body || {};

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'imageBase64 fehlt oder ist ungültig.' });
  }

  const mimeType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
  const imageData = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const allergyText = Array.isArray(childContext?.allergies) && childContext.allergies.length > 0
    ? `Bekannte Allergien/Unverträglichkeiten des Kindes: ${childContext.allergies.join(', ')}.`
    : 'Keine bekannten Allergien übergeben.';

  const primaryPrompt = `Du bist Ernährungsexperte für Kleinkinder. Analysiere das Mahlzeitenfoto.
${allergyText}

Gib NUR JSON ohne Markdown zurück:
{
  "title": "Bezeichnung der Mahlzeit",
  "ingredients": ["Zutat1", "Zutat2"],
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "summary": "Kurze Bewertung in 1 Satz",
  "allergens": ["nur erkannte Allergene"]
}`;

  try {
    const primaryRaw = await callGemini([
      { text: primaryPrompt },
      { inline_data: { mime_type: mimeType, data: imageData } },
    ], 0.2);

    const primaryParsed = JSON.parse(cleanJsonText(primaryRaw));
    const primaryMeal = mealSchema.parse(sanitizeMeal(primaryParsed));

    const verifyPrompt = `Du bist ein strenger Qualitätsprüfer für Ernährungsdaten.
Prüfe die Primäranalyse auf Plausibilität und korrigiere nur bei klaren Widersprüchen.

Primäranalyse:
${JSON.stringify(primaryMeal)}

Antworte NUR als JSON ohne Markdown:
{
  "verifiedMeal": {
    "title": "...",
    "ingredients": ["..."],
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0,
    "summary": "...",
    "allergens": ["..."]
  },
  "confidence": 0,
  "flags": ["Liste konkreter Prüfhinweise"]
}`;

    const verifyRaw = await callGemini([{ text: verifyPrompt }], 0.1);
    const verifyParsed = JSON.parse(cleanJsonText(verifyRaw));
    const verifyResult = verifyResponseSchema.parse({
      ...verifyParsed,
      verifiedMeal: sanitizeMeal(verifyParsed.verifiedMeal),
    });

    const localFlags = runLocalChecks(primaryMeal, verifyResult.verifiedMeal, verifyResult.flags || []);

    let openFoodFacts = null;
    let flags = localFlags;

    try {
      openFoodFacts = await fetchOpenFoodFactsReference(verifyResult.verifiedMeal);
      flags = appendOpenFoodFactsFlags(verifyResult.verifiedMeal, openFoodFacts, localFlags);
    } catch (offErr) {
      flags = [...new Set([...localFlags, 'OpenFoodFacts-Check konnte nicht durchgeführt werden.'])];
      openFoodFacts = {
        matched: false,
        query: verifyResult.verifiedMeal.title,
        sampleSize: 0,
        referencePer100g: null,
        estimatedPortionGrams: 150,
        error: offErr.message,
      };
    }

    return res.json({
      analysis: primaryMeal,
      corrected: verifyResult.verifiedMeal,
      confidence: verifyResult.confidence,
      flags,
      openFoodFacts,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Analyse fehlgeschlagen.' });
  }
});

app.listen(PORT, () => {
  console.log(`HabEat API läuft auf Port ${PORT}`);
});
