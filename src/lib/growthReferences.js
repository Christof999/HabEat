/**
 * Vereinfachte Referenz-Medianwerte (WHO-ähnlich, 0–24 Monate) für Länge/Größe und Gewicht.
 * Dient nur zur groben Perzentil-Schätzung – keine klinische Diagnose.
 * Quelle: typische P50-Näherungen; zwischen Monaten linear interpoliert.
 */

const BOYS_LENGTH_CM = [
  49.9, 54.7, 58.4, 61.4, 63.9, 65.9, 67.6, 69.2, 70.6, 72.0, 73.3, 74.5, 75.7, 76.9, 78.0, 79.1,
  80.2, 81.2, 82.3, 83.2, 84.2, 85.1, 86.0, 86.9, 87.8,
];
const GIRLS_LENGTH_CM = [
  49.1, 53.7, 57.1, 59.8, 62.1, 64.0, 65.7, 67.3, 68.7, 70.1, 71.5, 72.8, 74.0, 75.2, 76.4, 77.5,
  78.6, 79.7, 80.7, 81.7, 82.7, 83.7, 84.6, 85.5, 86.4,
];
const BOYS_WEIGHT_KG = [
  3.35, 4.47, 5.57, 6.38, 7.01, 7.53, 7.97, 8.36, 8.70, 9.01, 9.30, 9.58, 9.85, 10.10, 10.34, 10.58,
  10.80, 11.03, 11.25, 11.47, 11.68, 11.89, 12.10, 12.30, 12.50,
];
const GIRLS_WEIGHT_KG = [
  3.23, 4.19, 5.13, 5.85, 6.42, 6.90, 7.30, 7.65, 7.95, 8.22, 8.48, 8.71, 8.94, 9.16, 9.37, 9.58,
  9.77, 9.98, 10.16, 10.35, 10.54, 10.72, 10.90, 11.08, 11.25,
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Alter in vollen Monaten seit birthDate (YYYY-MM-DD) zu Messdatum (Date oder ISO-String) */
export function ageMonthsAtDate(birthDateStr, measureDate) {
  if (!birthDateStr) return null;
  const birth = new Date(`${birthDateStr}T12:00:00`);
  const meas = measureDate instanceof Date ? measureDate : new Date(measureDate);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(meas.getTime())) return null;
  const days = (meas - birth) / (1000 * 60 * 60 * 24);
  if (days < 0) return null;
  return days / (365.25 / 12);
}

function medianFromTable(ageMonths, table) {
  if (ageMonths == null || !Number.isFinite(ageMonths)) return null;
  const maxIdx = table.length - 1;
  if (ageMonths >= maxIdx) return table[maxIdx];
  const i = Math.floor(ageMonths);
  const frac = ageMonths - i;
  if (i < 0) return table[0];
  return lerp(table[i], table[Math.min(i + 1, maxIdx)], frac);
}

export function medianLengthCm(ageMonths, sex) {
  if (sex === 'female') return medianFromTable(ageMonths, GIRLS_LENGTH_CM);
  if (sex === 'male') return medianFromTable(ageMonths, BOYS_LENGTH_CM);
  const b = medianFromTable(ageMonths, BOYS_LENGTH_CM);
  const g = medianFromTable(ageMonths, GIRLS_LENGTH_CM);
  if (b == null || g == null) return null;
  return (b + g) / 2;
}

export function medianWeightKg(ageMonths, sex) {
  if (sex === 'female') return medianFromTable(ageMonths, GIRLS_WEIGHT_KG);
  if (sex === 'male') return medianFromTable(ageMonths, BOYS_WEIGHT_KG);
  const b = medianFromTable(ageMonths, BOYS_WEIGHT_KG);
  const g = medianFromTable(ageMonths, GIRLS_WEIGHT_KG);
  if (b == null || g == null) return null;
  return (b + g) / 2;
}

/** Näherung der Normalverteilung CDF für z */
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/**
 * Grobe Perzentil-Schätzung (1–99) aus Median und altersabhängigem Streuungsfaktor.
 */
export function approximatePercentile(value, median, coefficientOfVariation) {
  if (value == null || median == null || median <= 0 || !Number.isFinite(value)) return null;
  const sd = Math.max(median * coefficientOfVariation, 0.001);
  const z = (value - median) / sd;
  const p = normalCdf(z) * 100;
  return Math.round(clamp(p, 1, 99) * 10) / 10;
}

export function lengthPercentile(heightCm, ageMonths, sex) {
  const m = medianLengthCm(ageMonths, sex);
  return approximatePercentile(heightCm, m, 0.028);
}

export function weightPercentile(weightKg, ageMonths, sex) {
  const m = medianWeightKg(ageMonths, sex);
  return approximatePercentile(weightKg, m, 0.11);
}
