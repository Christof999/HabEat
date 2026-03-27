import 'dotenv/config';
import express from 'express';
import { z } from 'zod';

const app = express();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const OPEN_FOOD_FACTS_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
/** Open Food Facts verlangt einen erkennbaren User-Agent (sonst oft 403/Block). */
const OPEN_FOOD_FACTS_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'HabEat/1.0 (https://github.com/Christof999/HabEat; meal-tracking; de)',
};
const OFF_FETCH_TIMEOUT_MS = 18_000;

/** Makro-Kalorien-Abweichung: Flag ab diesem Anteil, schärferer Hinweis darüber */
const MACRO_KCAL_TOLERANCE = 0.35;
const MACRO_KCAL_SEVERE = 0.55;
const OFF_FIELD_THRESHOLD = 0.55;
const API_PROMPT_VERSION = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.use(express.json({ limit: '12mb' }));

// Vercel Serverless: Anfrage ggf. /meals/verify statt /api/meals/verify
if (process.env.VERCEL) {
  app.use((req, _res, next) => {
    if (typeof req.url === 'string' && req.url.length > 0 && !req.url.startsWith('/api')) {
      req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
    }
    next();
  });
}

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
    if (delta > MACRO_KCAL_SEVERE) {
      flags.push('Primäranalyse: starke Diskrepanz zwischen Kalorien und Makros (bitte prüfen).');
    } else if (delta > MACRO_KCAL_TOLERANCE) {
      flags.push('Primäranalyse: Kalorien und Makros passen nur bedingt zusammen.');
    }
  }

  if (verifiedMeal.calories > 0) {
    const delta = Math.abs(kcalFromMacrosVerified - verifiedMeal.calories) / verifiedMeal.calories;
    if (delta > MACRO_KCAL_SEVERE) {
      flags.push('Gegencheck: starke Diskrepanz zwischen Kalorien und Makros (bitte prüfen).');
    } else if (delta > MACRO_KCAL_TOLERANCE) {
      flags.push('Gegencheck: Kalorien und Makros passen nur bedingt zusammen.');
    }
  }

  if (verifiedMeal.calories === 0
    && (verifiedMeal.protein > 0 || verifiedMeal.carbs > 0 || verifiedMeal.fat > 5)) {
    flags.push('Kalorien fehlen, Makros sind gesetzt – Angaben bitte prüfen.');
  }

  if (verifiedMeal.ingredients.length === 0) {
    flags.push('Keine Zutaten erkannt. Bitte Mahlzeit manuell prüfen.');
  }

  return [...new Set(flags)];
}

function adjustConfidenceForFlags(confidence, flags) {
  let c = Number.isFinite(Number(confidence)) ? Number(confidence) : 72;
  const joined = flags.join(' | ');
  if (joined.includes('Primäranalyse: starke Diskrepanz')) c -= 10;
  else if (joined.includes('Primäranalyse: Kalorien und Makros')) c -= 5;
  if (joined.includes('Gegencheck: starke Diskrepanz')) c -= 12;
  else if (joined.includes('Gegencheck: Kalorien und Makros')) c -= 6;
  if (joined.includes('OpenFoodFacts:')) c -= 4;
  if (joined.includes('Keine Zutaten erkannt')) c -= 14;
  if (joined.includes('Kalorien fehlen')) c -= 8;
  return Math.max(0, Math.min(100, Math.round(c)));
}

/** Portionsannahme (g) aus Freitext, z. B. „200 g“, „halber Teller“ */
function extractEstimatedPortionGrams(adultMode, ...textParts) {
  const text = textParts.filter(Boolean).join(' ').toLowerCase();
  let base = adultMode ? 300 : 150;
  let explicit = null;

  const gMatch = text.match(/(\d+)\s*(g|gramm)\b/i);
  if (gMatch) {
    explicit = Math.min(900, Math.max(40, parseInt(gMatch[1], 10)));
  }

  const mlMatch = text.match(/(\d+)\s*ml\b/i);
  if (mlMatch && explicit == null) {
    explicit = Math.min(700, Math.max(50, parseInt(mlMatch[1], 10)));
  }

  if (explicit != null) return explicit;

  if (/halbe(r|n)?\s+teller|\bhalf\s+plate\b/i.test(text)) base *= 0.65;
  if (/ganze(r|n)?\s+teller|voller\s+teller|ganze\s+portion/i.test(text)) base *= 1.12;
  if (/kleine\s+portion|\bwenig\b/i.test(text)) base *= 0.82;
  if (/gro(ß|ss)e\s+portion|\bviel\b|zweite\s+portion/i.test(text)) base *= 1.22;

  return Math.round(Math.min(650, Math.max(50, base)));
}

function buildOffSearchQueries(meal) {
  const title = String(meal.title || '').trim();
  const ings = (meal.ingredients || []).map((i) => String(i).trim()).filter(Boolean);
  const out = [];
  const full = [title, ...ings.slice(0, 3)].filter(Boolean).join(' ');
  if (full) out.push(full);
  if (title) out.push(title);
  if (title && ings[0]) out.push(`${title} ${ings[0]}`);
  if (ings.length >= 2) out.push(`${ings[0]} ${ings[1]}`);
  if (ings[0] && ings[0].length > 2) out.push(ings[0]);
  return [...new Set(out.map((q) => q.slice(0, 120).trim()).filter(Boolean))].slice(0, 5);
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function fetchOffJsonWithRetry(urlString) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await sleep(400 * attempt);
    try {
      const response = await fetch(urlString, {
        headers: OPEN_FOOD_FACTS_HEADERS,
        signal: AbortSignal.timeout(OFF_FETCH_TIMEOUT_MS),
      });
      if (response.ok) return response.json();
      if ([408, 429, 500, 502, 503, 504].includes(response.status) && attempt < 2) {
        lastErr = new Error(`OpenFoodFacts Fehler: ${response.status}`);
        continue;
      }
      throw new Error(`OpenFoodFacts Fehler: ${response.status}`);
    } catch (err) {
      lastErr = err;
      const m = String(err?.message || '');
      const name = err?.name || '';
      const retryable = name === 'AbortError'
        || name === 'TimeoutError'
        || m.includes('fetch')
        || m.includes('network')
        || m.includes('OpenFoodFacts Fehler: 408')
        || m.includes('OpenFoodFacts Fehler: 429')
        || m.includes('OpenFoodFacts Fehler: 500')
        || m.includes('OpenFoodFacts Fehler: 502')
        || m.includes('OpenFoodFacts Fehler: 503')
        || m.includes('OpenFoodFacts Fehler: 504');
      if (attempt < 2 && retryable) continue;
      throw err;
    }
  }
  throw lastErr;
}

function productsToNutrientRefs(products) {
  return products
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
}

async function fetchOpenFoodFactsReference(meal, options = {}) {
  const estimatedPortionGrams = Number.isFinite(Number(options.estimatedPortionGrams))
    ? Math.max(50, Math.round(Number(options.estimatedPortionGrams)))
    : 150;

  const queries = buildOffSearchQueries(meal);
  const queriesAttempted = [];

  if (queries.length === 0) {
    return {
      matched: false,
      query: '',
      sampleSize: 0,
      referencePer100g: null,
      estimatedPortionGrams,
      queriesAttempted,
    };
  }

  let bestRefs = [];
  let bestQuery = queries[0];

  for (const searchTerms of queries) {
    queriesAttempted.push(searchTerms);
    const url = new URL(OPEN_FOOD_FACTS_SEARCH_URL);
    url.searchParams.set('search_terms', searchTerms);
    url.searchParams.set('search_simple', '1');
    url.searchParams.set('action', 'process');
    url.searchParams.set('json', '1');
    url.searchParams.set('page_size', '10');
    url.searchParams.set('fields', 'product_name,nutriments');

    const data = await fetchOffJsonWithRetry(url.toString());
    const products = Array.isArray(data.products) ? data.products : [];
    const refs = productsToNutrientRefs(products);

    if (refs.length > bestRefs.length) {
      bestRefs = refs;
      bestQuery = searchTerms;
    }
    if (refs.length >= 8) break;
  }

  if (bestRefs.length === 0) {
    return {
      matched: false,
      query: bestQuery,
      sampleSize: 0,
      referencePer100g: null,
      estimatedPortionGrams,
      queriesAttempted,
    };
  }

  const avg = (field) => {
    const values = bestRefs.map((row) => row[field]).filter((value) => value != null);
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  return {
    matched: true,
    query: bestQuery,
    sampleSize: bestRefs.length,
    referencePer100g: {
      calories: avg('caloriesPer100g'),
      protein: avg('proteinPer100g'),
      carbs: avg('carbsPer100g'),
      fat: avg('fatPer100g'),
    },
    estimatedPortionGrams,
    queriesAttempted,
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

  const checkField = (field, label, threshold = OFF_FIELD_THRESHOLD) => {
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

async function callGemini(parts, temperature = 0.2, jsonMode = false) {
  const apiKey = String(GEMINI_API_KEY || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '');

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY ist nicht gesetzt.');
  }

  const geminiUrl = new URL(GEMINI_URL);
  geminiUrl.searchParams.set('key', apiKey);

  const generationConfig = {
    temperature,
    maxOutputTokens: 2048,
  };
  if (jsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }

  let response;
  try {
    response = await fetch(geminiUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig,
      }),
    });
  } catch (err) {
    const e = new Error(`Gemini Request fehlgeschlagen: ${err.message}`);
    e.statusCode = 0;
    throw e;
  }

  if (!response.ok) {
    const e = new Error(`Gemini API Fehler: ${response.status}`);
    e.statusCode = response.status;
    throw e;
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function isGeminiRetryableError(err) {
  const code = err?.statusCode;
  if (code === 429 || code === 502 || code === 503 || code === 504) return true;
  if (code === 0 || String(err?.message || '').includes('fehlgeschlagen')) return true;
  return false;
}

async function callGeminiWithRetry(parts, temperature = 0.2, jsonMode = false) {
  const backoffMs = [0, 500, 1600];
  let lastErr;
  for (let i = 0; i < backoffMs.length; i += 1) {
    if (backoffMs[i] > 0) await sleep(backoffMs[i]);
    try {
      const text = await callGemini(parts, temperature, jsonMode);
      if (String(text || '').trim()) return text;
      lastErr = new Error('Leere Gemini-Antwort');
      lastErr.statusCode = 204;
    } catch (err) {
      lastErr = err;
      if (i < backoffMs.length - 1 && isGeminiRetryableError(err)) continue;
      throw err;
    }
  }
  throw lastErr;
}

function buildAllergyText(childContext, adultMode) {
  if (Array.isArray(childContext?.allergies) && childContext.allergies.length > 0) {
    return adultMode
      ? `Bekannte Allergien/Unverträglichkeiten: ${childContext.allergies.join(', ')}.`
      : `Bekannte Allergien/Unverträglichkeiten des Kindes: ${childContext.allergies.join(', ')}.`;
  }
  return 'Keine bekannten Allergien übergeben.';
}

function parseGeminiMealJson(raw) {
  const s = String(raw || '').trim();
  const primaryParsed = JSON.parse(s.startsWith('{') ? s : cleanJsonText(raw));
  return mealSchema.parse(sanitizeMeal(primaryParsed));
}

function parseGeminiVerifyJson(raw) {
  const s = String(raw || '').trim();
  const parsed = JSON.parse(s.startsWith('{') ? s : cleanJsonText(raw));
  return verifyResponseSchema.parse({
    ...parsed,
    verifiedMeal: sanitizeMeal(parsed.verifiedMeal),
  });
}

/** Text-only Mahlzeit-JSON; Fallback ohne responseMimeType wenn die API JSON-Modus ablehnt. */
async function parseMealFromGeminiParts(parts, temperature = 0.2) {
  try {
    const raw = await callGeminiWithRetry(parts, temperature, true);
    return parseGeminiMealJson(raw);
  } catch (err) {
    const m = String(err?.message || '');
    if (m.includes('400') || m.toLowerCase().includes('json')) {
      const raw = await callGeminiWithRetry(parts, temperature, false);
      return parseGeminiMealJson(raw);
    }
    throw err;
  }
}

async function runPostPrimaryPipeline(primaryMeal, adultMode, pipelineOptions = {}) {
  const portionContext = typeof pipelineOptions.portionContext === 'string'
    ? pipelineOptions.portionContext
    : '';
  const portionGrams = extractEstimatedPortionGrams(adultMode, portionContext);

  const verifyPrompt = `Du bist ein strenger Qualitätsprüfer für Ernährungsdaten.
Prüfe die Primäranalyse auf Plausibilität und korrigiere nur bei klaren Widersprüchen.
${adultMode ? 'Kontext: Mahlzeit und Nährwerte für eine erwachsene Portionsgröße (keine Kleinkind-Annahmen, keine Kinder-Referenzkurven).' : ''}

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

  let verifyRaw;
  try {
    verifyRaw = await callGeminiWithRetry([{ text: verifyPrompt }], 0.1, true);
  } catch (err) {
    const m = String(err?.message || '');
    if (m.includes('400') || m.toLowerCase().includes('json')) {
      verifyRaw = await callGeminiWithRetry([{ text: verifyPrompt }], 0.1, false);
    } else {
      throw err;
    }
  }
  const verifyResult = parseGeminiVerifyJson(verifyRaw);

  const localFlags = runLocalChecks(primaryMeal, verifyResult.verifiedMeal, verifyResult.flags || []);

  let openFoodFacts = null;
  let flags = localFlags;

  try {
    openFoodFacts = await fetchOpenFoodFactsReference(verifyResult.verifiedMeal, {
      estimatedPortionGrams: portionGrams,
    });
    flags = appendOpenFoodFactsFlags(verifyResult.verifiedMeal, openFoodFacts, localFlags);
  } catch (offErr) {
    flags = [...new Set([...localFlags, 'OpenFoodFacts-Check konnte nicht durchgeführt werden.'])];
    openFoodFacts = {
      matched: false,
      query: verifyResult.verifiedMeal.title,
      sampleSize: 0,
      referencePer100g: null,
      estimatedPortionGrams: portionGrams,
      error: offErr.message,
      queriesAttempted: [],
    };
  }

  const confidenceAdjusted = adjustConfidenceForFlags(verifyResult.confidence, flags);

  const trace = {
    promptVersion: API_PROMPT_VERSION,
    portionGramsAssumed: openFoodFacts?.estimatedPortionGrams ?? portionGrams,
    offQueriesTried: openFoodFacts?.queriesAttempted?.length ?? 0,
    offQueryUsed: openFoodFacts?.matched ? openFoodFacts.query : null,
  };

  if (process.env.HABEAT_LOG_AI === '1') {
    console.info('[HabEat verify]', trace.promptVersion, 'flags', flags.length, 'confidence', confidenceAdjusted);
  }

  return {
    analysis: primaryMeal,
    corrected: verifyResult.verifiedMeal,
    confidence: confidenceAdjusted,
    flags,
    openFoodFacts,
    checkedAt: new Date().toISOString(),
    trace,
  };
}

function buildImagePrimaryPrompt(allergyText, adultMode) {
  if (adultMode) {
    return `Du bist Ernährungsexperte. Analysiere das Mahlzeitenfoto für eine erwachsene Person: realistische Portionsgröße wie auf dem Foto, keine Anpassung an Kleinkind-Bedarf oder -Portionen, keine altersbezogenen WHO-/Referenzwerte für Kinder.
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
  }
  return `Du bist Ernährungsexperte für Kleinkinder. Analysiere das Mahlzeitenfoto.
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
}

async function runImageAnalysisPipeline(imageBase64, allergyText, adultMode, portionContext = '') {
  const mimeType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
  const imageData = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const primaryPrompt = buildImagePrimaryPrompt(allergyText, adultMode);
  const parts = [
    { text: primaryPrompt },
    { inline_data: { mime_type: mimeType, data: imageData } },
  ];
  let primaryMeal;
  try {
    const primaryRaw = await callGeminiWithRetry(parts, 0.2, true);
    primaryMeal = parseGeminiMealJson(primaryRaw);
  } catch (err) {
    const m = String(err?.message || '');
    if (m.includes('400') || m.toLowerCase().includes('json')) {
      const primaryRaw = await callGeminiWithRetry(parts, 0.2, false);
      primaryMeal = parseGeminiMealJson(primaryRaw);
    } else {
      throw err;
    }
  }
  return runPostPrimaryPipeline(primaryMeal, adultMode, { portionContext });
}

function buildTextPrimaryPrompt(mealDescription, allergyText, adultMode) {
  const intro = adultMode
    ? `Du bist Ernährungsexperte. Der Nutzer beschreibt eine Mahlzeit nur in Textform (kein Foto). Leite daraus ein realistisches Gericht mit sinnvoller Portionsgröße für eine erwachsene Person ab – keine Kleinkind-Portionen, keine WHO-/Kinder-Referenzwerte.`
    : `Du bist Ernährungsexperte für Kleinkinder. Der Nutzer beschreibt eine Mahlzeit nur in Textform (kein Foto). Leite daraus ein realistisches Gericht mit altersgerechter Portionsgröße und Nährwerten ab.`;
  return `${intro}
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
}

Beschreibung der Mahlzeit:
${mealDescription}`;
}

function buildRefinePrompt(previousMeal, userContext, allergyText, adultMode) {
  const intro = adultMode
    ? `Du bist Ernährungsexperte. Überarbeite die folgenden vorläufigen Mahlzeitendaten unter Einbeziehung des Nutzer-Kontexts (Korrekturen, Ergänzungen, Zubereitung, fehlende sichtbare Teile). Portionsgröße und Nährwerte für eine erwachsene Person, keine Kleinkind-Annahmen.`
    : `Du bist Ernährungsexperte für Kleinkinder. Überarbeite die folgenden vorläufigen Mahlzeitendaten unter Einbeziehung des Nutzer-Kontexts (Korrekturen, Ergänzungen, Zubereitung, fehlende sichtbare Teile). Halte Nährwerte und Portionsannahme altersgerecht konsistent.`;
  return `${intro}
${allergyText}

Vorläufige Daten (JSON):
${JSON.stringify(previousMeal)}

Nutzer-Kontext (Ergänzung oder Korrektur):
${JSON.stringify(userContext)}

Gib NUR JSON ohne Markdown zurück – gleiche Struktur wie oben:
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
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/meals/verify', async (req, res) => {
  const {
    imageBase64,
    mealDescription,
    previousMeal,
    userContext,
    childContext,
    adultNutrition,
    portionHints,
  } = req.body || {};
  const adultMode = adultNutrition === true;
  const allergyText = buildAllergyText(childContext, adultMode);
  const hints = typeof portionHints === 'string' ? portionHints.trim().slice(0, 500) : '';

  try {
    const hasRefine = previousMeal != null && typeof previousMeal === 'object'
      && typeof userContext === 'string' && userContext.trim().length >= 3;
    if (hasRefine) {
      const ctx = userContext.trim().slice(0, 2000);
      const base = mealSchema.parse(sanitizeMeal(previousMeal));
      const refinedPrimary = await parseMealFromGeminiParts(
        [{ text: buildRefinePrompt(base, ctx, allergyText, adultMode) }],
        0.2,
      );
      const out = await runPostPrimaryPipeline(refinedPrimary, adultMode, { portionContext: ctx });
      return res.json(out);
    }

    const desc = typeof mealDescription === 'string' ? mealDescription.trim() : '';
    if (desc.length > 0 && !imageBase64) {
      if (desc.length < 10) {
        return res.status(400).json({ error: 'Beschreibung zu kurz (mindestens 10 Zeichen).' });
      }
      const primaryMeal = await parseMealFromGeminiParts(
        [{ text: buildTextPrimaryPrompt(desc.slice(0, 3000), allergyText, adultMode) }],
        0.2,
      );
      const out = await runPostPrimaryPipeline(primaryMeal, adultMode, { portionContext: desc });
      return res.json(out);
    }

    if (imageBase64 && typeof imageBase64 === 'string') {
      const out = await runImageAnalysisPipeline(imageBase64, allergyText, adultMode, hints);
      return res.json(out);
    }

    return res.status(400).json({
      error: 'Bitte ein Foto (imageBase64), eine Textbeschreibung (mealDescription) oder Überarbeitung (previousMeal + userContext) senden.',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Analyse fehlgeschlagen.' });
  }
});

export default app;
