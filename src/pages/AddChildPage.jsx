import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import AddChildForm from '../components/onboarding/AddChildForm';

export default function AddChildPage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const handleAdd = (child) => {
    dispatch({ type: 'ADD_CHILD', payload: child });
    navigate('/settings');
  };

  return (
    <AddChildForm
      onAdd={handleAdd}
      onBack={() => navigate('/settings')}
      childIndex={state.children.length}
      title="Kind hinzufügen"
      subtitle="Füge ein weiteres Kind hinzu"
      submitLabel="Kind speichern"
      username={state.currentUser}
    />
  );
}
