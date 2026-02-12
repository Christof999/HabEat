import { Clock, ChevronRight } from 'lucide-react';
import PortionPicker from './PortionPicker';

export default function MealCard({ meal, onClick, showPortionPicker }) {
  const time = new Date(meal.timestamp).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition">
      <button
        onClick={onClick}
        className="w-full p-4 flex items-center gap-4 cursor-pointer text-left"
      >
        {/* Image Preview */}
        <div className="w-16 h-16 rounded-xl bg-sage-50 overflow-hidden shrink-0">
          {meal.imageUrl ? (
            <img src={meal.imageUrl} alt={meal.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-2xl">🍽️</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800 text-sm truncate">{meal.title}</h3>
          {meal.summary && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{meal.summary}</p>
          )}
          <div className="flex items-center gap-1 mt-1.5 text-gray-400">
            <Clock className="w-3 h-3" />
            <span className="text-xs">{time}</span>
            {meal.calories && (
              <span className="text-xs ml-2">{meal.calories} kcal</span>
            )}
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
      </button>

      {/* Portion Picker — only for today's meals */}
      {showPortionPicker && (
        <div className="px-4 pb-3 -mt-1">
          <PortionPicker meal={meal} />
        </div>
      )}
    </div>
  );
}
