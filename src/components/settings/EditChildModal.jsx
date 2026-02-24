import { useState, useRef } from 'react';
import { X, Plus, User, Calendar, Ruler, Weight, AlertTriangle, Trash2, Camera, Heart } from 'lucide-react';

const commonAllergens = [
  'Milch', 'Ei', 'Erdnuss', 'Baumnüsse', 'Weizen', 'Soja',
  'Fisch', 'Schalentiere', 'Sesam', 'Senf', 'Sellerie', 'Lupine',
];

const commonConditions = [
  'Diabetes Typ 1', 'Diabetes Typ 2', 'Neurodermitis', 'Asthma', 'Zöliakie',
  'Laktoseintoleranz', 'Fruktoseintoleranz', 'Reflux', 'Mukoviszidose',
];

const avatarColors = [
  'bg-sage-200', 'bg-sky-200', 'bg-warm-200', 'bg-rose-200',
  'bg-sage-300', 'bg-sky-300', 'bg-warm-300', 'bg-rose-300',
];

export default function EditChildModal({ child, onSave, onDelete, onClose, onGrowthEntry }) {
  const [form, setForm] = useState({
    name: child.name,
    birthDate: child.birthDate,
    sex: child.sex || '',
    height: child.height || '',
    weight: child.weight || '',
    knownAllergies: child.knownAllergies || [],
    knownConditions: child.knownConditions || [],
    avatarColor: child.avatarColor || 'bg-sage-200',
    photoUrl: child.photoUrl || null,
  });
  const [customAllergen, setCustomAllergen] = useState('');
  const [customCondition, setCustomCondition] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const photoInputRef = useRef(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => updateField('photoUrl', ev.target.result);
    reader.readAsDataURL(file);
  };

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
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

  const toggleCondition = (condition) => {
    setForm(prev => ({
      ...prev,
      knownConditions: prev.knownConditions.includes(condition)
        ? prev.knownConditions.filter(c => c !== condition)
        : [...prev.knownConditions, condition],
    }));
  };

  const addCustomCondition = () => {
    const trimmed = customCondition.trim();
    if (trimmed && !form.knownConditions.includes(trimmed)) {
      setForm(prev => ({
        ...prev,
        knownConditions: [...prev.knownConditions, trimmed],
      }));
      setCustomCondition('');
    }
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.birthDate) return;
    const newHeight = form.height ? parseFloat(form.height) : null;
    const newWeight = form.weight ? parseFloat(form.weight) : null;

    // Auto-create growth entry if height or weight changed
    const heightChanged = newHeight !== (child.height || null);
    const weightChanged = newWeight !== (child.weight || null);
    if ((heightChanged || weightChanged) && (newHeight || newWeight) && onGrowthEntry) {
      onGrowthEntry({
        id: crypto.randomUUID(),
        childId: child.id,
        height: newHeight,
        weight: newWeight,
        timestamp: new Date().toISOString(),
      });
    }

    onSave({
      ...child,
      ...form,
      height: newHeight,
      weight: newWeight,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-warm-50 w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-warm-50/95 backdrop-blur-sm px-6 py-4 flex items-center justify-between border-b border-gray-100">
          <h2 className="font-bold text-lg text-gray-800">Kind bearbeiten</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Avatar with Photo Upload */}
          <div className="flex flex-col items-center gap-2">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => photoInputRef.current.click()}
              className="relative group cursor-pointer"
            >
              <div className={`w-16 h-16 rounded-full ${form.avatarColor} flex items-center justify-center shadow-sm overflow-hidden`}>
                {form.photoUrl ? (
                  <img src={form.photoUrl} alt="Foto" className="w-full h-full object-cover" />
                ) : form.name ? (
                  <span className="text-xl font-bold text-gray-700">{form.name.charAt(0).toUpperCase()}</span>
                ) : (
                  <User className="w-7 h-7 text-gray-400" />
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-sage-500 rounded-full flex items-center justify-center shadow-sm border-2 border-warm-50">
                <Camera className="w-3 h-3 text-white" />
              </div>
            </button>
            {form.photoUrl && (
              <button
                type="button"
                onClick={() => updateField('photoUrl', null)}
                className="text-xs text-gray-400 hover:text-rose-500 transition cursor-pointer"
              >
                Foto entfernen
              </button>
            )}
          </div>
          {!form.photoUrl && (
            <div className="flex justify-center gap-2">
              {avatarColors.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => updateField('avatarColor', color)}
                  className={`w-7 h-7 rounded-full ${color} cursor-pointer transition-transform ${
                    form.avatarColor === color ? 'ring-2 ring-sage-500 ring-offset-2 scale-110' : ''
                  }`}
                />
              ))}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4" /> Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => updateField('name', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800"
            />
          </div>

          {/* Birth Date */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4" /> Geburtsdatum
            </label>
            <input
              type="date"
              value={form.birthDate}
              onChange={e => updateField('birthDate', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800"
            />
          </div>

          {/* Sex */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4" /> Geschlecht (für Perzentilen)
            </label>
            <select
              value={form.sex}
              onChange={e => updateField('sex', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800"
            >
              <option value="">Nicht angegeben</option>
              <option value="female">Mädchen</option>
              <option value="male">Junge</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Ohne Angabe können keine medizinischen Perzentilen berechnet werden.
            </p>
          </div>

          {/* Height & Weight */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Ruler className="w-4 h-4" /> Größe (cm)
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
                <Weight className="w-4 h-4" /> Gewicht (kg)
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
              <AlertTriangle className="w-4 h-4" /> Allergien & Unverträglichkeiten
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
            <div className="flex gap-2">
              <input
                type="text"
                value={customAllergen}
                onChange={e => setCustomAllergen(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomAllergen())}
                placeholder="Weitere Allergie..."
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
            {form.knownAllergies.filter(a => !commonAllergens.includes(a)).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.knownAllergies.filter(a => !commonAllergens.includes(a)).map(allergen => (
                  <span key={allergen} className="px-3 py-1.5 rounded-full text-sm font-medium bg-rose-100 text-rose-700 ring-1 ring-rose-300 flex items-center gap-1">
                    {allergen}
                    <button type="button" onClick={() => toggleAllergen(allergen)} className="cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Known Conditions */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Heart className="w-4 h-4" /> Vorerkrankungen
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Bei Diabetes bitte Typ 1 oder Typ 2 gezielt auswählen.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {commonConditions.map(condition => (
                <button
                  key={condition}
                  type="button"
                  onClick={() => toggleCondition(condition)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition cursor-pointer ${
                    form.knownConditions.includes(condition)
                      ? 'bg-sky-100 text-sky-700 ring-1 ring-sky-300'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-sage-300'
                  }`}
                >
                  {condition}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customCondition}
                onChange={e => setCustomCondition(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomCondition())}
                placeholder="Weitere Vorerkrankung..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-sm text-gray-800 placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={addCustomCondition}
                className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center cursor-pointer hover:bg-sage-200 transition"
              >
                <Plus className="w-4 h-4 text-sage-700" />
              </button>
            </div>
            {form.knownConditions.filter(c => !commonConditions.includes(c)).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.knownConditions.filter(c => !commonConditions.includes(c)).map(condition => (
                  <span key={condition} className="px-3 py-1.5 rounded-full text-sm font-medium bg-sky-100 text-sky-700 ring-1 ring-sky-300 flex items-center gap-1">
                    {condition}
                    <button type="button" onClick={() => toggleCondition(condition)} className="cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || !form.birthDate}
              className="w-full bg-sage-500 hover:bg-sage-600 disabled:opacity-50 text-white font-semibold py-3.5 rounded-2xl transition-colors cursor-pointer"
            >
              Änderungen speichern
            </button>

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium text-rose-500 hover:bg-rose-50 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Kind entfernen
              </button>
            ) : (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3">
                <p className="text-sm text-rose-700 text-center">
                  Wirklich <strong>{child.name}</strong> und alle zugehörigen Daten löschen?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white text-gray-600 cursor-pointer"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={() => onDelete(child.id)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-rose-500 text-white cursor-pointer"
                  >
                    Ja, löschen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
