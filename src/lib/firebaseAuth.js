import { signInAnonymously } from 'firebase/auth';
import { auth } from './firebase';

/**
 * Stellt sicher, dass ein Firebase-Benutzer existiert (anonym), damit
 * Storage-Regeln mit `request.auth != null` erfüllt werden.
 * Anonymous Sign-In muss in der Firebase Console unter Authentication aktiviert sein.
 */
export async function ensureAnonymousAuth() {
  if (auth.currentUser) return auth.currentUser;
  const { user } = await signInAnonymously(auth);
  return user;
}
