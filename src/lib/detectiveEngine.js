import { analyzeWithGemini } from './gemini';

const IMMEDIATE_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours
const DELAYED_WINDOW_MS = 24 * 60 * 60 * 1000;  // 24 hours
const IMMEDIATE_SCORE = 10;
const DELAYED_SCORE = 5;
const NO_SYMPTOM_PENALTY = -3;

/**
 * Analysiert Korrelationen zwischen Mahlzeiten und Symptomen.
 * Für jedes Symptom werden die Mahlzeiten der letzten 24h geprüft.
 * Jede Zutat bekommt einen Score basierend auf zeitlicher Nähe.
 */
export function analyzeCorrelations(meals, symptoms) {
  if (!meals.length || !symptoms.length) {
    return { suspects: [], insights: [], hasData: false };
  }

  const ingredientStats = {};

  // For each symptom, check meals in the 24h window before
  symptoms.forEach(symptom => {
    const symptomTime = new Date(symptom.timestamp).getTime();
    const mealsInWindow = meals.filter(meal => {
      const mealTime = new Date(meal.timestamp).getTime();
      const diff = symptomTime - mealTime;
      return diff > 0 && diff <= DELAYED_WINDOW_MS;
    });

    const ingredientsInWindow = new Set();

    mealsInWindow.forEach(meal => {
      if (!meal.ingredients) return;
      meal.ingredients.forEach(ingredient => {
        const key = ingredient.toLowerCase().trim();
        ingredientsInWindow.add(key);

        if (!ingredientStats[key]) {
          ingredientStats[key] = {
            name: ingredient,
            totalScore: 0,
            symptomAppearances: 0,
            totalAppearances: 0,
            symptomTypes: {},
            timeProximities: [],
          };
        }

        const mealTime = new Date(meal.timestamp).getTime();
        const timeDiff = symptomTime - mealTime;
        const isImmediate = timeDiff <= IMMEDIATE_WINDOW_MS;

        ingredientStats[key].totalScore += isImmediate ? IMMEDIATE_SCORE : DELAYED_SCORE;
        ingredientStats[key].symptomAppearances++;
        ingredientStats[key].timeProximities.push(timeDiff);

        // Track which symptom types this ingredient correlates with
        const sType = symptom.type;
        if (!ingredientStats[key].symptomTypes[sType]) {
          ingredientStats[key].symptomTypes[sType] = 0;
        }
        ingredientStats[key].symptomTypes[sType]++;
      });
    });
  });

  // Count total appearances of each ingredient (including meals without symptoms)
  meals.forEach(meal => {
    if (!meal.ingredients) return;
    meal.ingredients.forEach(ingredient => {
      const key = ingredient.toLowerCase().trim();
      if (ingredientStats[key]) {
        ingredientStats[key].totalAppearances++;
      }
    });
  });

  // Apply penalty for meals with the ingredient but no following symptom
  Object.keys(ingredientStats).forEach(key => {
    const stats = ingredientStats[key];
    const mealsWithoutSymptom = stats.totalAppearances - stats.symptomAppearances;
    stats.totalScore += mealsWithoutSymptom * NO_SYMPTOM_PENALTY;
    stats.totalScore = Math.max(0, stats.totalScore);

    // Calculate confidence percentage
    stats.confidence = stats.totalAppearances > 0
      ? Math.round((stats.symptomAppearances / stats.totalAppearances) * 100)
      : 0;
  });

  // Sort by score, filter out low-scoring
  const suspects = Object.values(ingredientStats)
    .filter(s => s.totalScore > 0 && s.confidence >= 20)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 10)
    .map(s => ({
      name: s.name,
      score: s.totalScore,
      confidence: Math.min(s.confidence, 99),
      symptomAppearances: s.symptomAppearances,
      totalAppearances: s.totalAppearances,
      primarySymptom: Object.entries(s.symptomTypes)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || null,
      avgTimeDiff: s.timeProximities.length > 0
        ? s.timeProximities.reduce((a, b) => a + b, 0) / s.timeProximities.length
        : 0,
    }));

  // Generate insights
  const insights = generateInsights(suspects, symptoms, meals);

  return { suspects, insights, hasData: true };
}

function generateInsights(suspects, symptoms, meals) {
  const insights = [];

  // Insight: Top suspect pattern
  if (suspects.length > 0 && suspects[0].confidence >= 60) {
    const top = suspects[0];
    const avgHours = Math.round(top.avgTimeDiff / (60 * 60 * 1000));
    const symptomLabel = getSymptomLabel(top.primarySymptom);
    insights.push({
      type: 'warning',
      title: `Auffälligkeit: ${top.name}`,
      text: `In ${top.confidence}% der Fälle trat "${symptomLabel}" ca. ${avgHours}h nach dem Verzehr von ${top.name} auf.`,
    });
  }

  // Insight: Time pattern
  const eveningSymptoms = symptoms.filter(s => {
    const hour = new Date(s.timestamp).getHours();
    return hour >= 20 || hour < 6;
  });
  if (eveningSymptoms.length > symptoms.length * 0.5 && symptoms.length >= 3) {
    insights.push({
      type: 'info',
      title: 'Zeitliches Muster',
      text: 'Die meisten Symptome treten abends oder nachts auf. Achte besonders auf die Abendmahlzeiten.',
    });
  }

  // Insight: Frequency
  if (symptoms.length >= 5) {
    const last7days = symptoms.filter(s => {
      const diff = Date.now() - new Date(s.timestamp).getTime();
      return diff <= 7 * 24 * 60 * 60 * 1000;
    });
    if (last7days.length >= 4) {
      insights.push({
        type: 'alert',
        title: 'Häufige Symptome',
        text: `In den letzten 7 Tagen wurden ${last7days.length} Symptome erfasst. Ein Arztbesuch könnte sinnvoll sein.`,
      });
    }
  }

  return insights;
}

const SYMPTOM_LABELS = {
  skin: 'Hautreaktion',
  digestion: 'Verdauung',
  sleep: 'Schlafstörung',
  mood: 'Stimmung',
  breathing: 'Atmung',
  other: 'Sonstiges',
};

function getSymptomLabel(type) {
  return SYMPTOM_LABELS[type] || type || 'Symptom';
}

/**
 * Schickt die Daten an Gemini für eine intelligente Analyse.
 * @param {{ adultNutrition?: boolean }} [options] — ohne Kleinkind-Fokus (z. B. Thomas/Martina)
 */
export async function analyzeWithAI(meals, symptoms, childName, options = {}) {
  const adult = options.adultNutrition === true;
  const last3Days = 3 * 24 * 60 * 60 * 1000;
  const recentMeals = meals
    .filter(m => Date.now() - new Date(m.timestamp).getTime() <= last3Days)
    .map(m => ({
      time: new Date(m.timestamp).toLocaleString('de-DE'),
      title: m.title,
      ingredients: m.ingredients?.join(', ') || 'unbekannt',
    }));

  const recentSymptoms = symptoms
    .filter(s => Date.now() - new Date(s.timestamp).getTime() <= last3Days)
    .map(s => ({
      time: new Date(s.timestamp).toLocaleString('de-DE'),
      type: getSymptomLabel(s.type),
      severity: s.severity,
      notes: s.notes || '',
    }));

  if (recentMeals.length === 0 || recentSymptoms.length === 0) {
    return null;
  }

  const prompt = adult
    ? `Du bist ein Ernährungsberater-Assistent. Analysiere die folgenden Daten für "${childName}" (Erwachsenen-Kontext: keine Kleinkind-Annahmen, keine WHO-/Perzentil- oder altersbezogenen Kinder-Referenzwerte).

WICHTIG: Du bist KEIN Arzt. Gib keine Diagnosen ab. Formuliere vorsichtige Vermutungen.

Mahlzeiten der letzten 3 Tage:
${JSON.stringify(recentMeals, null, 2)}

Symptome der letzten 3 Tage:
${JSON.stringify(recentSymptoms, null, 2)}

Analysiere:
1. Gibt es verdächtige zeitliche Zusammenhänge zwischen bestimmten Zutaten und Symptomen?
2. Achte besonders auf versteckte Allergene (z.B. Gluten in Sojasauce, Milcheiweiß in Gebäck, Ei in Nudeln).
3. Gibt es Muster bei den Tageszeiten?

Antworte auf Deutsch in diesem JSON-Format:
{
  "summary": "Kurze Zusammenfassung (1-2 Sätze)",
  "suspectedIngredients": [{"name": "Zutat", "reason": "Begründung"}],
  "hiddenAllergens": ["Liste versteckter Allergene die in den Mahlzeiten sein könnten"],
  "recommendation": "Empfehlung (z. B. was beim nächsten Arztbesuch ansprechen)"
}

Antworte NUR mit dem JSON, ohne Markdown-Formatierung.`
    : `Du bist ein Ernährungsberater-Assistent für Kleinkinder. Analysiere die folgenden Daten für das Kind "${childName}".

WICHTIG: Du bist KEIN Arzt. Gib keine Diagnosen ab. Formuliere vorsichtige Vermutungen.

Mahlzeiten der letzten 3 Tage:
${JSON.stringify(recentMeals, null, 2)}

Symptome der letzten 3 Tage:
${JSON.stringify(recentSymptoms, null, 2)}

Analysiere als Ernährungsexperte:
1. Gibt es verdächtige zeitliche Zusammenhänge zwischen bestimmten Zutaten und Symptomen?
2. Achte besonders auf versteckte Allergene (z.B. Gluten in Sojasauce, Milcheiweiß in Gebäck, Ei in Nudeln).
3. Gibt es Muster bei den Tageszeiten?

Antworte auf Deutsch in diesem JSON-Format:
{
  "summary": "Kurze Zusammenfassung (1-2 Sätze)",
  "suspectedIngredients": [{"name": "Zutat", "reason": "Begründung"}],
  "hiddenAllergens": ["Liste versteckter Allergene die in den Mahlzeiten sein könnten"],
  "recommendation": "Empfehlung für die Eltern (was beim nächsten Arztbesuch ansprechen)"
}

Antworte NUR mit dem JSON, ohne Markdown-Formatierung.`;

  const response = await analyzeWithGemini(prompt);

  try {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { summary: response, suspectedIngredients: [], hiddenAllergens: [], recommendation: '' };
  }
}
