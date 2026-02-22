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
