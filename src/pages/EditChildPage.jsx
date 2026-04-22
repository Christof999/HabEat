import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import AddChildForm from '../components/onboarding/AddChildForm';

export default function EditChildPage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { childId } = useParams();

  const child = state.children.find((item) => item.id === childId);

  if (!child) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center px-6">
        <p className="text-gray-500">Kind wurde nicht gefunden.</p>
      </div>
    );
  }

  const handleSave = (updatedChild) => {
    dispatch({ type: 'UPDATE_CHILD', payload: updatedChild });
    navigate('/settings');
  };

  return (
    <AddChildForm
      onAdd={handleSave}
      onBack={() => navigate('/settings')}
      initialChild={child}
      title="Kind bearbeiten"
      subtitle="Daten des Kindes aktualisieren"
      submitLabel="Änderungen speichern"
      mode="edit"
    />
  );
}
