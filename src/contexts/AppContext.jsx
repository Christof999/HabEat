import { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import {
  saveChild, removeChild as removeChildFromDb, saveMeal,
  saveSymptom, removeSymptom as removeSymptomFromDb,
  saveUserSettings, subscribeToUserData,
} from '../lib/firestore';

const AppContext = createContext(null);

const initialState = {
  loggedIn: false,
  currentUser: null,
  onboardingComplete: false,
  children: [],
  activeChildId: null,
  meals: [],
  symptoms: [],
  emergencyContacts: [],
  firestoreReady: false,
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_LOGGED_IN':
      return { ...state, loggedIn: true, currentUser: action.payload.username };

    case 'LOGOUT':
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
      case 'UPDATE_CHILD':
        saveChild(username, action.payload);
        break;
      case 'REMOVE_CHILD':
        removeChildFromDb(username, action.payload);
        break;
      case 'ADD_MEAL':
      case 'UPDATE_MEAL':
        saveMeal(username, action.payload);
        break;
      case 'ADD_SYMPTOM':
        saveSymptom(username, action.payload);
        break;
      case 'REMOVE_SYMPTOM':
        removeSymptomFromDb(username, action.payload);
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
}

export function AppProvider({ children: reactChildren }) {
  const [state, rawDispatch] = useReducer(appReducer, initialState, (init) => {
    const saved = localStorage.getItem('habeat-state');
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

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('habeat-state', JSON.stringify(state));
  }, [state]);

  // Sync emergency contacts to Firestore
  useEffect(() => {
    if (state.currentUser && state.firestoreReady) {
      saveUserSettings(state.currentUser, { emergencyContacts: state.emergencyContacts });
    }
  }, [state.emergencyContacts, state.currentUser, state.firestoreReady]);

  // Subscribe to Firestore when logged in
  useEffect(() => {
    if (!state.loggedIn || !state.currentUser || firestoreListening.current) return;
    firestoreListening.current = true;

    const unsub = subscribeToUserData(state.currentUser, (type, data) => {
      const current = stateRef.current;

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
            // Preserve local photoUrl (not stored in Firestore, base64 too large)
            const mergedChildren = data.map(fsChild => {
              const localChild = current.children.find(c => c.id === fsChild.id);
              return { ...fsChild, photoUrl: localChild?.photoUrl || null };
            });
            rawDispatch({ type: 'SYNC_FIRESTORE', payload: { children: mergedChildren } });
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
          rawDispatch({ type: 'SYNC_FIRESTORE', payload: { symptoms: data } });
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
