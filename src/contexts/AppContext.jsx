import { createContext, useContext, useReducer, useEffect } from 'react';

const AppContext = createContext(null);

const initialState = {
  loggedIn: false,
  currentUser: null,
  onboardingComplete: false,
  children: [],
  activeChildId: null,
  meals: [],
  symptoms: [],
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_LOGGED_IN':
      return { ...state, loggedIn: true, currentUser: action.payload.username };

    case 'LOGOUT':
      return { ...state, loggedIn: false, currentUser: null };

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

    case 'LOAD_STATE':
      return { ...state, ...action.payload };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

export function AppProvider({ children: reactChildren }) {
  const [state, dispatch] = useReducer(appReducer, initialState, (init) => {
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

  useEffect(() => {
    localStorage.setItem('habeat-state', JSON.stringify(state));
  }, [state]);

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
