import { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import {
  saveChild, removeChild as removeChildFromDb, saveMeal,
  saveSymptom, removeSymptom as removeSymptomFromDb,
  saveUserSettings, subscribeToUserData,
} from '../lib/firestore';
import { isAdultNutritionUser } from '../lib/userProfile';
import {
  normalizeGrowthMeasurements,
  migrateGrowthMeasurements,
  mergeChildGrowthForSync,
} from '../lib/childGrowth';
import { saveUserStateBackup, loadUserStateBackup, userBackupKey } from '../lib/stateBackup';

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
  const rawName = typeof child.name === 'string' ? child.name.trim() : '';
  const safeName = rawName || 'Kind';

  if (!safeId) return null;

  const knownAllergies = Array.isArray(child?.knownAllergies)
    ? child.knownAllergies
    : Array.isArray(child?.allergies)
      ? child.allergies
      : [];

  const sex = child.sex === 'female' || child.sex === 'male' ? child.sex : null;
  let growthMeasurements = normalizeGrowthMeasurements(child.growthMeasurements);
  if (growthMeasurements.length === 0) {
    growthMeasurements = migrateGrowthMeasurements({ ...child, id: safeId, knownAllergies });
  }

  return {
    ...child,
    id: safeId,
    name: safeName,
    knownAllergies,
    allergies: knownAllergies,
    sex,
    growthMeasurements,
  };
}

function normalizeChildrenList(children) {
  if (!Array.isArray(children)) return [];
  return children.map(normalizeChild).filter(Boolean);
}

/**
 * Beim Login: niemals lokale Kinder/Mahlzeiten verwerfen (vorheriger Bug: nur initialState).
 * Nutzt gleichen Benutzer im State oder separates Backup pro Benutzer.
 */
function mergeStateForLogin(prevState, loginUsername) {
  const u = String(loginUsername || '').trim();
  const lower = u.toLowerCase();
  const sameSessionUser = prevState.currentUser
    && String(prevState.currentUser).toLowerCase() === lower
    && prevState.loggedIn;

  let preserved = null;
  if (sameSessionUser && prevState.children?.length > 0) {
    preserved = {
      children: prevState.children,
      meals: prevState.meals,
      symptoms: prevState.symptoms,
      onboardingComplete: prevState.onboardingComplete,
      activeChildId: prevState.activeChildId,
    };
  } else {
    const backup = loadUserStateBackup(u);
    if (backup && Array.isArray(backup.children) && backup.children.length > 0) {
      preserved = {
        children: backup.children,
        meals: Array.isArray(backup.meals) ? backup.meals : [],
        symptoms: Array.isArray(backup.symptoms) ? backup.symptoms : [],
        onboardingComplete: !!backup.onboardingComplete,
        activeChildId: backup.activeChildId ?? null,
      };
    } else {
      try {
        const raw = localStorage.getItem('habeat-state');
        if (raw) {
          const parsed = JSON.parse(raw);
          const storedUser = parsed?.currentUser && String(parsed.currentUser).toLowerCase();
          if (storedUser === lower && Array.isArray(parsed.children) && parsed.children.length > 0) {
            preserved = {
              children: parsed.children,
              meals: Array.isArray(parsed.meals) ? parsed.meals : [],
              symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms : [],
              onboardingComplete: !!parsed.onboardingComplete,
              activeChildId: parsed.activeChildId ?? null,
            };
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (!preserved) {
    return {
      ...initialState,
      loggedIn: true,
      currentUser: u,
      adultNutrition: isAdultNutritionUser(u),
    };
  }

  const children = normalizeChildrenList(preserved.children);
  const activeChildId = children.some(c => c.id === preserved.activeChildId)
    ? preserved.activeChildId
    : children[0]?.id || null;

  return {
    ...initialState,
    loggedIn: true,
    currentUser: u,
    adultNutrition: isAdultNutritionUser(u),
    onboardingComplete: preserved.onboardingComplete,
    activeChildId,
    children,
    meals: preserved.meals,
    symptoms: preserved.symptoms,
  };
}

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_LOGGED_IN':
      return mergeStateForLogin(state, action.payload.username);

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
          const remoteList = action.payload.children;
          /** Leere Snapshots (Regeln, Netzwerk, Timing) dürfen lokale Kinder nicht löschen. */
          if (
            Array.isArray(remoteList)
            && remoteList.length === 0
            && state.children.length > 0
          ) {
            return { ...state, firestoreReady: true };
          }

          const merged = Array.isArray(remoteList)
            ? remoteList.map((remote) => {
                const local = state.children.find((c) => c.id === remote.id);
                let out = remote;
                if (local) {
                  const lp = local?.photoUrl;
                  if (typeof lp === 'string' && lp.startsWith('data:image/')) {
                    out = { ...out, photoUrl: lp };
                  }
                  out = {
                    ...out,
                    growthMeasurements: mergeChildGrowthForSync(local, out),
                  };
                }
                return out;
              })
            : [];
          let children = normalizeChildrenList(merged);
          if (children.length === 0 && state.children.length > 0) {
            children = state.children;
          }
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

        const p = { ...action.payload };
        if (p.onboardingComplete === false && state.children.length > 0) {
          delete p.onboardingComplete;
        }
        return { ...state, ...p, firestoreReady: true };
      }

    case 'RESET':
      return initialState;

    case 'RESTORE_FROM_LOCAL_BACKUP':
      {
        const b = action.payload;
        if (!b || !Array.isArray(b.children) || b.children.length === 0) return state;
        const children = normalizeChildrenList(b.children);
        const activeChildId = children.some(c => c.id === b.activeChildId)
          ? b.activeChildId
          : children[0]?.id || null;
        return {
          ...state,
          onboardingComplete: b.onboardingComplete !== false,
          activeChildId,
          children,
          meals: Array.isArray(b.meals) ? b.meals : state.meals,
          symptoms: Array.isArray(b.symptoms) ? b.symptoms : state.symptoms,
        };
      }

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
  const triedBackupRestore = useRef(false);

  // Wrapped dispatch that also syncs to Firestore
  const dispatch = (action) => {
    if (action.type === 'LOGOUT' && state.currentUser) {
      saveUserStateBackup(state.currentUser, {
        onboardingComplete: state.onboardingComplete,
        activeChildId: state.activeChildId,
        children: state.children,
        meals: state.meals,
        symptoms: state.symptoms,
      });
    }
    if (action.type === 'RESET' && state.currentUser) {
      try {
        localStorage.removeItem(userBackupKey(state.currentUser));
      } catch {
        /* ignore */
      }
    }
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

  // Einmalig: wenn State leer aber Backup für diesen Benutzer existiert (z. B. habeat-state überschrieben)
  useEffect(() => {
    if (!state.loggedIn || !state.currentUser || triedBackupRestore.current) return;
    if (state.children.length > 0) {
      triedBackupRestore.current = true;
      return;
    }
    const b = loadUserStateBackup(state.currentUser);
    if (b?.children?.length) {
      rawDispatch({ type: 'RESTORE_FROM_LOCAL_BACKUP', payload: b });
    }
    triedBackupRestore.current = true;
  }, [state.loggedIn, state.currentUser, state.children.length]);

  // Save to localStorage + pro-Benutzer-Backup (gegen versehentliches Überschreiben)
  useEffect(() => {
    localStorage.setItem('habeat-state', JSON.stringify(state));
    if (state.loggedIn && state.currentUser) {
      const hasData = state.children.length > 0
        || state.meals.length > 0
        || state.symptoms.length > 0
        || state.onboardingComplete;
      if (hasData) {
        saveUserStateBackup(state.currentUser, {
          onboardingComplete: state.onboardingComplete,
          activeChildId: state.activeChildId,
          children: state.children,
          meals: state.meals,
          symptoms: state.symptoms,
        });
      }
    }
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
              ...(data.onboardingComplete !== undefined && {
                onboardingComplete: data.onboardingComplete,
              }),
              ...(data.activeChildId !== undefined && { activeChildId: data.activeChildId }),
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
