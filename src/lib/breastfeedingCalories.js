/**
 * Geschätzte Kalorien aus Stillzeit (Muttermilch für das Kind).
 * Richtwert: mindestens ~35 kcal bei 10 Minuten (ca. 3,5 kcal/min).
 */
export const BREASTFEEDING_KCAL_PER_MINUTE = 3.5;

export function breastCaloriesFromDurationMin(durationMin) {
  const d = Number(durationMin);
  if (!Number.isFinite(d) || d <= 0) return null;
  return Math.round(d * BREASTFEEDING_KCAL_PER_MINUTE * 10) / 10;
}
