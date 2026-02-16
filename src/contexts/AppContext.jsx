import { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import {
  saveChild, updateChild, removeChild as removeChildFromDb, saveMeal, updateMeal,
  saveSymptom, removeSymptom as removeSymptomFromDb,
  saveGrowthEntry, removeGrowthEntry as removeGrowthEntryFromDb,
  saveUserSettings, subscribeToUserData, uploadSymptomPhoto,
} from '../lib/firestore';

const AppContext = createContext(null);

const initialState = {
  loggedIn: false,
  currentUser: null,
  grandparentMode: false,
  grandparentFor: null,
  onboardingComplete: false,
  children: [],
  activeChildId: null,
  meals: [],
  symptoms: [],
  growthEntries: [],
  emergencyContacts: [],
  firestoreReady: false,
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_LOGGED_IN':
      return { ...initialState, loggedIn: true, currentUser: action.payload.username };

    case 'SET_GRANDPARENT_MODE':
      return {
        ...initialState,
        loggedIn: true,
        grandparentMode: true,
        grandparentFor: action.payload.username,
        currentUser: action.payload.username,
      };

    case 'LOGOUT':
      // Clear per-user localStorage so stale data can't leak into another session
      if (state.currentUser) {
        localStorage.removeItem(storageKey(state.currentUser));
      }
      localStorage.removeItem('habeat-last-user');
      return { ...initialState };

    case 'SET_ONBOARDING_COMPLETE':
      return { ...state, onboardingComplete: true };

    case 'ADD_CHILD':
      return {
        ...state,
        children: [...state.children, action.payload],
        activeChildId: state.activeChildId || action.payload.id,
      };

    case 'UPDATE_CHILD':
      return {
        ...state,
        children: state.children.map(c =>
          c.id === action.payload.id ? { ...c, ...action.payload } : c
        ),
      };

    case 'REMOVE_CHILD':
      return {
        ...state,
        children: state.children.filter(c => c.id !== action.payload),
        activeChildId:
          state.activeChildId === action.payload
            ? state.children.find(c => c.id !== action.payload)?.id || null
            : state.activeChildId,
      };

    case 'SET_ACTIVE_CHILD':
      return { ...state, activeChildId: action.payload };

    case 'ADD_MEAL':
      return { ...state, meals: [action.payload, ...state.meals] };

    case 'UPDATE_MEAL':
      return {
        ...state,
        meals: state.meals.map(m =>
          m.id === action.payload.id ? { ...m, ...action.payload } : m
        ),
      };

    case 'ADD_SYMPTOM':
      return { ...state, symptoms: [action.payload, ...state.symptoms] };

    case 'UPDATE_SYMPTOM':
      return {
        ...state,
        symptoms: state.symptoms.map(s =>
          s.id === action.payload.id ? { ...s, ...action.payload } : s
        ),
      };

    case 'REMOVE_SYMPTOM':
      return {
        ...state,
        symptoms: state.symptoms.filter(s => s.id !== action.payload),
      };

    case 'ADD_GROWTH_ENTRY':
      return { ...state, growthEntries: [action.payload, ...state.growthEntries] };

    case 'REMOVE_GROWTH_ENTRY':
      return {
        ...state,
        growthEntries: state.growthEntries.filter(g => g.id !== action.payload),
      };

    case 'ADD_EMERGENCY_CONTACT':
      return { ...state, emergencyContacts: [...state.emergencyContacts, action.payload] };

    case 'UPDATE_EMERGENCY_CONTACT':
      return {
        ...state,
        emergencyContacts: state.emergencyContacts.map(c =>
          c.id === action.payload.id ? { ...c, ...action.payload } : c
        ),
      };

    case 'REMOVE_EMERGENCY_CONTACT':
      return {
        ...state,
        emergencyContacts: state.emergencyContacts.filter(c => c.id !== action.payload),
      };

    case 'LOAD_STATE':
      return { ...state, ...action.payload };

    case 'SYNC_FIRESTORE':
      return { ...state, ...action.payload, firestoreReady: true };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// Fire-and-forget Firestore sync — errors are logged, not thrown
function syncToFirestore(username, action) {
  if (!username) return;

  try {
    switch (action.type) {
      case 'ADD_CHILD':
        saveChild(username, action.payload);
        break;
      case 'UPDATE_CHILD':
        updateChild(username, action.payload);
        break;
      case 'REMOVE_CHILD':
        removeChildFromDb(username, action.payload);
        break;
      case 'ADD_MEAL':
        saveMeal(username, action.payload);
        break;
      case 'UPDATE_MEAL':
        updateMeal(username, action.payload);
        break;
      case 'ADD_SYMPTOM':
        saveSymptom(username, action.payload);
        // Upload photo to Firebase Storage if present (async, fire-and-forget)
        if (action.payload.photoUrl) {
          uploadSymptomPhoto(username, action.payload.id, action.payload.photoUrl)
            .catch(err => console.error('Symptom photo upload error:', err));
        }
        break;
      case 'REMOVE_SYMPTOM':
        removeSymptomFromDb(username, action.payload);
        break;
      case 'ADD_GROWTH_ENTRY':
        saveGrowthEntry(username, action.payload);
        break;
      case 'REMOVE_GROWTH_ENTRY':
        removeGrowthEntryFromDb(username, action.payload);
        break;
      case 'ADD_EMERGENCY_CONTACT':
      case 'UPDATE_EMERGENCY_CONTACT':
      case 'REMOVE_EMERGENCY_CONTACT':
        // Synced via useEffect on emergencyContacts
        break;
      case 'SET_ONBOARDING_COMPLETE':
        saveUserSettings(username, { onboardingComplete: true });
        break;
      case 'SET_ACTIVE_CHILD':
        saveUserSettings(username, { activeChildId: action.payload });
        break;
    }
  } catch (err) {
    console.error('Firestore sync error:', err);
  }
}

/**
 * Upload all local data to Firestore if Firestore is empty.
 * This handles the case where the user already has local data but Firestore
 * was just enabled — we seed Firestore from localStorage.
 */
function seedFirestoreFromLocal(username, localState) {
  if (!username) return;

  if (localState.onboardingComplete || localState.activeChildId) {
    saveUserSettings(username, {
      onboardingComplete: localState.onboardingComplete,
      activeChildId: localState.activeChildId,
    });
  }
  localState.children.forEach(child => saveChild(username, child));
  localState.meals.forEach(meal => saveMeal(username, meal));
  localState.symptoms.forEach(symptom => saveSymptom(username, symptom));
  (localState.growthEntries || []).forEach(entry => saveGrowthEntry(username, entry));
}

function storageKey(username) {
  return username ? `habeat-state-${username.toLowerCase()}` : 'habeat-state';
}

export function AppProvider({ children: reactChildren }) {
  const [state, rawDispatch] = useReducer(appReducer, initialState, (init) => {
    // Try to restore the last active session
    const lastUser = localStorage.getItem('habeat-last-user');
    const key = lastUser ? storageKey(lastUser) : 'habeat-state';
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return { ...init, ...JSON.parse(saved) };
      } catch {
        return init;
      }
    }
    return init;
  });

  const firestoreListening = useRef(false);
  const seededRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Wrapped dispatch that also syncs to Firestore
  const dispatch = useCallback((action) => {
    rawDispatch(action);
    syncToFirestore(stateRef.current.currentUser, action);
  }, []);

  // Save to per-user localStorage (skip for grandparent mode — they don't own the data)
  useEffect(() => {
    if (state.grandparentMode) return;
    const key = storageKey(state.currentUser);
    localStorage.setItem(key, JSON.stringify(state));
    if (state.currentUser) {
      localStorage.setItem('habeat-last-user', state.currentUser.toLowerCase());
    }
  }, [state]);

  // Sync emergency contacts to Firestore (not in grandparent mode)
  useEffect(() => {
    if (state.currentUser && state.firestoreReady && !state.grandparentMode) {
      saveUserSettings(state.currentUser, { emergencyContacts: state.emergencyContacts });
    }
  }, [state.emergencyContacts, state.currentUser, state.firestoreReady, state.grandparentMode]);

  // Reset seeded flag on user change so new accounts don't skip seeding
  useEffect(() => {
    seededRef.current = false;
  }, [state.currentUser]);

  // Subscribe to Firestore when logged in
  useEffect(() => {
    if (!state.loggedIn || !state.currentUser || firestoreListening.current) return;
    firestoreListening.current = true;

    // Capture the username this listener was created for
    const listenerUser = state.currentUser;

    const unsub = subscribeToUserData(state.currentUser, (type, data) => {
      const current = stateRef.current;

      // Guard: ignore callbacks if the user has changed (race condition on account switch)
      if (current.currentUser !== listenerUser) return;

      switch (type) {
        case 'settings':
          rawDispatch({
            type: 'SYNC_FIRESTORE',
            payload: {
              onboardingComplete: data.onboardingComplete ?? current.onboardingComplete,
              activeChildId: data.activeChildId ?? current.activeChildId,
              ...(data.emergencyContacts ? { emergencyContacts: data.emergencyContacts } : {}),
            },
          });
          break;
        case 'children':
          // If Firestore is empty but we have local data, seed Firestore
          if (data.length === 0 && current.children.length > 0 && !seededRef.current) {
            seededRef.current = true;
            seedFirestoreFromLocal(current.currentUser, current);
            return; // Don't overwrite local — Firestore will trigger again after seeding
          }
          if (data.length > 0) {
            // Merge Firestore children with local data: if Firestore has
            // an incomplete record (e.g. missing name due to a failed
            // initial save), fill in gaps from the local copy.
            const mergedChildren = data
              .filter(c => c && c.id)
              .map(fsChild => {
                const localChild = current.children.find(c => c.id === fsChild.id);
                // Local data fills gaps, Firestore data wins for fields it has
                return {
                  ...(localChild || {}),
                  ...fsChild,
                  photoUrl: localChild?.photoUrl || null,
                };
              })
              .filter(c => c.name); // only keep children that have a name after merge

            // Preserve local-only children that haven't synced to Firestore yet
            // (e.g. initial saveChild failed due to network error)
            const firestoreIds = new Set(data.map(c => c.id));
            const localOnly = current.children.filter(
              c => c && c.id && c.name && !firestoreIds.has(c.id)
            );
            // Re-try saving local-only children to Firestore
            localOnly.forEach(c => saveChild(current.currentUser, c));

            rawDispatch({
              type: 'SYNC_FIRESTORE',
              payload: { children: [...mergedChildren, ...localOnly] },
            });
          }
          break;
        case 'meals':
          if (data.length === 0 && current.meals.length > 0) return;
          // Preserve local imageUrl (not stored in Firestore, base64 too large)
          const mergedMeals = data.map(fsMeal => {
            const localMeal = current.meals.find(m => m.id === fsMeal.id);
            return {
              ...fsMeal,
              imageUrl: localMeal?.imageUrl || null,
              afterImageUrl: localMeal?.afterImageUrl || null,
            };
          });
          rawDispatch({ type: 'SYNC_FIRESTORE', payload: { meals: mergedMeals } });
          break;
        case 'symptoms':
          if (data.length === 0 && current.symptoms.length > 0) return;
          // Preserve local photoUrl (base64) and merge with Firestore photoStorageUrl
          const mergedSymptoms = data.map(fsSymptom => {
            const localSymptom = current.symptoms.find(s => s.id === fsSymptom.id);
            return {
              ...fsSymptom,
              photoUrl: localSymptom?.photoUrl || null,
            };
          });
          rawDispatch({ type: 'SYNC_FIRESTORE', payload: { symptoms: mergedSymptoms } });
          break;
        case 'growth':
          if (data.length === 0 && (current.growthEntries || []).length > 0) return;
          rawDispatch({ type: 'SYNC_FIRESTORE', payload: { growthEntries: data } });
          break;
      }
    });

    return () => {
      unsub();
      firestoreListening.current = false;
    };
  }, [state.loggedIn, state.currentUser]);

  const activeChild = state.children.find(c => c.id === state.activeChildId) || null;

  return (
    <AppContext.Provider value={{ state, dispatch, activeChild }}>
      {reactChildren}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
