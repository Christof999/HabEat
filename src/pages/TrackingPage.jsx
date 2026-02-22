import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Image, Sparkles, Loader2, MapPin, StickyNote, Check, AlertCircle, Baby, Clock, Droplets } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { analyzeImageWithGemini } from '../lib/gemini';

export default function TrackingPage() {
  const { state, dispatch, activeChild } = useApp();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('capture'); // capture, analyzing, review, breastfeeding, formula
  const [imagePreview, setImagePreview] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);

  // Breastfeeding state
  const [bfDuration, setBfDuration] = useState('');
  const [bfSide, setBfSide] = useState(null); // 'left', 'right', 'both'

  // Formula state
  const [formulaAmount, setFormulaAmount] = useState('');
  const [formulaBrand, setFormulaBrand] = useState('');

  const handleCapture = (source) => {
    if (source === 'camera') {
      fileInputRef.current.setAttribute('capture', 'environment');
    } else {
      fileInputRef.current.removeAttribute('capture');
    }
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target.result);
      runGeminiAnalysis(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const runGeminiAnalysis = async (base64Image) => {
    setStep('analyzing');
    setIsAnalyzing(true);
    setAnalyzeError(null);

    const childAllergies = activeChild?.knownAllergies?.length > 0
      ? `Das Kind hat bekannte Allergien/Unverträglichkeiten: ${activeChild.knownAllergies.join(', ')}.`
      : '';
    const childConditions = activeChild?.knownConditions?.length > 0
      ? ` Das Kind hat folgende Vorerkrankungen: ${activeChild.knownConditions.join(', ')}. Berücksichtige dies bei der Bewertung (z.B. bei Diabetes auf Zucker achten).`
      : '';

    const prompt = `Du bist ein Ernährungsexperte für Kleinkinder. Analysiere dieses Foto einer Mahlzeit.
${childAllergies}${childConditions}

Erkenne:
1. Was ist auf dem Teller? Gib einen kurzen deutschen Titel.
2. Liste alle erkennbaren Zutaten auf.
3. Schätze die Nährwerte (für eine Kinderportion).
4. Prüfe auf häufige Allergene (Milch, Ei, Gluten, Nüsse, Soja, Fisch, Schalentiere).

Antworte NUR mit diesem JSON-Format, ohne Markdown:
{
  "title": "Bezeichnung der Mahlzeit",
  "ingredients": ["Zutat1", "Zutat2"],
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "summary": "Kurze Bewertung der Mahlzeit (1 Satz)",
  "allergens": ["nur wenn Allergene erkannt wurden"]
}`;

    try {
      const response = await analyzeImageWithGemini(base64Image, prompt);
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      setAnalysis({
        title: parsed.title || 'Mahlzeit',
        ingredients: parsed.ingredients || [],
        calories: parsed.calories || 0,
        protein: parsed.protein || 0,
        carbs: parsed.carbs || 0,
        fat: parsed.fat || 0,
        summary: parsed.summary || '',
        allergens: parsed.allergens || [],
      });
      setTitle(parsed.title || 'Mahlzeit');
      setIsAnalyzing(false);
      setStep('review');
    } catch (err) {
      console.error('Gemini analysis failed:', err);
      setIsAnalyzing(false);
      setAnalyzeError(err.message);
      setStep('capture');
    }
  };

  const handleSave = () => {
    const meal = {
      id: crypto.randomUUID(),
      childId: state.activeChildId,
      timestamp: new Date().toISOString(),
      mealType: 'food',
      imageUrl: imagePreview,
      title: title || analysis?.title || 'Mahlzeit',
      summary: analysis?.summary || '',
      ingredients: analysis?.ingredients || [],
      calories: analysis?.calories,
      protein: analysis?.protein,
      carbs: analysis?.carbs,
      fat: analysis?.fat,
      allergens: analysis?.allergens || [],
      notes,
    };
    dispatch({ type: 'ADD_MEAL', payload: meal });
    navigate('/');
  };

  const handleSaveBreastfeeding = () => {
    const duration = bfDuration ? parseInt(bfDuration, 10) : null;
    if (!duration) return;
    const meal = {
      id: crypto.randomUUID(),
      childId: state.activeChildId,
      timestamp: new Date().toISOString(),
      mealType: 'breastfeeding',
      title: 'Stillen',
      duration,
      side: bfSide,
      notes,
    };
    dispatch({ type: 'ADD_MEAL', payload: meal });
    navigate('/');
  };

  const handleSaveFormula = () => {
    const amount = formulaAmount ? parseInt(formulaAmount, 10) : null;
    if (!amount) return;
    const meal = {
      id: crypto.randomUUID(),
      childId: state.activeChildId,
      timestamp: new Date().toISOString(),
      mealType: 'formula',
      title: formulaBrand ? `Pre-Nahrung (${formulaBrand})` : 'Pre-Nahrung',
      amount,
      brand: formulaBrand || null,
      notes,
    };
    dispatch({ type: 'ADD_MEAL', payload: meal });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <div className="sticky top-0 bg-warm-50/80 backdrop-blur-sm z-10 px-6 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="font-bold text-lg text-gray-800">Mahlzeit erfassen</h2>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Step: Capture */}
      {step === 'capture' && (
        <div className="px-6 py-8 space-y-4">
          <p className="text-center text-gray-500 mb-6">
            Fotografiere die Mahlzeit oder wähle ein Bild aus der Galerie.
          </p>

          {analyzeError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <p className="text-sm text-rose-600">{analyzeError}</p>
            </div>
          )}

          <button
            onClick={() => handleCapture('camera')}
            className="w-full bg-white rounded-2xl p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition cursor-pointer"
          >
            <div className="w-14 h-14 rounded-xl bg-sage-50 flex items-center justify-center">
              <Camera className="w-6 h-6 text-sage-600" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800">Kamera</h3>
              <p className="text-sm text-gray-500">Jetzt ein Foto aufnehmen</p>
            </div>
          </button>

          <button
            onClick={() => handleCapture('gallery')}
            className="w-full bg-white rounded-2xl p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition cursor-pointer"
          >
            <div className="w-14 h-14 rounded-xl bg-sky-50 flex items-center justify-center">
              <Image className="w-6 h-6 text-sky-600" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800">Galerie</h3>
              <p className="text-sm text-gray-500">Ein vorhandenes Foto auswählen</p>
            </div>
          </button>

          <div className="relative flex items-center py-2">
            <div className="flex-1 border-t border-gray-200" />
            <span className="px-3 text-xs text-gray-400">Säuglingsernährung</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          <button
            onClick={() => setStep('breastfeeding')}
            className="w-full bg-white rounded-2xl p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition cursor-pointer"
          >
            <div className="w-14 h-14 rounded-xl bg-rose-50 flex items-center justify-center">
              <Baby className="w-6 h-6 text-rose-500" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800">Stillen</h3>
              <p className="text-sm text-gray-500">Stillzeit und Seite erfassen</p>
            </div>
          </button>

          <button
            onClick={() => setStep('formula')}
            className="w-full bg-white rounded-2xl p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition cursor-pointer"
          >
            <div className="w-14 h-14 rounded-xl bg-warm-50 flex items-center justify-center">
              <Droplets className="w-6 h-6 text-warm-600" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800">Pre-Nahrung</h3>
              <p className="text-sm text-gray-500">Fläschchen mit Menge erfassen</p>
            </div>
          </button>
        </div>
      )}

      {/* Step: Analyzing */}
      {step === 'analyzing' && isAnalyzing && (
        <div className="px-6 py-12 flex flex-col items-center gap-6">
          {imagePreview && (
            <div className="w-48 h-48 rounded-2xl overflow-hidden shadow-sm">
              <img src={imagePreview} alt="Mahlzeit" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-sage-600 animate-spin" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-gray-800">Analyse läuft...</h3>
              <p className="text-sm text-gray-500 mt-1">
                KI erkennt Zutaten und Nährstoffe
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && analysis && (
        <div className="px-6 pb-32 space-y-5">
          {/* Image Preview */}
          {imagePreview && (
            <div className="w-full h-48 rounded-2xl overflow-hidden shadow-sm">
              <img src={imagePreview} alt="Mahlzeit" className="w-full h-full object-cover" />
            </div>
          )}

          {/* AI Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-sage-50 rounded-full w-fit">
            <Sparkles className="w-3.5 h-3.5 text-sage-600" />
            <span className="text-xs font-medium text-sage-700">KI-Analyse abgeschlossen</span>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Bezeichnung</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800"
            />
          </div>

          {/* Nutrients */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Kalorien', value: analysis.calories, unit: 'kcal', bg: 'bg-warm-50' },
              { label: 'Protein', value: analysis.protein, unit: 'g', bg: 'bg-rose-50' },
              { label: 'Kohlenhydrate', value: analysis.carbs, unit: 'g', bg: 'bg-warm-50' },
              { label: 'Fett', value: analysis.fat, unit: 'g', bg: 'bg-sky-50' },
            ].map(n => (
              <div key={n.label} className={`${n.bg} rounded-xl p-3`}>
                <span className="text-xs text-gray-500">{n.label}</span>
                <p className="text-lg font-bold text-gray-800 mt-0.5">
                  {n.value} <span className="text-sm font-normal text-gray-400">{n.unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Ingredients */}
          {analysis.ingredients.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Erkannte Zutaten</h3>
              <div className="flex flex-wrap gap-1.5">
                {analysis.ingredients.map((ing, i) => (
                  <span key={i} className="px-3 py-1 rounded-full text-xs font-medium bg-sage-50 text-sage-700">
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Allergen Warning */}
          {analysis.allergens.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-semibold text-rose-700">Allergene erkannt</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.allergens.map((allergen, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                    {allergen}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <StickyNote className="w-4 h-4" />
              Notizen (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="z.B. Hat gut geschmeckt, alles aufgegessen..."
              className="w-full px-4 py-3 rounded-xl bg-white border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800 placeholder:text-gray-400 resize-none"
            />
          </div>

          {/* Location Info */}
          <button className="w-full bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md transition">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Standort hinzufügen (optional)</span>
          </button>

          {/* Save Button */}
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-warm-50 via-warm-50 to-transparent safe-bottom">
            <button
              onClick={handleSave}
              className="w-full bg-sage-500 hover:bg-sage-600 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Check className="w-5 h-5" />
              Mahlzeit speichern
            </button>
          </div>
        </div>
      )}

      {/* Step: Breastfeeding */}
      {step === 'breastfeeding' && (
        <div className="px-6 pb-32 space-y-5">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center">
              <Baby className="w-8 h-8 text-rose-500" />
            </div>
            <h3 className="font-bold text-lg text-gray-800">Stillen erfassen</h3>
          </div>

          {/* Duration */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4" /> Dauer (Minuten)
            </label>
            <input
              type="number"
              value={bfDuration}
              onChange={e => setBfDuration(e.target.value)}
              placeholder="z.B. 15"
              className="w-full px-4 py-3 rounded-xl bg-white border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800 placeholder:text-gray-400"
            />
          </div>

          {/* Side */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Seite (optional)</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'left', label: 'Links' },
                { value: 'right', label: 'Rechts' },
                { value: 'both', label: 'Beide' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setBfSide(bfSide === opt.value ? null : opt.value)}
                  className={`py-3 rounded-xl text-sm font-medium transition cursor-pointer ${
                    bfSide === opt.value
                      ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-300'
                      : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <StickyNote className="w-4 h-4" /> Notizen (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="z.B. Gut getrunken, ruhig..."
              className="w-full px-4 py-3 rounded-xl bg-white border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800 placeholder:text-gray-400 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-warm-50 via-warm-50 to-transparent safe-bottom">
            <div className="flex gap-2">
              <button
                onClick={() => { setStep('capture'); setNotes(''); setBfDuration(''); setBfSide(null); }}
                className="flex-1 py-4 rounded-2xl text-sm font-medium bg-gray-100 text-gray-600 cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveBreastfeeding}
                disabled={!bfDuration}
                className="flex-2 py-4 px-6 rounded-2xl text-sm font-semibold bg-sage-500 hover:bg-sage-600 text-white cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
              >
                <Check className="w-5 h-5" />
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step: Formula */}
      {step === 'formula' && (
        <div className="px-6 pb-32 space-y-5">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-16 h-16 rounded-full bg-warm-50 flex items-center justify-center">
              <Droplets className="w-8 h-8 text-warm-600" />
            </div>
            <h3 className="font-bold text-lg text-gray-800">Pre-Nahrung erfassen</h3>
          </div>

          {/* Amount */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Droplets className="w-4 h-4" /> Menge (ml)
            </label>
            <input
              type="number"
              value={formulaAmount}
              onChange={e => setFormulaAmount(e.target.value)}
              placeholder="z.B. 150"
              className="w-full px-4 py-3 rounded-xl bg-white border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800 placeholder:text-gray-400"
            />
          </div>

          {/* Brand (optional) */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Marke (optional)</label>
            <input
              type="text"
              value={formulaBrand}
              onChange={e => setFormulaBrand(e.target.value)}
              placeholder="z.B. Aptamil, Hipp..."
              className="w-full px-4 py-3 rounded-xl bg-white border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800 placeholder:text-gray-400"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <StickyNote className="w-4 h-4" /> Notizen (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="z.B. Gut getrunken, Temperatur ok..."
              className="w-full px-4 py-3 rounded-xl bg-white border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800 placeholder:text-gray-400 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-warm-50 via-warm-50 to-transparent safe-bottom">
            <div className="flex gap-2">
              <button
                onClick={() => { setStep('capture'); setNotes(''); setFormulaAmount(''); setFormulaBrand(''); }}
                className="flex-1 py-4 rounded-2xl text-sm font-medium bg-gray-100 text-gray-600 cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveFormula}
                disabled={!formulaAmount}
                className="flex-2 py-4 px-6 rounded-2xl text-sm font-semibold bg-sage-500 hover:bg-sage-600 text-white cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
              >
                <Check className="w-5 h-5" />
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
