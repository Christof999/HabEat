/** Logins ohne Kleinkind-Fokus bei KI-Ernährungsanalyse (Essenserkennung, Detektiv). */
const ADULT_NUTRITION_USERNAMES = new Set(['thomas', 'martina']);

export function isAdultNutritionUser(username) {
  if (!username || typeof username !== 'string') return false;
  return ADULT_NUTRITION_USERNAMES.has(username.trim().toLowerCase());
}
