import { useState } from 'react';
import { X, AlertTriangle, ThermometerSun, Moon, Frown, Wind, HelpCircle, Check } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

const symptomTypes = [
  { id: 'skin', label: 'Haut', sublabel: 'Ausschlag, Rötung, Juckreiz', icon: ThermometerSun, color: 'bg-rose-50 text-rose-600' },
  { id: 'digestion', label: 'Verdauung', sublabel: 'Durchfall, Erbrechen, Bauchschmerzen', icon: AlertTriangle, color: 'bg-warm-50 text-warm-600' },
  { id: 'sleep', label: 'Schlaf', sublabel: 'Unruhe, Aufwachen, Weinen', icon: Moon, color: 'bg-sky-50 text-sky-600' },
  { id: 'mood', label: 'Stimmung', sublabel: 'Quengelig, Appetitlosigkeit', icon: Frown, color: 'bg-sage-50 text-sage-600' },
  { id: 'breathing', label: 'Atmung', sublabel: 'Husten, Schnupfen, Keuchen', icon: Wind, color: 'bg-sky-50 text-sky-700' },
  { id: 'other', label: 'Sonstiges', sublabel: 'Andere Beobachtungen', icon: HelpCircle, color: 'bg-gray-50 text-gray-600' },
];

const severityLevels = [
  { value: 1, label: 'Leicht', color: 'bg-sage-100 text-sage-700 ring-sage-300' },
  { value: 2, label: 'Mild', color: 'bg-sky-100 text-sky-700 ring-sky-300' },
  { value: 3, label: 'Mittel', color: 'bg-warm-100 text-warm-700 ring-warm-300' },
  { value: 4, label: 'Stark', color: 'bg-rose-100 text-rose-700 ring-rose-300' },
  { value: 5, label: 'Sehr stark', color: 'bg-rose-200 text-rose-800 ring-rose-400' },
];

export default function SymptomLogger({ onClose }) {
  const { state, dispatch } = useApp();
  const [selectedType, setSelectedType] = useState(null);
  const [severity, setSeverity] = useState(3);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!selectedType) return;

    const symptom = {
      id: crypto.randomUUID(),
      childId: state.activeChildId,
      type: selectedType,
      severity,
      notes: notes.trim(),
      timestamp: new Date().toISOString(),
    };

    dispatch({ type: 'ADD_SYMPTOM', payload: symptom });
    setSaved(true);
    setTimeout(() => onClose(), 1200);
  };

  if (saved) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg p-8 flex flex-col items-center safe-bottom">
          <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-sage-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">Symptom erfasst</h3>
          <p className="text-sm text-gray-500 mt-1">Der Detektiv analysiert die Daten.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto safe-bottom">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl px-6 py-5 border-b border-gray-100 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Symptom erfassen</h2>
            <p className="text-xs text-gray-400 mt-0.5">Was ist dir aufgefallen?</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Symptom Type Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-3 block">Art des Symptoms</label>
            <div className="grid grid-cols-2 gap-2">
              {symptomTypes.map(type => {
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`p-3 rounded-xl text-left transition cursor-pointer border-2 ${
                      isSelected
                        ? 'border-sage-400 bg-sage-50'
                        : 'border-transparent bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${type.color} flex items-center justify-center mb-2`}>
                      <type.icon className="w-4 h-4" />
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{type.label}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{type.sublabel}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severity */}
          {selectedType && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">
                Schweregrad: <span className="text-sage-600">{severityLevels[severity - 1].label}</span>
              </label>
              <div className="flex gap-2">
                {severityLevels.map(level => (
                  <button
                    key={level.value}
                    onClick={() => setSeverity(level.value)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      severity === level.value
                        ? `${level.color} ring-2`
                        : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {level.value}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {selectedType && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Notizen (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="z.B. Rote Flecken an den Wangen, nach dem Mittagessen..."
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-sm text-gray-800 placeholder:text-gray-400 resize-none"
              />
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!selectedType}
            className={`w-full py-4 rounded-2xl font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
              selectedType
                ? 'bg-sage-500 hover:bg-sage-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Check className="w-5 h-5" />
            Symptom speichern
          </button>
        </div>
      </div>
    </div>
  );
}
