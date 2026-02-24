import {
  collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDocs,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';

/**
 * Firestore-Pfade: users/{username}/children, users/{username}/meals, users/{username}/symptoms
 */

function userRef(username) {
  return doc(db, 'users', username.toLowerCase());
}

function childrenCol(username) {
  return collection(db, 'users', username.toLowerCase(), 'children');
}

function mealsCol(username) {
  return collection(db, 'users', username.toLowerCase(), 'meals');
}

function symptomsCol(username) {
  return collection(db, 'users', username.toLowerCase(), 'symptoms');
}

function growthCol(username) {
  return collection(db, 'users', username.toLowerCase(), 'growth');
}

// --- Children ---
export async function saveChild(username, child) {
  await setDoc(doc(childrenCol(username), child.id), {
    ...child,
    photoUrl: null, // Don't store base64 images in Firestore (too large)
  });
}

export async function updateChild(username, partialChild) {
  const { photoUrl: _photoUrl, ...fields } = partialChild;
  await setDoc(doc(childrenCol(username), partialChild.id), fields, { merge: true });
}

export async function removeChild(username, childId) {
  await deleteDoc(doc(childrenCol(username), childId));
}

// --- Meals ---
export async function saveMeal(username, meal) {
  await setDoc(doc(mealsCol(username), meal.id), {
    ...meal,
    imageUrl: null, // Don't store base64 images in Firestore (too large)
    afterImageUrl: null, // Same for after-eating photos
  });
}

export async function updateMeal(username, partialMeal) {
  const { imageUrl: _imageUrl, afterImageUrl: _afterImageUrl, ...fields } = partialMeal;
  await setDoc(doc(mealsCol(username), partialMeal.id), fields, { merge: true });
}

// --- Symptoms ---
export async function saveSymptom(username, symptom) {
  const { photoUrl: _photoUrl, ...fields } = symptom;
  await setDoc(doc(symptomsCol(username), symptom.id), {
    ...fields,
    photoUrl: null, // Don't store base64 in Firestore — use Storage instead
  });
}

export async function removeSymptom(username, symptomId) {
  // Also delete photo from Storage if it exists
  try {
    const photoRef = ref(storage, `users/${username.toLowerCase()}/symptoms/${symptomId}.jpg`);
    await deleteObject(photoRef);
  } catch {
    // Photo may not exist — ignore
  }
  await deleteDoc(doc(symptomsCol(username), symptomId));
}

// --- Symptom Photos (Firebase Storage) ---
export async function uploadSymptomPhoto(username, symptomId, base64DataUrl) {
  const storageRef = ref(storage, `users/${username.toLowerCase()}/symptoms/${symptomId}.jpg`);
  await uploadString(storageRef, base64DataUrl, 'data_url');
  const downloadUrl = await getDownloadURL(storageRef);
  // Store the download URL in the Firestore symptom document
  await setDoc(doc(symptomsCol(username), symptomId), { photoStorageUrl: downloadUrl }, { merge: true });
  return downloadUrl;
}

export async function getSymptomPhotoUrl(username, symptomId) {
  try {
    const storageRef = ref(storage, `users/${username.toLowerCase()}/symptoms/${symptomId}.jpg`);
    return await getDownloadURL(storageRef);
  } catch {
    return null;
  }
}

// --- Growth Entries ---
export async function saveGrowthEntry(username, entry) {
  await setDoc(doc(growthCol(username), entry.id), entry);
}

export async function removeGrowthEntry(username, entryId) {
  await deleteDoc(doc(growthCol(username), entryId));
}

// --- Settings (activeChildId, onboardingComplete) ---
export async function saveUserSettings(username, settings) {
  await setDoc(userRef(username), settings, { merge: true });
}

// --- Delete all user data ---
export async function deleteAllUserData(username) {
  const collections = [childrenCol(username), mealsCol(username), symptomsCol(username), growthCol(username)];
  for (const col of collections) {
    const snap = await getDocs(col);
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  }
  await deleteDoc(userRef(username));
}

// --- Real-time listeners ---
function onListenerError(collectionName) {
  return (err) => console.error(`Firestore listener error (${collectionName}):`, err);
}

export function subscribeToUserData(username, onData) {
  const unsubscribers = [];

  // Listen to user settings
  unsubscribers.push(
    onSnapshot(userRef(username), (snap) => {
      if (snap.exists()) {
        onData('settings', snap.data());
      }
    }, onListenerError('settings'))
  );

  // Listen to children
  unsubscribers.push(
    onSnapshot(childrenCol(username), (snap) => {
      const children = snap.docs.map(d => d.data());
      onData('children', children);
    }, onListenerError('children'))
  );

  // Listen to meals (ordered by timestamp desc)
  unsubscribers.push(
    onSnapshot(query(mealsCol(username), orderBy('timestamp', 'desc')), (snap) => {
      const meals = snap.docs.map(d => d.data());
      onData('meals', meals);
    }, onListenerError('meals'))
  );

  // Listen to symptoms
  unsubscribers.push(
    onSnapshot(query(symptomsCol(username), orderBy('timestamp', 'desc')), (snap) => {
      const symptoms = snap.docs.map(d => d.data());
      onData('symptoms', symptoms);
    }, onListenerError('symptoms'))
  );

  // Listen to growth entries
  unsubscribers.push(
    onSnapshot(query(growthCol(username), orderBy('timestamp', 'desc')), (snap) => {
      const entries = snap.docs.map(d => d.data());
      onData('growth', entries);
    }, onListenerError('growth'))
  );

  return () => unsubscribers.forEach(unsub => unsub());
}
