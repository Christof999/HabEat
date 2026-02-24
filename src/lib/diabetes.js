const BE_CARBS_GRAMS = 12;
const KE_CARBS_GRAMS = 10;

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeCondition(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasDiabetesType1(conditions = []) {
  return conditions.some((condition) => {
    const normalized = normalizeCondition(condition);
    return (
      normalized.includes('diabetes typ 1') ||
      normalized.includes('diabetes type 1') ||
      normalized.includes('typ 1 diabetes') ||
      normalized.includes('type 1 diabetes') ||
      normalized.includes('typ1') ||
      normalized.includes('type1') ||
      normalized === 't1d'
    );
  });
}

export function hasDiabetesType2(conditions = []) {
  return conditions.some((condition) => {
    const normalized = normalizeCondition(condition);
    return (
      normalized.includes('diabetes typ 2') ||
      normalized.includes('diabetes type 2') ||
      normalized.includes('typ 2 diabetes') ||
      normalized.includes('type 2 diabetes') ||
      normalized.includes('typ2') ||
      normalized.includes('type2') ||
      normalized === 't2d'
    );
  });
}

export function getPortionFactor(portionEaten) {
  if (portionEaten === 'half') return 0.5;
  if (portionEaten === 'some') return 0.25;
  return 1;
}

export function getAdjustedCarbs(carbs, portionEaten) {
  const carbsNumber = toNumber(carbs);
  if (carbsNumber == null) return null;
  return roundOne(Math.max(0, carbsNumber) * getPortionFactor(portionEaten));
}

export function calculateCarbUnits(carbsGrams) {
  const carbsNumber = toNumber(carbsGrams);
  const carbs = carbsNumber != null ? Math.max(0, carbsNumber) : 0;
  return {
    carbs: roundOne(carbs),
    be: roundOne(carbs / BE_CARBS_GRAMS),
    ke: roundOne(carbs / KE_CARBS_GRAMS),
  };
}
