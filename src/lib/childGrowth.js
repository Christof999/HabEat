/**
 * Messreihe Größe/Gewicht am Kind-Profil.
 */

function sortByDate(measurements) {
  return [...measurements].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function normalizeGrowthMeasurements(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const id = typeof m.id === 'string' && m.id.trim() ? m.id.trim() : crypto.randomUUID();
    const date = typeof m.date === 'string' ? m.date.slice(0, 10) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const height = m.height != null && m.height !== '' ? Number(m.height) : null;
    const weight = m.weight != null && m.weight !== '' ? Number(m.weight) : null;
    if (!Number.isFinite(height) && !Number.isFinite(weight)) continue;
    out.push({
      id,
      date,
      height: Number.isFinite(height) ? height : null,
      weight: Number.isFinite(weight) ? weight : null,
    });
  }
  return sortByDate(out);
}

/** Bestehende Kinder: ein Punkt aus aktueller Größe/Gewicht + createdAt, falls noch keine Reihe */
export function migrateGrowthMeasurements(child) {
  const existing = normalizeGrowthMeasurements(child.growthMeasurements);
  if (existing.length > 0) return existing;
  const h = child.height != null && Number.isFinite(Number(child.height)) ? Number(child.height) : null;
  const w = child.weight != null && Number.isFinite(Number(child.weight)) ? Number(child.weight) : null;
  if (h == null && w == null) return [];
  const baseDate = (typeof child.createdAt === 'string' && child.createdAt.slice(0, 10))
    || new Date().toISOString().slice(0, 10);
  return [{
    id: `${child.id}-baseline`,
    date: baseDate,
    height: h,
    weight: w,
  }];
}

/**
 * Beim Speichern des Formulars: Messpunkt ergänzen, wenn sich Größe/Gewicht zum letzten Eintrag geändert hat.
 */
export function mergeGrowthMeasurementOnSave(prevChild, height, weight) {
  const prev = normalizeGrowthMeasurements(
    prevChild?.growthMeasurements?.length
      ? prevChild.growthMeasurements
      : migrateGrowthMeasurements(prevChild || {}),
  );
  const h = height != null && Number.isFinite(height) ? height : null;
  const w = weight != null && Number.isFinite(weight) ? weight : null;
  if (h == null && w == null) return prev;

  const last = prev[prev.length - 1];
  const sameAsLast = last
    && last.height === h
    && last.weight === w;
  if (sameAsLast) return prev;

  const today = new Date().toISOString().slice(0, 10);
  const next = [...prev];
  if (last && last.date === today) {
    next[next.length - 1] = { ...last, height: h, weight: w };
    return next;
  }
  next.push({
    id: crypto.randomUUID(),
    date: today,
    height: h,
    weight: w,
  });
  return sortByDate(next);
}

export const MAX_GROWTH_MEASUREMENTS_SYNC = 200;

/**
 * Vereinigt lokale und Remote-Messungen (gleiches Datum → ein Eintrag, Felder zusammenführen).
 */
export function mergeChildGrowthForSync(localChild, remoteChild) {
  const a = normalizeGrowthMeasurements(localChild?.growthMeasurements);
  const b = normalizeGrowthMeasurements(remoteChild?.growthMeasurements);
  const map = new Map();
  for (const row of [...a, ...b]) {
    const key = row.date;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...row });
    } else {
      map.set(key, {
        id: prev.id || row.id,
        date: row.date,
        height: row.height ?? prev.height,
        weight: row.weight ?? prev.weight,
      });
    }
  }
  return sortByDate(Array.from(map.values()));
}
