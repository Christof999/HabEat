import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import ChildProfiles from '../components/home/ChildProfiles';
import SymptomLogger from '../components/detective/SymptomLogger';

export default function GrandparentSymptomsPage() {
  const { state, activeChild } = useApp();
  const [showLogger, setShowLogger] = useState(false);

  const todaySymptoms = state.symptoms.filter(
    s => s.childId === state.activeChildId
      && new Date(s.timestamp).toDateString() === new Date().toDateString()
  );

  const typeLabels = {
    skin: 'Haut', digestion: 'Verdauung', sleep: 'Schlaf',
    mood: 'Stimmung', breathing: 'Atmung', other: 'Sonstiges',
  };

  return (
    <div className="min-h-screen bg-warm-50">
      <div className="px-6 pt-12 pb-2">
        <h1 className="text-2xl font-bold text-gray-800">Symptome</h1>
        <p className="text-gray-400 mt-1">
          {activeChild ? `Beobachtungen für ${activeChild.name}` : 'Beobachtungen erfassen'}
        </p>
      </div>

      {/* Child selector */}
      <ChildProfiles />

      <div className="px-6 space-y-4">
        {/* Add Symptom Button */}
        <button
          onClick={() => setShowLogger(true)}
          className="w-full bg-warm-500 hover:bg-warm-600 text-white rounded-2xl p-5 flex items-center gap-4 shadow-sm transition cursor-pointer"
        >
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <Plus className="w-6 h-6" />
          </div>
          <div className="text-left">
            <p className="text-lg font-bold">Symptom melden</p>
            <p className="text-warm-100 text-sm">Auffälligkeit erfassen</p>
          </div>
        </button>

        {/* Today's symptoms */}
        {todaySymptoms.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-3">Heute erfasst</h2>
            <div className="space-y-2">
              {todaySymptoms.map(s => (
                <div key={s.id} className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 bg-sage-100 rounded-full flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5 text-sage-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800">{typeLabels[s.type] || s.type}</p>
                    <p className="text-sm text-gray-400">
                      Stärke {s.severity}/5 · {new Date(s.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {s.notes && <p className="text-sm text-gray-500 mt-1">{s.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {todaySymptoms.length === 0 && (
          <div className="text-center py-12">
            <p className="text-5xl mb-4">👍</p>
            <p className="text-lg font-semibold text-gray-700">Keine Symptome heute</p>
            <p className="text-gray-400 mt-1">Das ist gut so!</p>
          </div>
        )}
      </div>

      {showLogger && <SymptomLogger onClose={() => setShowLogger(false)} />}
    </div>
  );
}
