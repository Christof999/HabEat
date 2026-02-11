import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import ChildProfiles from '../components/home/ChildProfiles';
import MealCard from '../components/home/MealCard';
import EmptyMeals from '../components/home/EmptyMeals';
import MealDetailModal from '../components/home/MealDetailModal';

export default function HomePage() {
  const { state, activeChild } = useApp();
  const navigate = useNavigate();
  const [selectedMeal, setSelectedMeal] = useState(null);

  const today = new Date().toDateString();
  const todayMeals = state.meals.filter(
    m => m.childId === state.activeChildId && new Date(m.timestamp).toDateString() === today
  );

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Guten Morgen';
    if (hour < 15) return 'Guten Mittag';
    if (hour < 18) return 'Guten Nachmittag';
    return 'Guten Abend';
  };

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <div className="px-6 pt-12 pb-2">
        <p className="text-gray-400 text-sm">{greeting()} 👋</p>
        <h1 className="text-2xl font-bold text-gray-800">
          {activeChild ? `${activeChild.name}s Tag` : 'HabEat'}
        </h1>
      </div>

      {/* Child Profiles - Story Style */}
      <ChildProfiles onAddChild={() => navigate('/settings/add-child')} />

      {/* Divider */}
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">Heute</h2>
          <span className="text-xs text-gray-400">
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
      </div>

      {/* Meals List */}
      <div className="px-6 space-y-3">
        {todayMeals.length > 0 ? (
          todayMeals.map(meal => (
            <MealCard key={meal.id} meal={meal} onClick={() => setSelectedMeal(meal)} />
          ))
        ) : (
          <EmptyMeals />
        )}
      </div>

      {/* FAB - Add Meal */}
      <button
        onClick={() => navigate('/track')}
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px) + 12px)' }}
        className="fixed right-5 w-14 h-14 bg-sage-500 hover:bg-sage-600 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all cursor-pointer z-30"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Meal Detail Modal */}
      {selectedMeal && (
        <MealDetailModal meal={selectedMeal} onClose={() => setSelectedMeal(null)} />
      )}
    </div>
  );
}
