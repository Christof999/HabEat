/**
 * Zusätzliches lokales Backup pro Benutzer (falls habeat-state überschrieben wurde).
 */

export function userBackupKey(username) {
  if (!username) return null;
  return `habeat-state-backup-${String(username).toLowerCase().trim()}`;
}

export function saveUserStateBackup(username, slice) {
  const key = userBackupKey(username);
  if (!key) return;
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        onboardingComplete: slice.onboardingComplete,
        activeChildId: slice.activeChildId,
        children: slice.children,
        meals: slice.meals,
        symptoms: slice.symptoms,
      }),
    );
  } catch (e) {
    console.warn('HabEat: Backup konnte nicht gespeichert werden.', e);
  }
}

export function loadUserStateBackup(username) {
  const key = userBackupKey(username);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
