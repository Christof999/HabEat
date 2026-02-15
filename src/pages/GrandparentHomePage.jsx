import { useNavigate } from 'react-router-dom';
import { Camera, ThermometerSun, ShieldAlert } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import ChildProfiles from '../components/home/ChildProfiles';

export default function GrandparentHomePage() {
  const { state, activeChild } = useApp();
  const navigate = useNavigate();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Guten Morgen';
    if (hour < 15) return 'Mahlzeit';
    if (hour < 18) return 'Guten Nachmittag';
    return 'Guten Abend';
  };

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <div className="px-6 pt-12 pb-2">
        <p className="text-lg text-gray-400">{greeting()} 👋</p>
        <h1 className="text-2xl font-bold text-gray-800">
          {activeChild ? `Was isst ${activeChild.name}?` : 'HabEat'}
        </h1>
      </div>

      {/* Child Profiles */}
      {state.children.length > 1 && <ChildProfiles />}

      {/* Big Action Buttons */}
      <div className="px-6 pt-6 space-y-4">
        <button
          onClick={() => navigate('/track')}
          className="w-full bg-sage-500 hover:bg-sage-600 text-white rounded-2xl p-6 flex items-center gap-5 shadow-sm transition cursor-pointer"
        >
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
            <Camera className="w-7 h-7" />
          </div>
          <div className="text-left">
            <p className="text-lg font-bold">Essen fotografieren</p>
            <p className="text-sage-100 text-sm">Mahlzeit erfassen</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/symptoms')}
          className="w-full bg-white hover:bg-warm-50 text-gray-800 rounded-2xl p-6 flex items-center gap-5 shadow-sm border border-gray-100 transition cursor-pointer"
        >
          <div className="w-14 h-14 bg-warm-100 rounded-2xl flex items-center justify-center shrink-0">
            <ThermometerSun className="w-7 h-7 text-warm-600" />
          </div>
          <div className="text-left">
            <p className="text-lg font-bold">Symptom melden</p>
            <p className="text-gray-400 text-sm">Falls etwas auffällt</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/emergency')}
          className="w-full bg-white hover:bg-rose-50 text-gray-800 rounded-2xl p-6 flex items-center gap-5 shadow-sm border border-gray-100 transition cursor-pointer"
        >
          <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center shrink-0">
            <ShieldAlert className="w-7 h-7 text-rose-500" />
          </div>
          <div className="text-left">
            <p className="text-lg font-bold">Allergie-Karte</p>
            <p className="text-gray-400 text-sm">Wichtige Infos & Notfallnummern</p>
          </div>
        </button>
      </div>

      {/* Allergy reminder if child has known allergies */}
      {activeChild?.knownAllergies?.length > 0 && (
        <div className="px-6 pt-6">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-rose-700 mb-1">
              Bekannte Allergien von {activeChild.name}:
            </p>
            <p className="text-sm text-rose-600">
              {activeChild.knownAllergies.join(', ')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
