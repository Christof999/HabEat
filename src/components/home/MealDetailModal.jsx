import { useState } from 'react';
import { X, Clock, Flame, Droplets, Wheat, Beef, Baby, Pencil, Check, Database, AlertCircle, Leaf, Cookie } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

function portionFactor(meal) {
  if (meal.portionEaten === 'half') return 0.5;
  if (meal.portionEaten === 'some') return 0.25;
  return 1;
}

export default function MealDetailModal({ meal, onClose }) {
  const { dispatch } = useApp();
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    calories: meal.calories ?? '',
    protein: meal.protein ?? '',
    carbs: meal.carbs ?? '',
    fat: meal.fat ?? '',
    sugar: meal.sugar ?? '',
    fiber: meal.fiber ?? '',
  });

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

  const mealType = meal.mealType || 'food';
  const factor = portionFactor(meal);
  const adjust = (v) => v != null ? Math.round(v * factor) : v;

  const nutrients = [
    { icon: Flame, label: 'Kalorien', key: 'calories', value: adjust(meal.calories), unit: 'kcal', color: 'text-warm-600' },
    { icon: Beef, label: 'Protein', key: 'protein', value: adjust(meal.protein), unit: 'g', color: 'text-rose-500' },
    { icon: Wheat, label: 'Kohlenhydrate', key: 'carbs', value: adjust(meal.carbs), unit: 'g', color: 'text-warm-500' },
    { icon: Droplets, label: 'Fett', key: 'fat', value: adjust(meal.fat), unit: 'g', color: 'text-sky-500' },
    { icon: Cookie, label: 'Zucker', key: 'sugar', value: adjust(meal.sugar), unit: 'g', color: 'text-amber-500' },
    { icon: Leaf, label: 'Ballaststoffe', key: 'fiber', value: adjust(meal.fiber), unit: 'g', color: 'text-green-500' },
  ];

  const handleSaveEdit = () => {
    const updates = {
      id: meal.id,
      calories: parseFloat(editValues.calories) || 0,
      protein: parseFloat(editValues.protein) || 0,
      carbs: parseFloat(editValues.carbs) || 0,
      fat: parseFloat(editValues.fat) || 0,
      sugar: parseFloat(editValues.sugar) || null,
      fiber: parseFloat(editValues.fiber) || null,
    };
    dispatch({ type: 'UPDATE_MEAL', payload: updates });
    setEditing(false);
  };

  const hasDataSource = meal.dataSource && meal.dataSource !== 'gemini';

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
        {mealType === 'food' && meal.imageUrl && (
          <div className="w-full h-56 overflow-hidden rounded-t-3xl sm:rounded-t-3xl">
            <img src={meal.imageUrl} alt={meal.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Breastfeeding / Formula icon header */}
        {mealType !== 'food' && (
          <div className="flex justify-center pt-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              mealType === 'breastfeeding' ? 'bg-rose-50' : 'bg-warm-50'
            }`}>
              {mealType === 'breastfeeding'
                ? <Baby className="w-8 h-8 text-rose-500" />
                : <Droplets className="w-8 h-8 text-warm-600" />}
            </div>
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

          {/* Data Source Badges */}
          {mealType === 'food' && (
            <div className="flex items-center gap-2 flex-wrap">
              {meal.dataSource?.includes('openfoodfacts') && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 rounded-full">
                  <Database className="w-3 h-3 text-orange-500" />
                  <span className="text-xs text-orange-700">
                    Open Food Facts{meal.offBrand ? ` (${meal.offBrand})` : ''}
                  </span>
                </div>
              )}
              {meal.nutriscoreGrade && (
                <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${
                  meal.nutriscoreGrade === 'a' ? 'bg-green-100 text-green-700' :
                  meal.nutriscoreGrade === 'b' ? 'bg-lime-100 text-lime-700' :
                  meal.nutriscoreGrade === 'c' ? 'bg-yellow-100 text-yellow-700' :
                  meal.nutriscoreGrade === 'd' ? 'bg-orange-100 text-orange-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  Nutri-Score {meal.nutriscoreGrade.toUpperCase()}
                </span>
              )}
            </div>
          )}

          {/* Breastfeeding details */}
          {mealType === 'breastfeeding' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-rose-50 rounded-xl p-3">
                <span className="text-xs text-gray-500">Dauer</span>
                <p className="text-lg font-bold text-gray-800 mt-0.5">{meal.duration} <span className="text-sm font-normal text-gray-400">Min.</span></p>
              </div>
              {meal.side && (
                <div className="bg-rose-50 rounded-xl p-3">
                  <span className="text-xs text-gray-500">Seite</span>
                  <p className="text-lg font-bold text-gray-800 mt-0.5">{{ left: 'Links', right: 'Rechts', both: 'Beide' }[meal.side]}</p>
                </div>
              )}
            </div>
          )}

          {/* Formula details */}
          {mealType === 'formula' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-warm-50 rounded-xl p-3">
                <span className="text-xs text-gray-500">Menge</span>
                <p className="text-lg font-bold text-gray-800 mt-0.5">{meal.amount} <span className="text-sm font-normal text-gray-400">ml</span></p>
              </div>
              {meal.brand && (
                <div className="bg-warm-50 rounded-xl p-3">
                  <span className="text-xs text-gray-500">Marke</span>
                  <p className="text-lg font-bold text-gray-800 mt-0.5">{meal.brand}</p>
                </div>
              )}
            </div>
          )}

          {/* Nutrients Grid — food only */}
          {mealType === 'food' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Nährwerte</h3>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 text-xs text-sage-600 hover:text-sage-700 transition cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Bearbeiten
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditing(false)}
                      className="text-xs text-gray-500 hover:text-gray-700 transition cursor-pointer"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1 text-xs text-sage-600 font-semibold hover:text-sage-700 transition cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Speichern
                    </button>
                  </div>
                )}
              </div>

              {!editing ? (
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
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {nutrients.map(n => (
                    <div key={n.label} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <n.icon className={`w-3.5 h-3.5 ${n.color}`} />
                        <span className="text-xs text-gray-500">{n.label}</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <input
                          type="number"
                          step="0.1"
                          value={editValues[n.key]}
                          onChange={e => setEditValues(prev => ({ ...prev, [n.key]: e.target.value }))}
                          className="w-full bg-white text-lg font-bold text-gray-800 rounded-lg px-2 py-1 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition"
                        />
                        <span className="text-sm font-normal text-gray-400 shrink-0">{n.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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

          {/* Allergens */}
          {meal.allergens && meal.allergens.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-semibold text-rose-700">Allergene</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {meal.allergens.map((allergen, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                    {allergen}
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
