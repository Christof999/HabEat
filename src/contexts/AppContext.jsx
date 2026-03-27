import { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import {
  saveChild, removeChild as removeChildFromDb, saveMeal,
  saveSymptom, removeSymptom as removeSymptomFromDb,
  saveUserSettings, subscribeToUserData,
} from '../lib/firestore';
import { isAdultNutritionUser } from '../lib/userProfile';

const AppContext = createContext(null);

const initialState = {
  loggedIn: false,
  currentUser: null,
  /** Beim Login gesetzt: Ernährungs-KI ohne Kleinkind-Fokus (Thomas, Martina). */
  adultNutrition: false,
  onboardingComplete: false,
  children: [],
  activeChildId: null,
  meals: [],
  symptoms: [],
  firestoreReady: false,
};

function normalizeChild(child) {
  if (!child || typeof child !== 'object') return null;

  const safeId = typeof child.id === 'string' ? child.id.trim() : '';
  const safeName = typeof child.name === 'string' ? child.name.trim() : '';

  if (!safeId || !safeName) return null;

  const knownAllergies = Array.isArray(child?.knownAllergies)
    ? child.knownAllergies
    : Array.isArray(child?.allergies)
      ? child.allergies
      : [];

  return {
    ...child,
    id: safeId,
    name: safeName,
    knownAllergies,
    allergies: knownAllergies,
  };
}

function normalizeChildrenList(children) {
  if (!Array.isArray(children)) return [];
  return children.map(normalizeChild).filter(Boolean);
}

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_LOGGED_IN':
      return {
        ...initialState,
        loggedIn: true,
        currentUser: action.payload.username,
        adultNutrition: isAdultNutritionUser(action.payload.username),
      };

    case 'LOGOUT':
      return { ...initialState };

    case 'SET_ONBOARDING_COMPLETE':
      return { ...state, onboardingComplete: true };

    case 'ADD_CHILD':
      if (!normalizeChild(action.payload)) return state;
      return {
        ...state,
        children: [...state.children, normalizeChild(action.payload)],
        activeChildId: state.activeChildId || action.payload.id,
      };

    case 'UPDATE_CHILD':
      return {
        ...state,
        children: state.children.map(c =>
          c.id === action.payload.id ? normalizeChild({ ...c, ...action.payload }) : c
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

    case 'LOAD_STATE':
      {
        const children = normalizeChildrenList(action.payload?.children);
        const activeChildId = children.some(c => c.id === action.payload?.activeChildId)
          ? action.payload?.activeChildId
          : children[0]?.id || null;

        return {
          ...state,
          ...action.payload,
          children,
          activeChildId,
        };
      }

    case 'SYNC_FIRESTORE':
      {
        if (Object.prototype.hasOwnProperty.call(action.payload || {}, 'children')) {
          const children = normalizeChildrenList(action.payload.children);
          const activeChildId = children.some(c => c.id === state.activeChildId)
            ? state.activeChildId
            : children[0]?.id || null;

          return {
            ...state,
            ...action.payload,
            children,
            activeChildId,
            firestoreReady: true,
          };
        }

        return { ...state, ...action.payload, firestoreReady: true };
      }

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

export function AppProvider({ children: reactChildren }) {
  const [state, rawDispatch] = useReducer(appReducer, initialState, (init) => {
    const saved = localStorage.getItem('habeat-state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const children = normalizeChildrenList(parsed.children);
        const activeChildId = children.some(c => c.id === parsed.activeChildId)
          ? parsed.activeChildId
          : children[0]?.id || null;

        const merged = { ...init, ...parsed, children, activeChildId };
        merged.adultNutrition = merged.loggedIn && isAdultNutritionUser(merged.currentUser);
        return merged;
      } catch {
        return init;
      }
    }
    return init;
  });

  const firestoreListening = useRef(false);

  // Wrapped dispatch that also syncs to Firestore
  const dispatch = (action) => {
    rawDispatch(action);

    if (action.type === 'UPDATE_MEAL') {
      const currentMeal = state.meals.find(m => m.id === action.payload.id);
      if (currentMeal) {
        syncToFirestore(state.currentUser, {
          ...action,
          payload: { ...currentMeal, ...action.payload },
        });
        return;
      }
    }

    syncToFirestore(state.currentUser, action);
  };

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('habeat-state', JSON.stringify(state));
  }, [state]);

  // Subscribe to Firestore when logged in
  useEffect(() => {
    if (!state.loggedIn || !state.currentUser || firestoreListening.current) return;
    firestoreListening.current = true;

    const unsub = subscribeToUserData(state.currentUser, (type, data) => {
      switch (type) {
        case 'settings':
          rawDispatch({
            type: 'SYNC_FIRESTORE',
            payload: {
              onboardingComplete: data.onboardingComplete ?? false,
              activeChildId: data.activeChildId ?? null,
            },
          });
          break;
        case 'children':
          rawDispatch({
            type: 'SYNC_FIRESTORE',
            payload: { children: normalizeChildrenList(data) },
          });
          break;
        case 'meals':
          rawDispatch({ type: 'SYNC_FIRESTORE', payload: { meals: data } });
          break;
        case 'symptoms':
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
