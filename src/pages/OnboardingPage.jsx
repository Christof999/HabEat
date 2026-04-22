import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { loadUserStateBackup } from '../lib/stateBackup';
import WelcomeScreen from '../components/onboarding/WelcomeScreen';
import AddChildForm from '../components/onboarding/AddChildForm';
import OnboardingSummary from '../components/onboarding/OnboardingSummary';

const STEPS = { WELCOME: 'welcome', ADD_CHILD: 'add_child', SUMMARY: 'summary' };

export default function OnboardingPage() {
  const { state, dispatch } = useApp();
  const [step, setStep] = useState(STEPS.WELCOME);

  const localBackup = useMemo(
    () => (state.currentUser ? loadUserStateBackup(state.currentUser) : null),
    [state.currentUser],
  );

  const handleRestoreBackup = () => {
    if (!localBackup?.children?.length) return;
    if (!confirm('Lokale Sicherung wiederherstellen? (Kinder und Mahlzeiten vom letzten Stand)')) return;
    dispatch({ type: 'RESTORE_FROM_LOCAL_BACKUP', payload: localBackup });
  };

  const handleAddChild = (child) => {
    dispatch({ type: 'ADD_CHILD', payload: child });
    setStep(STEPS.SUMMARY);
  };

  const handleRemoveChild = (id) => {
    dispatch({ type: 'REMOVE_CHILD', payload: id });
    if (state.children.length <= 1) {
      setStep(STEPS.ADD_CHILD);
    }
  };

  const handleComplete = () => {
    dispatch({ type: 'SET_ONBOARDING_COMPLETE' });
  };

  switch (step) {
    case STEPS.WELCOME:
      return (
        <div>
          {state.loggedIn && state.children.length === 0 && localBackup?.children?.length > 0 && (
            <div className="px-6 pt-6 max-w-lg mx-auto">
              <div className="rounded-2xl border border-sage-200 bg-sage-50/80 p-4 text-sm text-gray-700">
                <p className="font-medium text-gray-800 mb-2">Lokale Sicherung gefunden</p>
                <p className="text-xs text-gray-600 mb-3">
                  Es gibt noch gespeicherte Kinderdaten auf diesem Gerät. Du kannst sie wiederherstellen,
                  statt neu anzufangen.
                </p>
                <button
                  type="button"
                  onClick={handleRestoreBackup}
                  className="w-full py-2.5 rounded-xl bg-sage-600 text-white text-sm font-semibold cursor-pointer hover:bg-sage-700"
                >
                  Daten wiederherstellen
                </button>
              </div>
            </div>
          )}
          <WelcomeScreen onNext={() => setStep(STEPS.ADD_CHILD)} />
        </div>
      );

    case STEPS.ADD_CHILD:
      return (
        <AddChildForm
          onAdd={handleAddChild}
          onBack={() =>
            state.children.length > 0 ? setStep(STEPS.SUMMARY) : setStep(STEPS.WELCOME)
          }
          childIndex={state.children.length}
        />
      );

    case STEPS.SUMMARY:
      return (
        <OnboardingSummary
          children={state.children}
          onAddAnother={() => setStep(STEPS.ADD_CHILD)}
          onComplete={handleComplete}
          onRemoveChild={handleRemoveChild}
        />
      );

    default:
      return <WelcomeScreen onNext={() => setStep(STEPS.ADD_CHILD)} />;
  }
}
