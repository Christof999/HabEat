/**
 * Open Food Facts API integration
 * https://openfoodfacts.github.io/openfoodfacts-server/api/
 *
 * Free, open database — no API key required.
 * Rate limit: 100 req/min for read operations.
 */

const BASE_URL = 'https://world.openfoodfacts.org';
const USER_AGENT = 'HabEat/1.0 (habeat-app)';

const FIELDS = [
  'product_name', 'product_name_de', 'brands', 'image_front_small_url',
  'nutriments', 'allergens_tags', 'ingredients_text_de', 'ingredients_text',
  'nutriscore_grade', 'nova_group', 'serving_size', 'quantity',
].join(',');

/**
 * Fetch a product by barcode (EAN/UPC).
 * @param {string} barcode
 * @returns {Promise<{found: boolean, product: Object|null}>}
 */
export async function fetchProductByBarcode(barcode) {
  const url = `${BASE_URL}/api/v2/product/${encodeURIComponent(barcode)}?fields=${FIELDS}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) return { found: false, product: null };
  const data = await res.json();
  if (data.status !== 1) return { found: false, product: null };
  return { found: true, product: normalizeProduct(data.product) };
}

/**
 * Search products by text query (name / brand).
 * @param {string} query
 * @param {number} pageSize
 * @returns {Promise<Array>} normalized product results
 */
export async function searchProducts(query, pageSize = 10) {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(pageSize),
    fields: FIELDS,
    lc: 'de',
  });
  const url = `${BASE_URL}/cgi/search.pl?${params}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.products || []).map(normalizeProduct);
}

/**
 * Normalize a raw OFF product into a consistent shape.
 */
function normalizeProduct(raw) {
  const n = raw.nutriments || {};
  return {
    name: raw.product_name_de || raw.product_name || '',
    brand: raw.brands || '',
    imageUrl: raw.image_front_small_url || null,
    servingSize: raw.serving_size || null,
    quantity: raw.quantity || null,
    nutriscoreGrade: raw.nutriscore_grade || null,
    novaGroup: raw.nova_group || null,
    ingredients: raw.ingredients_text_de || raw.ingredients_text || '',
    allergens: (raw.allergens_tags || []).map(tag => {
      // Convert "en:milk" -> "Milch" etc.
      return ALLERGEN_LABELS[tag] || tag.replace(/^\w+:/, '');
    }),
    nutrition: {
      calories: round(n['energy-kcal_100g']),
      protein: round(n['proteins_100g']),
      carbs: round(n['carbohydrates_100g']),
      fat: round(n['fat_100g']),
      sugar: round(n['sugars_100g']),
      saturatedFat: round(n['saturated-fat_100g']),
      fiber: round(n['fiber_100g']),
      salt: round(n['salt_100g']),
      sodium: round(n['sodium_100g']),
    },
    _raw: raw,
  };
}

function round(v) {
  return v != null ? Math.round(v * 10) / 10 : null;
}

/**
 * Validate AI-estimated nutrition by searching each ingredient in OFF
 * and computing aggregated nutrition from per-100g data + estimated weights.
 *
 * @param {Array<{name: string, amount_g: number|null}>} ingredients
 * @param {{calories, protein, carbs, fat, sugar, fiber}} aiNutrition - Gemini estimates
 * @returns {Promise<{corrected: boolean, offNutrition, corrections: Array, matched: number, total: number, details: Array}>}
 */
export async function validateNutritionByIngredients(ingredients, aiNutrition) {
  const DEVIATION_THRESHOLD = 0.30; // 30% deviation triggers correction

  // Search OFF for each ingredient (parallel, max 6 concurrent)
  const lookups = await Promise.all(
    ingredients.map(async (ing) => {
      try {
        const results = await searchProducts(ing.name, 3);
        // Pick the best match (first result with nutrition data)
        const match = results.find(p => p.nutrition.calories != null);
        return { ingredient: ing, product: match || null };
      } catch {
        return { ingredient: ing, product: null };
      }
    })
  );

  const details = [];
  const aggregated = { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0 };
  let matched = 0;
  let totalWeightUsed = 0;

  for (const { ingredient, product } of lookups) {
    if (!product) {
      details.push({ name: ingredient.name, matched: false });
      continue;
    }
    matched++;
    // Use Gemini-estimated weight, fallback to 50g default
    const weight = ingredient.amount_g || 50;
    totalWeightUsed += weight;
    const factor = weight / 100;
    const n = product.nutrition;

    const contribution = {
      calories: round((n.calories || 0) * factor),
      protein: round((n.protein || 0) * factor),
      carbs: round((n.carbs || 0) * factor),
      fat: round((n.fat || 0) * factor),
      sugar: round((n.sugar || 0) * factor),
      fiber: round((n.fiber || 0) * factor),
    };

    for (const key of Object.keys(aggregated)) {
      aggregated[key] += contribution[key] || 0;
    }

    details.push({
      name: ingredient.name,
      matched: true,
      product: product.name,
      brand: product.brand,
      weight,
      per100g: product.nutrition,
      contribution,
    });
  }

  // Round aggregated values
  for (const key of Object.keys(aggregated)) {
    aggregated[key] = round(aggregated[key]);
  }

  // Compare AI values with OFF aggregated values
  const corrections = [];
  const fields = ['calories', 'protein', 'carbs', 'fat', 'sugar', 'fiber'];
  const fieldLabels = { calories: 'Kalorien', protein: 'Protein', carbs: 'Kohlenhydrate', fat: 'Fett', sugar: 'Zucker', fiber: 'Ballaststoffe' };

  for (const field of fields) {
    const ai = aiNutrition[field] || 0;
    const off = aggregated[field] || 0;
    if (ai === 0 && off === 0) continue;
    const base = Math.max(ai, off, 1);
    const deviation = Math.abs(ai - off) / base;
    if (deviation > DEVIATION_THRESHOLD) {
      corrections.push({
        field,
        label: fieldLabels[field],
        aiValue: ai,
        offValue: off,
        deviation: round(deviation * 100),
      });
    }
  }

  return {
    corrected: corrections.length > 0 && matched >= 2,
    offNutrition: aggregated,
    corrections,
    matched,
    total: ingredients.length,
    details,
  };
}

const ALLERGEN_LABELS = {
  'en:milk': 'Milch',
  'en:eggs': 'Ei',
  'en:gluten': 'Gluten',
  'en:nuts': 'Nüsse',
  'en:peanuts': 'Erdnüsse',
  'en:soybeans': 'Soja',
  'en:fish': 'Fisch',
  'en:crustaceans': 'Schalentiere',
  'en:celery': 'Sellerie',
  'en:mustard': 'Senf',
  'en:sesame-seeds': 'Sesam',
  'en:sulphur-dioxide-and-sulphites': 'Sulfite',
  'en:lupin': 'Lupine',
  'en:molluscs': 'Weichtiere',
};
