import { useState } from 'react';
import { ArrowRight, ArrowLeft, Plus, X, User, Calendar, Ruler, Weight, AlertTriangle } from 'lucide-react';

const commonAllergens = [
  'Milch', 'Ei', 'Erdnuss', 'Baumnüsse', 'Weizen', 'Soja',
  'Fisch', 'Schalentiere', 'Sesam', 'Senf', 'Sellerie', 'Lupine',
];

const avatarColors = [
  'bg-sage-200', 'bg-sky-200', 'bg-warm-200', 'bg-rose-200',
  'bg-sage-300', 'bg-sky-300', 'bg-warm-300', 'bg-rose-300',
];

export default function AddChildForm({
  onAdd,
  onBack,
  childIndex = 0,
  initialChild = null,
  title = 'Kind hinzufügen',
  subtitle = 'Erzähle uns von deinem Kind',
  submitLabel = 'Kind hinzufügen',
}) {
  const initialKnownAllergies = Array.isArray(initialChild?.knownAllergies)
    ? initialChild.knownAllergies
    : Array.isArray(initialChild?.allergies)
      ? initialChild.allergies
      : [];

  const [form, setForm] = useState({
    name: initialChild?.name || '',
    birthDate: initialChild?.birthDate || '',
    height: initialChild?.height ?? '',
    weight: initialChild?.weight ?? '',
    knownAllergies: initialKnownAllergies,
    avatarColor: initialChild?.avatarColor || avatarColors[childIndex % avatarColors.length],
  });
  const [customAllergen, setCustomAllergen] = useState('');
  const [errors, setErrors] = useState({});

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const toggleAllergen = (allergen) => {
    setForm(prev => ({
      ...prev,
      knownAllergies: prev.knownAllergies.includes(allergen)
        ? prev.knownAllergies.filter(a => a !== allergen)
        : [...prev.knownAllergies, allergen],
    }));
  };

  const addCustomAllergen = () => {
    const trimmed = customAllergen.trim();
    if (trimmed && !form.knownAllergies.includes(trimmed)) {
      setForm(prev => ({
        ...prev,
        knownAllergies: [...prev.knownAllergies, trimmed],
      }));
      setCustomAllergen('');
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Name ist erforderlich';
    if (!form.birthDate) newErrors.birthDate = 'Geburtsdatum ist erforderlich';
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onAdd({
      ...form,
      id: initialChild?.id || crypto.randomUUID(),
      height: form.height ? parseFloat(form.height) : null,
      weight: form.weight ? parseFloat(form.weight) : null,
      createdAt: initialChild?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <div className="sticky top-0 bg-warm-50/80 backdrop-blur-sm z-10 px-6 py-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h2 className="font-bold text-lg text-gray-800">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-6 pb-32 space-y-6">
        {/* Avatar Preview */}
        <div className="flex justify-center">
          <div className={`w-20 h-20 rounded-full ${form.avatarColor} flex items-center justify-center shadow-sm`}>
            {form.name ? (
              <span className="text-2xl font-bold text-gray-700">
                {(form.name?.trim()?.[0] || '?').toUpperCase()}
              </span>
            ) : (
              <User className="w-8 h-8 text-gray-400" />
            )}
          </div>
        </div>

        {/* Avatar Color Picker */}
        <div className="flex justify-center gap-2">
          {avatarColors.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => updateField('avatarColor', color)}
              className={`w-8 h-8 rounded-full ${color} cursor-pointer transition-transform ${
                form.avatarColor === color ? 'ring-2 ring-sage-500 ring-offset-2 scale-110' : ''
              }`}
            />
          ))}
        </div>

        {/* Name */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <User className="w-4 h-4" />
            Name *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => updateField('name', e.target.value)}
            placeholder="Wie heißt dein Kind?"
            className={`w-full px-4 py-3 rounded-xl bg-white border ${
              errors.name ? 'border-rose-400' : 'border-sage-200'
            } focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800 placeholder:text-gray-400`}
          />
          {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name}</p>}
        </div>

        {/* Birth Date */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4" />
            Geburtsdatum *
          </label>
          <input
            type="date"
            value={form.birthDate}
            onChange={e => updateField('birthDate', e.target.value)}
            className={`w-full px-4 py-3 rounded-xl bg-white border ${
              errors.birthDate ? 'border-rose-400' : 'border-sage-200'
            } focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800`}
          />
          {errors.birthDate && <p className="text-rose-500 text-xs mt-1">{errors.birthDate}</p>}
        </div>

        {/* Height & Weight Row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Ruler className="w-4 h-4" />
              Größe (cm)
            </label>
            <input
              type="number"
              value={form.height}
              onChange={e => updateField('height', e.target.value)}
              placeholder="z.B. 85"
              className="w-full px-4 py-3 rounded-xl bg-white border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800 placeholder:text-gray-400"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Weight className="w-4 h-4" />
              Gewicht (kg)
            </label>
            <input
              type="number"
              step="0.1"
              value={form.weight}
              onChange={e => updateField('weight', e.target.value)}
              placeholder="z.B. 12.5"
              className="w-full px-4 py-3 rounded-xl bg-white border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Allergens */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <AlertTriangle className="w-4 h-4" />
            Bekannte Allergien & Unverträglichkeiten
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {commonAllergens.map(allergen => (
              <button
                key={allergen}
                type="button"
                onClick={() => toggleAllergen(allergen)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition cursor-pointer ${
                  form.knownAllergies.includes(allergen)
                    ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-300'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-sage-300'
                }`}
              >
                {allergen}
              </button>
            ))}
          </div>

          {/* Custom Allergen Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customAllergen}
              onChange={e => setCustomAllergen(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomAllergen())}
              placeholder="Weitere Allergie hinzufügen..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-sm text-gray-800 placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={addCustomAllergen}
              className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center cursor-pointer hover:bg-sage-200 transition"
            >
              <Plus className="w-4 h-4 text-sage-700" />
            </button>
          </div>

          {/* Selected Custom Allergens */}
          {form.knownAllergies.filter(a => !commonAllergens.includes(a)).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {form.knownAllergies
                .filter(a => !commonAllergens.includes(a))
                .map(allergen => (
                  <span
                    key={allergen}
                    className="px-3 py-1.5 rounded-full text-sm font-medium bg-rose-100 text-rose-700 ring-1 ring-rose-300 flex items-center gap-1"
                  >
                    {allergen}
                    <button
                      type="button"
                      onClick={() => toggleAllergen(allergen)}
                      className="cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-warm-50 via-warm-50 to-transparent safe-bottom">
          <button
            type="submit"
            className="w-full bg-sage-500 hover:bg-sage-600 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            {submitLabel}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
