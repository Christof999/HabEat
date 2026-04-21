import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Lädt ein Profilbild für ein Kind nach Firebase Storage.
 * Pfad: users/{username}/children/{childId}/avatar
 */
export async function uploadChildAvatar(username, childId, file) {
  const safeUser = String(username).toLowerCase().trim();
  const safeId = String(childId).trim();
  const path = `users/${safeUser}/children/${safeId}/avatar`;
  const storageRef = ref(storage, path);
  const contentType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
  await uploadBytes(storageRef, file, { contentType });
  return getDownloadURL(storageRef);
}
