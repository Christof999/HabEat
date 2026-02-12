import { X, Clock, Flame, Droplets, Wheat, Beef } from 'lucide-react';

export default function MealDetailModal({ meal, onClose }) {
  if (!meal) return null;

  const time = new Date(meal.timestamp).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const date = new Date(meal.timestamp).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const nutrients = [
    { icon: Flame, label: 'Kalorien', value: meal.calories, unit: 'kcal', color: 'text-warm-600' },
    { icon: Beef, label: 'Protein', value: meal.protein, unit: 'g', color: 'text-rose-500' },
    { icon: Wheat, label: 'Kohlenhydrate', value: meal.carbs, unit: 'g', color: 'text-warm-500' },
    { icon: Droplets, label: 'Fett', value: meal.fat, unit: 'g', color: 'text-sky-500' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto safe-bottom">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center z-10 cursor-pointer"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>

        {/* Image */}
        {meal.imageUrl && (
          <div className="w-full h-56 overflow-hidden rounded-t-3xl sm:rounded-t-3xl">
            <img src={meal.imageUrl} alt={meal.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* Title & Time */}
          <div>
            <h2 className="text-xl font-bold text-gray-800">{meal.title}</h2>
            <div className="flex items-center gap-1.5 mt-1 text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-sm">{date}, {time}</span>
            </div>
          </div>

          {/* Nutrients Grid */}
          <div className="grid grid-cols-2 gap-3">
            {nutrients.map(n => (
              n.value != null && (
                <div key={n.label} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <n.icon className={`w-3.5 h-3.5 ${n.color}`} />
                    <span className="text-xs text-gray-500">{n.label}</span>
                  </div>
                  <span className="text-lg font-bold text-gray-800">
                    {n.value} <span className="text-sm font-normal text-gray-400">{n.unit}</span>
                  </span>
                </div>
              )
            ))}
          </div>

          {/* Ingredients */}
          {meal.ingredients && meal.ingredients.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Erkannte Zutaten</h3>
              <div className="flex flex-wrap gap-1.5">
                {meal.ingredients.map((ingredient, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-sage-50 text-sage-700"
                  >
                    {ingredient}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Portion Eaten */}
          {meal.portionEaten && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Gegessene Menge</h3>
              <div className="flex items-center gap-3">
                <span className="text-lg">
                  {meal.portionEaten === 'full' ? '●' : meal.portionEaten === 'half' ? '◐' : '◔'}
                </span>
                <span className="text-sm text-gray-600 font-medium">
                  {meal.portionEaten === 'full' ? 'Ganz aufgegessen' : meal.portionEaten === 'half' ? 'Etwa die Hälfte' : 'Etwas probiert'}
                </span>
              </div>
              {meal.afterImageUrl && (
                <div className="mt-3 rounded-xl overflow-hidden">
                  <img src={meal.afterImageUrl} alt="Teller danach" className="w-full h-40 object-cover" />
                  <p className="text-xs text-gray-400 mt-1">Foto nach dem Essen</p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {meal.notes && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Notizen</h3>
              <p className="text-sm text-gray-500">{meal.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
