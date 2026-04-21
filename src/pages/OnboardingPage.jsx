import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import WelcomeScreen from '../components/onboarding/WelcomeScreen';
import AddChildForm from '../components/onboarding/AddChildForm';
import OnboardingSummary from '../components/onboarding/OnboardingSummary';

const STEPS = { WELCOME: 'welcome', ADD_CHILD: 'add_child', SUMMARY: 'summary' };

export default function OnboardingPage() {
  const { state, dispatch } = useApp();
  const [step, setStep] = useState(STEPS.WELCOME);

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
      return <WelcomeScreen onNext={() => setStep(STEPS.ADD_CHILD)} />;

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
