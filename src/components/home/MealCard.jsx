import { Clock, ChevronRight, Baby, Droplets } from 'lucide-react';
import PortionPicker from './PortionPicker';

function portionFactor(meal) {
  if (meal.portionEaten === 'half') return 0.5;
  if (meal.portionEaten === 'some') return 0.25;
  return 1;
}

const SIDE_LABELS = { left: 'Links', right: 'Rechts', both: 'Beide' };

export default function MealCard({ meal, onClick, showPortionPicker }) {
  const time = new Date(meal.timestamp).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const adjustedCal = meal.calories ? Math.round(meal.calories * portionFactor(meal)) : null;
  const mealType = meal.mealType || 'food';

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition">
      <button
        onClick={onClick}
        className="w-full p-4 flex items-center gap-4 cursor-pointer text-left"
      >
        {/* Icon / Image */}
        <div className={`w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center ${
          mealType === 'breastfeeding' ? 'bg-rose-50' :
          mealType === 'formula' ? 'bg-warm-50' : 'bg-sage-50'
        }`}>
          {mealType === 'breastfeeding' ? (
            <Baby className="w-7 h-7 text-rose-500" />
          ) : mealType === 'formula' ? (
            <Droplets className="w-7 h-7 text-warm-600" />
          ) : meal.imageUrl ? (
            <img src={meal.imageUrl} alt={meal.title} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">🍽️</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800 text-sm truncate">{meal.title}</h3>

          {mealType === 'breastfeeding' && (
            <p className="text-xs text-gray-500 mt-0.5">
              {meal.duration} Min.{meal.side ? ` · ${SIDE_LABELS[meal.side]}` : ''}
            </p>
          )}

          {mealType === 'formula' && (
            <p className="text-xs text-gray-500 mt-0.5">
              {meal.amount} ml{meal.brand ? ` · ${meal.brand}` : ''}
            </p>
          )}

          {mealType === 'food' && meal.summary && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{meal.summary}</p>
          )}

          <div className="flex items-center gap-1 mt-1.5 text-gray-400">
            <Clock className="w-3 h-3" />
            <span className="text-xs">{time}</span>
            {mealType === 'food' && adjustedCal != null && (
              <span className="text-xs ml-2">{adjustedCal} kcal</span>
            )}
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
      </button>

      {/* Portion Picker — only for food meals */}
      {showPortionPicker && mealType === 'food' && (
        <div className="px-4 pb-3 -mt-1">
          <PortionPicker meal={meal} />
        </div>
      )}
    </div>
  );
}
