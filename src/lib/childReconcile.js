/**
 * Bereinigt Kinder-Liste und Mahlzeiten: Duplikate nach ID, Platzhalter „Kind“ ohne Mahlzeiten,
 * Einträge wie „Christof Sörgel“; verschmilzt Profildaten auf das Kind mit den meisten Mahlzeiten.
 */

function mealCountsByChildId(meals) {
  const counts = {};
  if (!Array.isArray(meals)) return counts;
  for (const m of meals) {
    const id = m?.childId;
    if (typeof id === 'string' && id.trim()) {
      const k = id.trim();
      counts[k] = (counts[k] || 0) + 1;
    }
  }
  return counts;
}

function isChristofLikeName(name) {
  if (typeof name !== 'string') return false;
  const n = name.toLowerCase();
  return n.includes('christof') || n.includes('sörgel') || n.includes('soergel');
}

function isPlaceholderKindName(name) {
  if (typeof name !== 'string' || !name.trim()) return true;
  return name.trim() === 'Kind';
}

function mergeScalar(a, b) {
  const defined = (x) => x != null && x !== '';
  if (defined(b)) return b;
  if (defined(a)) return a;
  return b ?? a ?? null;
}

function mergeTwoChildren(primary, secondary) {
  const known = new Set([
    ...(Array.isArray(primary.knownAllergies) ? primary.knownAllergies : []),
    ...(Array.isArray(secondary.knownAllergies) ? secondary.knownAllergies : []),
    ...(Array.isArray(primary.allergies) ? primary.allergies : []),
    ...(Array.isArray(secondary.allergies) ? secondary.allergies : []),
  ]);
  const knownAllergies = [...known].filter(Boolean);

  const gm = [
    ...(Array.isArray(primary.growthMeasurements) ? primary.growthMeasurements : []),
    ...(Array.isArray(secondary.growthMeasurements) ? secondary.growthMeasurements : []),
  ];

  const pickName = () => {
    const a = typeof primary.name === 'string' ? primary.name.trim() : '';
    const b = typeof secondary.name === 'string' ? secondary.name.trim() : '';
    const good = (n) => n && n !== 'Kind' && !isChristofLikeName(n);
    if (good(a)) return a;
    if (good(b)) return b;
    if (a && a !== 'Kind') return a;
    if (b && b !== 'Kind') return b;
    return a || b || 'Kind';
  };

  return {
    ...primary,
    ...secondary,
    id: primary.id,
    name: pickName(),
    birthDate: mergeScalar(primary.birthDate, secondary.birthDate),
    height: mergeScalar(primary.height, secondary.height),
    weight: mergeScalar(primary.weight, secondary.weight),
    avatarColor: mergeScalar(primary.avatarColor, secondary.avatarColor),
    photoUrl: mergeScalar(primary.photoUrl, secondary.photoUrl),
    sex: primary.sex || secondary.sex || null,
    knownAllergies,
    allergies: knownAllergies,
    growthMeasurements: gm.length ? gm : primary.growthMeasurements,
    createdAt: mergeScalar(primary.createdAt, secondary.createdAt),
    updatedAt: new Date().toISOString(),
  };
}

/** Beim Sync: lokale Profilfelder nutzen, wenn Remote leer oder nur Platzhaltername */
export function mergeChildProfileFromLocal(local, remote) {
  if (!local || !remote) return remote;
  const rName = typeof remote.name === 'string' ? remote.name.trim() : '';
  const lName = typeof local.name === 'string' ? local.name.trim() : '';
  const useLocalName = (!rName || rName === 'Kind') && lName && lName !== 'Kind';

  return {
    ...remote,
    ...(useLocalName && { name: lName }),
    ...((!remote.birthDate && local.birthDate) && { birthDate: local.birthDate }),
    ...((remote.height == null && local.height != null) && { height: local.height }),
    ...((remote.weight == null && local.weight != null) && { weight: local.weight }),
    ...((!remote.avatarColor && local.avatarColor) && { avatarColor: local.avatarColor }),
    ...((!remote.photoUrl && local.photoUrl) && { photoUrl: local.photoUrl }),
    ...((!remote.sex && local.sex) && { sex: local.sex }),
  };
}

/**
 * @returns {{ children: array, meals: array, changed: boolean, primaryChildId: string|null, removedIds: string[] }}
 */
export function reconcileChildrenAndMeals(children, meals) {
  if (!Array.isArray(children) || children.length === 0) {
    return { children: children || [], meals: meals || [], changed: false, primaryChildId: null, removedIds: [] };
  }

  const mealCounts = mealCountsByChildId(meals);

  const byId = new Map();
  for (const c of children) {
    if (!c || typeof c.id !== 'string' || !c.id.trim()) continue;
    const id = c.id.trim();
    if (byId.has(id)) {
      byId.set(id, mergeTwoChildren(byId.get(id), c));
    } else {
      byId.set(id, { ...c, id });
    }
  }
  const mergedList = [...byId.values()];
  if (mergedList.length === 0) {
    return { children: [], meals: meals || [], changed: children.length > 0, primaryChildId: null, removedIds: [] };
  }

  const mealEntries = Object.entries(mealCounts).sort((a, b) => b[1] - a[1]);
  const nonChristofMealChild = mealEntries.find(([id]) => {
    const c = byId.get(id);
    return c && !isChristofLikeName(c.name);
  });
  let primaryId = nonChristofMealChild?.[0] || mealEntries[0]?.[0] || null;
  if (!primaryId || !byId.has(primaryId)) {
    const named = mergedList.find((c) => !isPlaceholderKindName(c.name) && !isChristofLikeName(c.name));
    const fallback = mergedList.find((c) => !isChristofLikeName(c.name));
    primaryId = (named || fallback || mergedList[0]).id;
  }

  const removeIds = new Set();
  for (const c of mergedList) {
    if (isChristofLikeName(c.name)) {
      removeIds.add(c.id);
      continue;
    }
    if (c.id !== primaryId && isPlaceholderKindName(c.name) && (mealCounts[c.id] || 0) === 0) {
      removeIds.add(c.id);
    }
  }

  if (removeIds.size === 0 && mergedList.length === children.length) {
    const sameIds = new Set(children.map((x) => x?.id).filter(Boolean));
    if (sameIds.size === mergedList.length) {
      return {
        children: mergedList,
        meals: meals || [],
        changed: false,
        primaryChildId: primaryId,
        removedIds: [],
      };
    }
  }

  let primary = { ...byId.get(primaryId) };
  for (const rid of removeIds) {
    if (rid === primaryId) continue;
    const r = byId.get(rid);
    if (r) primary = mergeTwoChildren(primary, r);
  }

  const newChildren = mergedList
    .filter((c) => !removeIds.has(c.id) || c.id === primaryId)
    .map((c) => (c.id === primaryId ? primary : c));

  const idSet = new Set(newChildren.map((c) => c.id));
  const finalChildren = idSet.has(primary.id) ? newChildren : [...newChildren, primary];

  const mealList = Array.isArray(meals) ? [...meals] : [];
  let mealsChanged = false;
  for (let i = 0; i < mealList.length; i += 1) {
    const m = mealList[i];
    const cid = typeof m?.childId === 'string' ? m.childId.trim() : '';
    if (cid && removeIds.has(cid) && cid !== primary.id) {
      mealList[i] = { ...m, childId: primary.id };
      mealsChanged = true;
    }
  }

  const changed =
    mealsChanged
    || finalChildren.length !== children.length
    || removeIds.size > 0
    || mergedList.length !== children.length;

  return {
    children: finalChildren,
    meals: mealList,
    changed,
    primaryChildId: primary.id,
    removedIds: [...removeIds].filter((id) => id !== primary.id),
  };
}
