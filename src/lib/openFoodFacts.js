/**
 * Open Food Facts API integration
 * https://openfoodfacts.github.io/openfoodfacts-server/api/
 *
 * Free, open database — no API key required.
 * Rate limit: 100 req/min for read operations.
 */

const BASE_URL = 'https://world.openfoodfacts.org';
const USER_AGENT = 'HabEat/1.0 (habeat-app)';
const MIN_MATCH_SCORE = 25;
const OFF_MAX_RETRIES = 3;
const LOOKUP_CONCURRENCY = 3;
const OFF_REQUEST_TIMEOUT_MS = 30000;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_CACHE = new Map();

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
  const res = await fetch(url, { headers: getRequestHeaders() });
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
  const normalizedQuery = (query || '').trim();
  if (normalizedQuery.length < 2) return [];

  const cacheKey = `${normalizedQuery.toLowerCase()}::${pageSize}`;
  const cached = SEARCH_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.results;
  }

  const variants = buildSearchVariants(normalizedQuery);
  let mergedResults = [];

  for (const variant of variants) {
    const germanResults = await querySearch(variant, pageSize, 'de');
    mergedResults = mergeUniqueProducts(mergedResults, germanResults, pageSize);

    // Fallback without locale constraint (helps when OFF has only non-de metadata)
    if (mergedResults.length < Math.min(3, pageSize)) {
      const intlResults = await querySearch(variant, pageSize, null);
      mergedResults = mergeUniqueProducts(mergedResults, intlResults, pageSize);
    }

    if (mergedResults.length >= pageSize) break;
  }

  SEARCH_CACHE.set(cacheKey, {
    results: mergedResults,
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
  });

  return mergedResults;
}

function getRequestHeaders() {
  const headers = { Accept: 'application/json' };
  // Browsers block custom "User-Agent" headers; only send it in server/runtime environments.
  if (typeof window === 'undefined') {
    headers['User-Agent'] = USER_AGENT;
  }
  return headers;
}

async function querySearch(searchTerm, pageSize, locale = 'de') {
  try {
    const params = new URLSearchParams({
      search_terms: searchTerm,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: String(pageSize),
      fields: FIELDS,
    });
    if (locale) params.set('lc', locale);

    const url = `${BASE_URL}/cgi/search.pl?${params}`;
    const res = await fetchWithRetry(url, { headers: getRequestHeaders() });
    if (!res.ok) return [];

    const data = await res.json();
    return (data.products || []).map(normalizeProduct);
  } catch {
    // Do not fail the full matching flow for one failed request.
    return [];
  }
}

function mergeUniqueProducts(existing, incoming, maxItems) {
  const merged = [...existing];
  const seen = new Set(
    merged.map(p => p?._raw?.code || normalizeTextForSearch(`${p?.name || ''} ${p?.brand || ''}`))
  );

  for (const product of incoming) {
    const key = product?._raw?.code || normalizeTextForSearch(`${product?.name || ''} ${product?.brand || ''}`);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(product);
    if (merged.length >= maxItems) break;
  }

  return merged;
}

/**
 * Normalize a raw OFF product into a consistent shape.
 */
function normalizeProduct(raw) {
  const n = raw.nutriments || {};
  const ingredientText = raw.ingredients_text_de || raw.ingredients_text || '';
  const ingredientList = parseIngredientList(ingredientText);
  const calories = getCaloriesPer100g(n);
  return {
    name: raw.product_name_de || raw.product_name || '',
    brand: raw.brands || '',
    imageUrl: raw.image_front_small_url || null,
    servingSize: raw.serving_size || null,
    quantity: raw.quantity || null,
    nutriscoreGrade: raw.nutriscore_grade || null,
    novaGroup: raw.nova_group || null,
    ingredients: ingredientText,
    ingredientList,
    allergens: (raw.allergens_tags || []).map(tag => {
      // Convert "en:milk" -> "Milch" etc.
      return ALLERGEN_LABELS[tag] || tag.replace(/^\w+:/, '');
    }),
    nutrition: {
      calories,
      protein: pickFirstNumber(n, ['proteins_100g', 'proteins_prepared_100g', 'proteins']),
      carbs: pickFirstNumber(n, ['carbohydrates_100g', 'carbohydrates_prepared_100g', 'carbohydrates']),
      fat: pickFirstNumber(n, ['fat_100g', 'fat_prepared_100g', 'fat']),
      sugar: pickFirstNumber(n, ['sugars_100g', 'sugars_prepared_100g', 'sugars']),
      saturatedFat: pickFirstNumber(n, ['saturated-fat_100g', 'saturated-fat_prepared_100g', 'saturated-fat']),
      fiber: pickFirstNumber(n, ['fiber_100g', 'fiber_prepared_100g', 'fiber']),
      salt: pickFirstNumber(n, ['salt_100g', 'salt_prepared_100g', 'salt']),
      sodium: pickFirstNumber(n, ['sodium_100g', 'sodium_prepared_100g', 'sodium']),
    },
    _raw: raw,
  };
}

function round(v) {
  const numeric = Number(v);
  return Number.isFinite(numeric) ? Math.round(numeric * 10) / 10 : null;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options) {
  let lastError = null;

  for (let attempt = 0; attempt < OFF_MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), OFF_REQUEST_TIMEOUT_MS);

      let res;
      try {
        res = await fetch(url, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      if (res.ok) return res;

      const shouldRetry = res.status === 429 || res.status >= 500;
      if (!shouldRetry || attempt === OFF_MAX_RETRIES - 1) return res;
    } catch (err) {
      lastError = err;
      if (attempt === OFF_MAX_RETRIES - 1) throw err;
    }

    // Exponential backoff with a small jitter.
    const backoff = 350 * (2 ** attempt) + Math.floor(Math.random() * 150);
    await wait(backoff);
  }

  if (lastError) throw lastError;
  throw new Error('OpenFoodFacts request failed');
}

function pickFirstNumber(source, keys) {
  for (const key of keys) {
    if (source?.[key] != null) {
      const value = round(source[key]);
      if (value != null) return value;
    }
  }
  return null;
}

function getCaloriesPer100g(nutriments) {
  const directKcal = pickFirstNumber(nutriments, [
    'energy-kcal_100g',
    'energy-kcal_prepared_100g',
    'energy-kcal',
  ]);
  if (directKcal != null) return directKcal;

  // Fallback: OFF often stores energy in kJ only.
  const kj = pickFirstNumber(nutriments, [
    'energy_100g',
    'energy-kj_100g',
    'energy_prepared_100g',
    'energy-kj_prepared_100g',
    'energy-kj',
    'energy',
  ]);
  if (kj == null) return null;
  return round(kj / 4.184);
}

function normalizeTextForSearch(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchVariants(query) {
  const raw = (query || '').trim();
  const stripped = stripIngredientNoise(raw);
  const normalized = normalizeTextForSearch(stripped || raw);
  const variants = new Set();

  if (raw) variants.add(raw);
  if (stripped && stripped !== raw) variants.add(stripped);
  if (normalized) variants.add(normalized);

  const firstSegment = raw.split(/[,(/|;+]/)[0]?.trim();
  if (firstSegment) variants.add(firstSegment);

  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length > 1) variants.add(tokens.slice(0, 2).join(' '));
  if (tokens.length > 0) variants.add(tokens[0]);

  return [...variants].filter(v => v.length >= 2).slice(0, 6);
}

function capitalizeFirst(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function cleanIngredientToken(token) {
  if (!token) return null;

  const cleaned = token
    .replace(/\*/g, '')
    .replace(/\b\d+(?:[.,]\d+)?\s*%/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\.\s*$/g, '')
    .replace(/^[\s\-–,:;]+|[\s\-–,:;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return null;
  const normalized = normalizeTextForSearch(cleaned);
  if (!normalized || normalized === 'zutaten' || normalized === 'ingredients') return null;
  return capitalizeFirst(cleaned);
}

function parseIngredientList(ingredientText) {
  const raw = (ingredientText || '')
    .replace(/^\s*(zutaten|ingredients)\s*[:.-]\s*/i, '')
    .trim();
  if (!raw) return [];

  const parts = [];
  let current = '';
  let nestingDepth = 0;

  for (const char of raw) {
    if (char === '(' || char === '[' || char === '{') nestingDepth++;
    if (char === ')' || char === ']' || char === '}') nestingDepth = Math.max(0, nestingDepth - 1);

    if ((char === ',' || char === ';') && nestingDepth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) parts.push(current.trim());

  const dedupe = new Set();
  const result = [];

  for (const token of parts) {
    const cleaned = cleanIngredientToken(token);
    if (!cleaned) continue;
    const key = normalizeTextForSearch(cleaned);
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    result.push(cleaned);
  }

  return result;
}

function stripIngredientNoise(name) {
  if (!name) return '';
  return name
    // Remove quantities in brackets, e.g. "Kartoffel (120 g)"
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    // Remove units and portions
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:g|kg|mg|ml|l|cl|tl|el|stk|stück|portion(?:en)?|scheibe(?:n)?|becher|dose(?:n)?)\b/gi, ' ')
    // Remove common preparation descriptors
    .replace(/\b(?:gekocht|gedaempft|gedämpft|gebraten|roh|frisch|geschnitten|gewuerfelt|gewürfelt|gehackt|gerieben|pueriert|püriert|klein|gross|groß|fein|mager|natur|optional|ohne|mit)\b/gi, ' ')
    .replace(/[+/|,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildIngredientQueries(name) {
  const raw = (name || '').trim();
  const stripped = stripIngredientNoise(raw);
  const normalized = normalizeTextForSearch(stripped || raw);
  const queries = new Set();

  if (normalized) queries.add(normalized);

  const splitBySeparators = raw.split(/[,(/|;+]/)[0]?.trim();
  if (splitBySeparators) queries.add(normalizeTextForSearch(splitBySeparators));

  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length > 1) queries.add(tokens.slice(0, 2).join(' '));
  if (tokens.length > 0) queries.add(tokens[0]);

  return [...queries].filter(q => q.length >= 2).slice(0, 4);
}

function hasUsableNutrition(product) {
  if (!product?.nutrition) return false;
  const { calories, protein, carbs, fat } = product.nutrition;
  return [calories, protein, carbs, fat].some(v => v != null);
}

function scoreProductMatch(ingredientName, product) {
  const ingredientTokens = normalizeTextForSearch(ingredientName)
    .split(' ')
    .filter(t => t.length >= 2);
  if (ingredientTokens.length === 0) return -1;

  const productText = normalizeTextForSearch(
    `${product.name || ''} ${product.brand || ''} ${product.ingredients || ''}`
  );

  const productTokens = productText.split(' ').filter(Boolean);
  const overlapCount = ingredientTokens.filter((ingredientToken) =>
    productTokens.some((productToken) =>
      productToken === ingredientToken
      || productToken.startsWith(ingredientToken)
      || ingredientToken.startsWith(productToken)
    )
  ).length;

  if (overlapCount === 0) return -1;

  const fullName = normalizeTextForSearch(product.name || '');
  const allTokensInName = ingredientTokens.every(t => fullName.includes(t));
  const nutritionBonus = hasUsableNutrition(product) ? 20 : 0;

  return overlapCount * 18 + (allTokensInName ? 20 : 0) + nutritionBonus;
}

async function findBestProductMatch(ingredientName) {
  const queries = buildIngredientQueries(ingredientName);
  if (queries.length === 0) {
    return { product: null, queryUsed: null, score: -1 };
  }

  const seenCodes = new Set();
  let best = { product: null, queryUsed: null, score: -1 };

  for (const query of queries) {
    const results = await searchProducts(query, 8);
    for (const product of results) {
      const code = product?._raw?.code;
      if (code && seenCodes.has(code)) continue;
      if (code) seenCodes.add(code);

      const score = scoreProductMatch(ingredientName, product);
      if (score > best.score) {
        best = { product, queryUsed: query, score };
      }
    }

    // Early stop once we have a sufficiently good match.
    if (best.score >= MIN_MATCH_SCORE + 10) break;
  }

  if (best.score < MIN_MATCH_SCORE || !hasUsableNutrition(best.product)) {
    return { product: null, queryUsed: best.queryUsed, score: best.score };
  }

  return best;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
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

  // Search OFF for each ingredient with robust query normalization + fallback.
  // Limit concurrency to reduce API bursts and avoid transient 429 responses.
  const lookups = await mapWithConcurrency(ingredients, LOOKUP_CONCURRENCY, async (ing) => {
      try {
        const best = await findBestProductMatch(ing.name);
        return {
          ingredient: ing,
          product: best.product || null,
          queryUsed: best.queryUsed,
          score: best.score,
        };
      } catch {
        return { ingredient: ing, product: null, queryUsed: null, score: -1 };
      }
    });

  const details = [];
  const aggregated = { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0 };
  let matched = 0;

  for (const { ingredient, product, queryUsed, score } of lookups) {
    if (!product) {
      details.push({ name: ingredient.name, matched: false, queryUsed, score });
      continue;
    }
    matched++;
    // Use Gemini-estimated weight, fallback to 50g default
    const weight = ingredient.amount_g || 50;
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
      queryUsed,
      score,
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
