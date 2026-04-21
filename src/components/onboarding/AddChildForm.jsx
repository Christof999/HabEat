import { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  X,
  User,
  Calendar,
  Ruler,
  Weight,
  AlertTriangle,
  Camera,
  Loader2,
} from 'lucide-react';
import { uploadChildAvatar } from '../../lib/childPhotoStorage';

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
  /** Für Profilbild-Upload (Firebase Storage) */
  username = null,
  /** 'edit' zeigt zusätzlich „Speichern“ in der Kopfzeile */
  mode = 'add',
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
  const [photoUrl, setPhotoUrl] = useState(initialChild?.photoUrl || '');
  const [localPhotoPreview, setLocalPhotoPreview] = useState(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef(null);

  const [customAllergen, setCustomAllergen] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    return () => {
      if (localPhotoPreview) URL.revokeObjectURL(localPhotoPreview);
    };
  }, [localPhotoPreview]);

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

  const handlePickPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) {
      setPhotoError('Bitte wähle eine Bilddatei.');
      return;
    }
    const maxMb = 4;
    if (file.size > maxMb * 1024 * 1024) {
      setPhotoError(`Das Bild darf maximal ${maxMb} MB groß sein.`);
      return;
    }
    setPhotoError('');
    setPendingPhotoFile(file);
    setLocalPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const clearPhoto = () => {
    setPendingPhotoFile(null);
    setLocalPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPhotoUrl('');
    setPhotoError('');
  };

  const buildChildPayload = async () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return null;
    }

    const id = initialChild?.id || crypto.randomUUID();
    let finalPhotoUrl = photoUrl || null;

    if (pendingPhotoFile) {
      if (!username?.trim()) {
        setPhotoError('Profilbild ist nur nach Anmeldung möglich.');
        return null;
      }
      setPhotoUploading(true);
      setPhotoError('');
      try {
        finalPhotoUrl = await uploadChildAvatar(username, id, pendingPhotoFile);
        setPhotoUrl(finalPhotoUrl);
        setPendingPhotoFile(null);
        setLocalPhotoPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      } catch (err) {
        console.error('Avatar upload failed:', err);
        setPhotoError('Bild konnte nicht hochgeladen werden. Bitte später erneut versuchen.');
        setPhotoUploading(false);
        return null;
      }
      setPhotoUploading(false);
    }

    return {
      ...form,
      id,
      photoUrl: finalPhotoUrl,
      height: form.height ? parseFloat(form.height) : null,
      weight: form.weight ? parseFloat(form.weight) : null,
      createdAt: initialChild?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = await buildChildPayload();
    if (payload) onAdd(payload);
  };

  const handleHeaderSave = async () => {
    const payload = await buildChildPayload();
    if (payload) onAdd(payload);
  };

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <div className="sticky top-0 bg-warm-50/80 backdrop-blur-sm z-30 px-6 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-lg text-gray-800">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={handleHeaderSave}
            disabled={photoUploading}
            className="shrink-0 px-4 py-2 rounded-xl bg-sage-500 hover:bg-sage-600 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer transition-colors"
          >
            {photoUploading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" />
                Speichern
              </span>
            ) : (
              'Speichern'
            )}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="px-6 pb-32 space-y-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePickPhoto}
        />

        {/* Avatar Preview + Foto */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={photoUploading}
            className={`relative w-24 h-24 rounded-full ${form.avatarColor} flex items-center justify-center shadow-sm overflow-hidden ring-2 ring-white cursor-pointer disabled:opacity-60`}
          >
            {localPhotoPreview || photoUrl ? (
              <img
                src={localPhotoPreview || photoUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : form.name ? (
              <span className="text-3xl font-bold text-gray-700">
                {(form.name?.trim()?.[0] || '?').toUpperCase()}
              </span>
            ) : (
              <User className="w-10 h-10 text-gray-400" />
            )}
            <span className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center border border-sage-100">
              <Camera className="w-4 h-4 text-sage-600" />
            </span>
          </button>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading}
              className="text-sm font-medium text-sage-600 hover:text-sage-700 cursor-pointer disabled:opacity-50"
            >
              Foto wählen
            </button>
            {(localPhotoPreview || photoUrl) && (
              <button
                type="button"
                onClick={clearPhoto}
                disabled={photoUploading}
                className="text-sm text-gray-500 hover:text-rose-600 cursor-pointer disabled:opacity-50"
              >
                Foto entfernen
              </button>
            )}
          </div>
          {photoError && <p className="text-rose-500 text-xs text-center px-2">{photoError}</p>}
          {!username && (
            <p className="text-xs text-gray-400 text-center max-w-xs">
              Profilbilder werden in der Cloud gespeichert (nach Anmeldung).
            </p>
          )}
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
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-warm-50 via-warm-50 to-transparent safe-bottom z-50 max-w-lg mx-auto">
          <button
            type="submit"
            disabled={photoUploading}
            className="w-full bg-sage-500 hover:bg-sage-600 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            {photoUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Wird gespeichert…
              </>
            ) : (
              <>
                {submitLabel}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
