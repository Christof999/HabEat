import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Image, Sparkles, Loader2, MapPin, StickyNote, Check, AlertCircle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export default function TrackingPage() {
  const { state, dispatch, activeChild } = useApp();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('capture'); // capture, analyzing, review
  const [imagePreview, setImagePreview] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);

  const runMealVerification = async (base64Image) => {
    const response = await fetch('/api/meals/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64Image,
        childContext: {
          allergies: activeChild?.allergies || [],
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || `API Fehler: ${response.status}`);
    }

    return data;
  };

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

    try {
      const verified = await runMealVerification(base64Image);
      const parsed = verified.corrected || verified.analysis;

      setAnalysis({
        title: parsed.title || 'Mahlzeit',
        ingredients: parsed.ingredients || [],
        calories: parsed.calories || 0,
        protein: parsed.protein || 0,
        carbs: parsed.carbs || 0,
        fat: parsed.fat || 0,
        summary: parsed.summary || '',
        allergens: parsed.allergens || [],
        confidence: verified.confidence ?? null,
        flags: verified.flags || [],
        original: verified.analysis || null,
        openFoodFacts: verified.openFoodFacts || null,
      });
      setTitle(parsed.title || 'Mahlzeit');
      setIsAnalyzing(false);
      setStep('review');
    } catch (err) {
      console.error('Meal verification failed:', err);
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
      imageUrl: imagePreview,
      title: title || analysis?.title || 'Mahlzeit',
      summary: analysis?.summary || '',
      ingredients: analysis?.ingredients || [],
      calories: analysis?.calories,
      protein: analysis?.protein,
      carbs: analysis?.carbs,
      fat: analysis?.fat,
      allergens: analysis?.allergens || [],
      aiConfidence: analysis?.confidence ?? null,
      aiFlags: analysis?.flags || [],
      aiOriginal: analysis?.original || null,
      aiOpenFoodFacts: analysis?.openFoodFacts || null,
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

          {(analysis.confidence != null || analysis.flags?.length > 0) && (
            <div className="bg-white border border-sage-200 rounded-xl p-4">
              {analysis.confidence != null && (
                <p className="text-sm text-gray-700 mb-2">
                  Gegencheck-Vertrauen: <span className="font-semibold">{analysis.confidence}%</span>
                </p>
              )}
              {analysis.openFoodFacts && (
                <p className="text-xs text-gray-500 mb-2">
                  OpenFoodFacts Treffer: {analysis.openFoodFacts.sampleSize || 0}
                </p>
              )}
              {analysis.flags?.length > 0 && (
                <div className="space-y-1.5">
                  {analysis.flags.map((flag, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-warm-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-600">{flag}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {analysis.openFoodFacts?.referencePer100g && (
            <div className="bg-white border border-sky-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">OpenFoodFacts Referenz (pro 100g)</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Kalorien', value: analysis.openFoodFacts.referencePer100g.calories, unit: 'kcal' },
                  { label: 'Protein', value: analysis.openFoodFacts.referencePer100g.protein, unit: 'g' },
                  { label: 'Kohlenhydrate', value: analysis.openFoodFacts.referencePer100g.carbs, unit: 'g' },
                  { label: 'Fett', value: analysis.openFoodFacts.referencePer100g.fat, unit: 'g' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-sky-50 px-3 py-2">
                    <p className="text-[11px] text-gray-500">{item.label}</p>
                    <p className="text-sm font-semibold text-gray-700">
                      {item.value != null ? Math.round(item.value) : '-'} {item.value != null ? item.unit : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

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
    </div>
  );
}
