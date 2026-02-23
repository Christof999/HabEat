import { useState, useMemo } from 'react';
import { CalendarDays, ChevronRight, X, Flame } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import MealCard from '../components/home/MealCard';
import MealDetailModal from '../components/home/MealDetailModal';
import { hasDiabetesType1, getPortionFactor, calculateCarbUnits } from '../lib/diabetes';

export default function HistoryPage() {
  const { state, activeChild } = useApp();
  const [selectedMealId, setSelectedMealId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const isType1Diabetes = hasDiabetesType1(activeChild?.knownConditions || []);

  const childMeals = state.meals.filter(m => m.childId === state.activeChildId);

  const groupedByDate = useMemo(() => {
    const groups = {};
    childMeals.forEach(meal => {
      const dateKey = new Date(meal.timestamp).toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(meal);
    });
    return Object.entries(groups).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
    );
  }, [childMeals]);

  const formatDateLabel = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Heute';
    if (date.toDateString() === yesterday.toDateString()) return 'Gestern';
    return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const selectedDateMeals = selectedDate
    ? groupedByDate.find(([d]) => d === selectedDate)?.[1] || []
    : [];

  const daySummary = (meals) => {
    const totalCal = meals.reduce((sum, m) => sum + Math.round((m.calories || 0) * getPortionFactor(m.portionEaten)), 0);
    const totalCarbs = meals.reduce(
      (sum, m) => sum + ((m.carbs || 0) * getPortionFactor(m.portionEaten)),
      0
    );
    const totalBE = calculateCarbUnits(totalCarbs).be;
    return { totalCal, mealCount: meals.length, totalBE };
  };

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-gray-800">Verlauf</h1>
        <p className="text-gray-400 text-sm mt-0.5">Alle erfassten Mahlzeiten</p>
      </div>

      {/* Date Groups */}
      <div className="px-6 space-y-3 pb-24">
        {groupedByDate.length > 0 ? (
          groupedByDate.map(([dateStr, meals]) => {
            const { totalCal, mealCount, totalBE } = daySummary(meals);
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition cursor-pointer text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-sage-50 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-5 h-5 text-sage-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 text-sm">
                    {formatDateLabel(dateStr)}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {mealCount} {mealCount === 1 ? 'Mahlzeit' : 'Mahlzeiten'}
                    {totalCal > 0 && ` · ${totalCal} kcal`}
                    {isType1Diabetes && totalBE > 0 && ` · ${totalBE} BE`}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="w-10 h-10 text-sage-200 mb-3" />
            <h3 className="font-semibold text-gray-700">Noch kein Verlauf</h3>
            <p className="text-gray-400 text-sm mt-1">
              Hier erscheinen alle erfassten Mahlzeiten.
            </p>
          </div>
        )}
      </div>

      {/* Day Detail Modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedDate(null)} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto safe-bottom">
            <div className="sticky top-0 bg-white rounded-t-3xl p-6 pb-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{formatDateLabel(selectedDate)}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <Flame className="w-3.5 h-3.5 text-warm-500" />
                  <span className="text-sm text-gray-500">
                    {daySummary(selectedDateMeals).totalCal} kcal gesamt
                  </span>
                  {isType1Diabetes && daySummary(selectedDateMeals).totalBE > 0 && (
                    <span className="text-sm text-sky-600 font-medium">
                      · {daySummary(selectedDateMeals).totalBE} BE
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {selectedDateMeals.map(meal => (
                <MealCard key={meal.id} meal={meal} onClick={() => setSelectedMealId(meal.id)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Meal Detail Modal */}
      {selectedMealId && state.meals.find(m => m.id === selectedMealId) && (
        <MealDetailModal meal={state.meals.find(m => m.id === selectedMealId)} onClose={() => setSelectedMealId(null)} />
      )}
    </div>
  );
}
