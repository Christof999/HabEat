import { useEffect, useMemo, useState } from 'react';
import { X, Clock, Flame, Droplets, Wheat, Beef, Pencil, Save } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

export default function MealDetailModal({ meal, onClose }) {
  const { state, dispatch } = useApp();
  const [isEditing, setIsEditing] = useState(false);

  const currentMeal = useMemo(() => {
    if (!meal) return null;
    return state.meals.find(m => m.id === meal.id) || meal;
  }, [meal, state.meals]);

  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!currentMeal) return;
    setForm({
      title: currentMeal.title || '',
      summary: currentMeal.summary || '',
      ingredientsText: (currentMeal.ingredients || []).join(', '),
      calories: currentMeal.calories ?? '',
      protein: currentMeal.protein ?? '',
      carbs: currentMeal.carbs ?? '',
      fat: currentMeal.fat ?? '',
      notes: currentMeal.notes || '',
      preBrand: currentMeal.feedingDetails?.brand || '',
      prePreparedMl: currentMeal.feedingDetails?.preparedMl ?? '',
      preConsumedMl: currentMeal.feedingDetails?.consumedMl ?? '',
      breastDurationMin: currentMeal.feedingDetails?.durationMin ?? '',
      breastSide: currentMeal.feedingDetails?.side || 'links',
      breastComment: currentMeal.feedingDetails?.comment || '',
    });
  }, [currentMeal]);

  if (!currentMeal || !form) return null;

  const time = new Date(currentMeal.timestamp).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const date = new Date(currentMeal.timestamp).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const nutrients = [
    { icon: Flame, label: 'Kalorien', value: currentMeal.calories, unit: 'kcal', color: 'text-warm-600', key: 'calories' },
    { icon: Beef, label: 'Protein', value: currentMeal.protein, unit: 'g', color: 'text-rose-500', key: 'protein' },
    { icon: Wheat, label: 'Kohlenhydrate', value: currentMeal.carbs, unit: 'g', color: 'text-warm-500', key: 'carbs' },
    { icon: Droplets, label: 'Fett', value: currentMeal.fat, unit: 'g', color: 'text-sky-500', key: 'fat' },
  ];

  const parseNullableNumber = (value) => {
    const normalized = String(value ?? '').replace(',', '.').trim();
    if (!normalized) return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  };

  const handleSave = () => {
    const ingredients = form.ingredientsText
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

    let feedingDetails = currentMeal.feedingDetails || null;

    if (currentMeal.feedingType === 'pre') {
      feedingDetails = {
        ...feedingDetails,
        brand: form.preBrand.trim(),
        preparedMl: parseNullableNumber(form.prePreparedMl),
        consumedMl: parseNullableNumber(form.preConsumedMl),
      };
    }

    if (currentMeal.feedingType === 'breastfeeding') {
      feedingDetails = {
        ...feedingDetails,
        durationMin: parseNullableNumber(form.breastDurationMin),
        side: form.breastSide,
        comment: form.breastComment.trim(),
      };
    }

    dispatch({
      type: 'UPDATE_MEAL',
      payload: {
        id: currentMeal.id,
        title: form.title.trim() || currentMeal.title,
        summary: form.summary.trim(),
        ingredients,
        calories: parseNullableNumber(form.calories),
        protein: parseNullableNumber(form.protein),
        carbs: parseNullableNumber(form.carbs),
        fat: parseNullableNumber(form.fat),
        notes: form.notes.trim(),
        feedingDetails,
        updatedAt: new Date().toISOString(),
      },
    });

    setIsEditing(false);
  };

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
        {currentMeal.imageUrl && (
          <div className="w-full h-56 overflow-hidden rounded-t-3xl sm:rounded-t-3xl">
            <img src={currentMeal.imageUrl} alt={currentMeal.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-6 space-y-5">
          <div className="flex justify-end">
            {isEditing ? (
              <button
                onClick={handleSave}
                className="px-3 py-1.5 rounded-lg bg-sage-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Speichern
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 rounded-lg bg-sage-50 text-sage-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                Bearbeiten
              </button>
            )}
          </div>

          {/* Title & Time */}
          <div>
            {isEditing ? (
              <input
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-sage-200 text-gray-800"
              />
            ) : (
              <h2 className="text-xl font-bold text-gray-800">{currentMeal.title}</h2>
            )}
            <div className="flex items-center gap-1.5 mt-1 text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-sm">{date}, {time}</span>
            </div>
          </div>

          {/* Nutrients Grid */}
          <div className="grid grid-cols-2 gap-3">
            {nutrients.map(n => (
              <div key={n.label} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <n.icon className={`w-3.5 h-3.5 ${n.color}`} />
                    <span className="text-xs text-gray-500">{n.label}</span>
                  </div>
                  {isEditing ? (
                    <input
                      type="number"
                      value={form[n.key]}
                      onChange={e => setForm(prev => ({ ...prev, [n.key]: e.target.value }))}
                      className="w-full px-2 py-1 rounded-lg bg-white border border-sage-200 text-sm text-gray-800"
                    />
                  ) : (
                    <span className="text-lg font-bold text-gray-800">
                      {n.value ?? '-'} <span className="text-sm font-normal text-gray-400">{n.value != null ? n.unit : ''}</span>
                    </span>
                  )}
                </div>
            ))}
          </div>

          {currentMeal.feedingType === 'pre' && (
            <div className="bg-sky-50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide">Pre-Nahrung</p>
              {isEditing ? (
                <div className="grid grid-cols-1 gap-2">
                  <input
                    value={form.preBrand}
                    onChange={e => setForm(prev => ({ ...prev, preBrand: e.target.value }))}
                    placeholder="Marke"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-sky-200 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={form.prePreparedMl}
                      onChange={e => setForm(prev => ({ ...prev, prePreparedMl: e.target.value }))}
                      placeholder="zubereitet (ml)"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-sky-200 text-sm"
                    />
                    <input
                      type="number"
                      value={form.preConsumedMl}
                      onChange={e => setForm(prev => ({ ...prev, preConsumedMl: e.target.value }))}
                      placeholder="getrunken (ml)"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-sky-200 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-700 space-y-1">
                  {currentMeal.feedingDetails?.brand && <p>Marke: {currentMeal.feedingDetails.brand}</p>}
                  {currentMeal.feedingDetails?.preparedMl != null && <p>Zubereitet: {currentMeal.feedingDetails.preparedMl} ml</p>}
                  {currentMeal.feedingDetails?.consumedMl != null && <p>Getrunken: {currentMeal.feedingDetails.consumedMl} ml</p>}
                </div>
              )}
            </div>
          )}

          {currentMeal.feedingType === 'breastfeeding' && (
            <div className="bg-rose-50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Stillen</p>
              {isEditing ? (
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="number"
                    value={form.breastDurationMin}
                    onChange={e => setForm(prev => ({ ...prev, breastDurationMin: e.target.value }))}
                    placeholder="Dauer (Minuten)"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-rose-200 text-sm"
                  />
                  <select
                    value={form.breastSide}
                    onChange={e => setForm(prev => ({ ...prev, breastSide: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-rose-200 text-sm"
                  >
                    <option value="links">Links</option>
                    <option value="rechts">Rechts</option>
                    <option value="beide">Beide</option>
                  </select>
                  <input
                    value={form.breastComment}
                    onChange={e => setForm(prev => ({ ...prev, breastComment: e.target.value }))}
                    placeholder="Kommentar zum Stillen"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-rose-200 text-sm"
                  />
                </div>
              ) : (
                <div className="text-sm text-gray-700 space-y-1">
                  {currentMeal.feedingDetails?.durationMin != null && <p>Dauer: {currentMeal.feedingDetails.durationMin} Minuten</p>}
                  {currentMeal.feedingDetails?.side && <p>Seite: {currentMeal.feedingDetails.side}</p>}
                  {currentMeal.feedingDetails?.comment && <p>Kommentar: {currentMeal.feedingDetails.comment}</p>}
                </div>
              )}
            </div>
          )}

          {/* Ingredients */}
          {(isEditing || (currentMeal.ingredients && currentMeal.ingredients.length > 0)) && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Erkannte Zutaten</h3>
              {isEditing ? (
                <input
                  value={form.ingredientsText}
                  onChange={e => setForm(prev => ({ ...prev, ingredientsText: e.target.value }))}
                  placeholder="Kommagetrennte Zutaten"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-sage-200 text-sm"
                />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {currentMeal.ingredients.map((ingredient, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-sage-50 text-sage-700"
                    >
                      {ingredient}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Zusammenfassung</h3>
            {isEditing ? (
              <textarea
                value={form.summary}
                onChange={e => setForm(prev => ({ ...prev, summary: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-sage-200 text-sm"
              />
            ) : (
              <p className="text-sm text-gray-500">{currentMeal.summary || '—'}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Notizen</h3>
            {isEditing ? (
              <textarea
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-sage-200 text-sm"
              />
            ) : (
              <p className="text-sm text-gray-500">{currentMeal.notes || '—'}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
