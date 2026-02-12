import {
  collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy,
} from 'firebase/firestore';
import { db } from './firebase';

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

// --- Children ---
export async function saveChild(username, child) {
  await setDoc(doc(childrenCol(username), child.id), {
    ...child,
    photoUrl: null, // Don't store base64 images in Firestore (too large)
  });
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
  const { imageUrl, afterImageUrl, ...fields } = partialMeal;
  await setDoc(doc(mealsCol(username), partialMeal.id), fields, { merge: true });
}

// --- Symptoms ---
export async function saveSymptom(username, symptom) {
  await setDoc(doc(symptomsCol(username), symptom.id), symptom);
}

export async function removeSymptom(username, symptomId) {
  await deleteDoc(doc(symptomsCol(username), symptomId));
}

// --- Settings (activeChildId, onboardingComplete) ---
export async function saveUserSettings(username, settings) {
  await setDoc(userRef(username), settings, { merge: true });
}

// --- Real-time listeners ---
export function subscribeToUserData(username, onData) {
  const unsubscribers = [];

  // Listen to user settings
  unsubscribers.push(
    onSnapshot(userRef(username), (snap) => {
      if (snap.exists()) {
        onData('settings', snap.data());
      }
    })
  );

  // Listen to children
  unsubscribers.push(
    onSnapshot(childrenCol(username), (snap) => {
      const children = snap.docs.map(d => d.data());
      onData('children', children);
    })
  );

  // Listen to meals (ordered by timestamp desc)
  unsubscribers.push(
    onSnapshot(query(mealsCol(username), orderBy('timestamp', 'desc')), (snap) => {
      const meals = snap.docs.map(d => d.data());
      onData('meals', meals);
    })
  );

  // Listen to symptoms
  unsubscribers.push(
    onSnapshot(query(symptomsCol(username), orderBy('timestamp', 'desc')), (snap) => {
      const symptoms = snap.docs.map(d => d.data());
      onData('symptoms', symptoms);
    })
  );

  return () => unsubscribers.forEach(unsub => unsub());
}
