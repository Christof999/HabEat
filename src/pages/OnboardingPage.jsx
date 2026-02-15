import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import WelcomeScreen from '../components/onboarding/WelcomeScreen';
import AddChildForm from '../components/onboarding/AddChildForm';
import OnboardingSummary from '../components/onboarding/OnboardingSummary';

const STEPS = { WELCOME: 'welcome', ADD_CHILD: 'add_child', SUMMARY: 'summary' };

export default function OnboardingPage() {
  const { state, dispatch } = useApp();
  const [step, setStep] = useState(STEPS.WELCOME);

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
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

  let content;
  switch (step) {
    case STEPS.ADD_CHILD:
      content = (
        <AddChildForm
          onAdd={handleAddChild}
          onBack={() =>
            state.children.length > 0 ? setStep(STEPS.SUMMARY) : setStep(STEPS.WELCOME)
          }
          childIndex={state.children.length}
        />
      );
      break;
    case STEPS.SUMMARY:
      content = (
        <OnboardingSummary
          children={state.children}
          onAddAnother={() => setStep(STEPS.ADD_CHILD)}
          onComplete={handleComplete}
          onRemoveChild={handleRemoveChild}
        />
      );
      break;
    default:
      content = <WelcomeScreen onNext={() => setStep(STEPS.ADD_CHILD)} />;
  }

  return (
    <div className="relative min-h-screen">
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer bg-white/80 backdrop-blur-sm shadow-sm"
      >
        <LogOut className="w-4 h-4" />
        Abmelden
      </button>
      {content}
    </div>
  );
}
