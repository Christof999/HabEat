import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, Image, Sparkles, Loader2, MapPin, StickyNote, Check, AlertCircle, AlignLeft,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export default function TrackingPage() {
  const { state, dispatch, activeChild } = useApp();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const titleRef = useRef(null);

  const [step, setStep] = useState('capture'); // capture, textDescribe, analyzing, review
  const [imagePreview, setImagePreview] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [kiContext, setKiContext] = useState('');
  const [textDescribeInput, setTextDescribeInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [quickType, setQuickType] = useState(null);
  const [preForm, setPreForm] = useState({ brand: '', preparedMl: '', consumedMl: '', comment: '' });
  const [breastForm, setBreastForm] = useState({ durationMin: '', side: 'links', comment: '' });
  /** Optional fürs Foto: Gramm/Portion für robustere OFF-Schätzung (API: portionHints) */
  const [portionHints, setPortionHints] = useState('');
  /** Einklappbar: Datenbank-Referenzen, Flags, Vertrauen */
  const [reviewDetailsOpen, setReviewDetailsOpen] = useState(false);
  const [kiSectionOpen, setKiSectionOpen] = useState(false);

  const adjustTitleHeight = useCallback(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 48), 280)}px`;
  }, []);

  useEffect(() => {
    if (step === 'review') adjustTitleHeight();
  }, [title, step, adjustTitleHeight]);

  const parseApiResponse = async (response) => {
    const raw = await response.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      throw new Error(data?.error || raw || `API Fehler: ${response.status}`);
    }
    if (!data) {
      throw new Error('API Antwort konnte nicht gelesen werden.');
    }
    return data;
  };

  const callVerifyApi = async (extraBody) => {
    const response = await fetch('/api/meals/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adultNutrition: state.adultNutrition,
        childContext: {
          allergies: activeChild?.allergies || [],
        },
        ...extraBody,
      }),
    });
    return parseApiResponse(response);
  };

  const applyVerifiedResult = (data) => {
    const parsed = data.corrected || data.analysis;
    setAnalysis({
      title: parsed.title || 'Mahlzeit',
      ingredients: parsed.ingredients || [],
      calories: parsed.calories ?? 0,
      protein: parsed.protein ?? 0,
      carbs: parsed.carbs ?? 0,
      fat: parsed.fat ?? 0,
      summary: parsed.summary || '',
      allergens: parsed.allergens || [],
      confidence: data.confidence ?? null,
      flags: data.flags || [],
      original: data.analysis || null,
      openFoodFacts: data.openFoodFacts || null,
      blsBasis: data.blsBasis || null,
    });
    setTitle(parsed.title || 'Mahlzeit');
  };

  const parseNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };

  const roundOne = (number) => Math.round(number * 10) / 10;

  const handleQuickMeal = (type) => {
    setQuickType(prev => (prev === type ? null : type));
  };

  const handleCreatePreMeal = () => {
    const preparedMl = parseNumber(preForm.preparedMl);
    const consumedMl = parseNumber(preForm.consumedMl);
    const effectiveMl = consumedMl || preparedMl;

    if (!effectiveMl) {
      setAnalyzeError('Bitte gib mindestens die getrunkene oder zubereitete Menge in ml ein.');
      return;
    }

    const brand = preForm.brand.trim();
    const calories = roundOne(effectiveMl * 0.67);
    const protein = roundOne(effectiveMl * 0.013);
    const carbs = roundOne(effectiveMl * 0.072);
    const fat = roundOne(effectiveMl * 0.036);

    setImagePreview(null);
    setAnalyzeError(null);
    setAnalysis({
      title: brand ? `Pre-Nahrung (${brand})` : 'Pre-Nahrung',
      ingredients: brand ? ['Pre-Nahrung', brand] : ['Pre-Nahrung'],
      calories,
      protein,
      carbs,
      fat,
      summary: `Manuell erfasst: ${effectiveMl} ml Pre-Nahrung.`,
      allergens: [],
      confidence: null,
      flags: [],
      original: null,
      openFoodFacts: null,
      blsBasis: null,
      feedingType: 'pre',
      feedingDetails: {
        brand,
        preparedMl: preparedMl || null,
        consumedMl: consumedMl || null,
      },
    });
    setNotes(preForm.comment.trim());
    setTitle(brand ? `Pre-Nahrung (${brand})` : 'Pre-Nahrung');
    setKiContext('');
    setStep('review');
    setQuickType(null);
  };

  const handleCreateBreastMeal = () => {
    const durationMin = parseNumber(breastForm.durationMin);
    if (!durationMin) {
      setAnalyzeError('Bitte gib die Dauer des Stillens in Minuten ein.');
      return;
    }

    const calories = roundOne(durationMin * 1.3);

    setImagePreview(null);
    setAnalyzeError(null);
    setAnalysis({
      title: 'Stillen',
      ingredients: ['Muttermilch'],
      calories,
      protein: null,
      carbs: null,
      fat: null,
      summary: `Manuell erfasst: ${durationMin} Minuten (${breastForm.side}).`,
      allergens: [],
      confidence: null,
      flags: [],
      original: null,
      openFoodFacts: null,
      blsBasis: null,
      feedingType: 'breastfeeding',
      feedingDetails: {
        durationMin,
        side: breastForm.side,
        comment: breastForm.comment.trim(),
      },
    });
    setNotes(breastForm.comment.trim());
    setTitle('Stillen');
    setKiContext('');
    setStep('review');
    setQuickType(null);
  };

  const handleCapture = (source) => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (source === 'camera') {
      fileInputRef.current.setAttribute('capture', 'environment');
    } else {
      fileInputRef.current.removeAttribute('capture');
    }
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setAnalyzeError(null);
    setQuickType(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result;
      if (typeof base64 !== 'string') {
        setAnalyzeError('Das ausgewählte Bild konnte nicht gelesen werden. Bitte ein anderes Bild wählen.');
        return;
      }

      setImagePreview(base64);
      runGeminiAnalysis(base64);
    };
    reader.onerror = () => {
      setAnalyzeError('Bild konnte nicht geladen werden. Bitte erneut versuchen oder ein anderes Format wählen.');
    };
    reader.readAsDataURL(file);
  };

  const runGeminiAnalysis = async (base64Image) => {
    setStep('analyzing');
    setIsAnalyzing(true);
    setAnalyzeError(null);
    setKiContext('');

    try {
      const verified = await callVerifyApi({
        imageBase64: base64Image,
        ...(portionHints.trim() ? { portionHints: portionHints.trim().slice(0, 500) } : {}),
      });
      applyVerifiedResult(verified);
      setPortionHints('');
      setIsAnalyzing(false);
      setStep('review');
    } catch (err) {
      console.error('Meal verification failed:', err);
      setIsAnalyzing(false);
      setAnalyzeError(err.message);
      setStep('capture');
    }
  };

  const runTextAnalysis = async () => {
    const t = textDescribeInput.trim();
    if (t.length < 10) {
      setAnalyzeError('Bitte beschreibe die Mahlzeit etwas ausführlicher (mindestens 10 Zeichen).');
      return;
    }
    setStep('analyzing');
    setIsAnalyzing(true);
    setAnalyzeError(null);
    setImagePreview(null);
    setKiContext('');

    try {
      const verified = await callVerifyApi({ mealDescription: t });
      applyVerifiedResult(verified);
      setTextDescribeInput('');
      setIsAnalyzing(false);
      setStep('review');
    } catch (err) {
      console.error('Text meal verification failed:', err);
      setIsAnalyzing(false);
      setAnalyzeError(err.message);
      setStep('textDescribe');
    }
  };

  const runRefinement = async () => {
    if (!analysis) return;
    const ctx = kiContext.trim();
    if (ctx.length < 3) {
      setAnalyzeError('Kontext für die KI: bitte mindestens 3 Zeichen.');
      return;
    }
    setAnalyzeError(null);
    setIsRefining(true);
    try {
      const previousMeal = {
        title: (title.trim() || analysis.title || 'Mahlzeit').slice(0, 120),
        ingredients: analysis.ingredients || [],
        calories: Number(analysis.calories) || 0,
        protein: Number(analysis.protein) || 0,
        carbs: Number(analysis.carbs) || 0,
        fat: Number(analysis.fat) || 0,
        summary: (analysis.summary || '').slice(0, 500),
        allergens: analysis.allergens || [],
      };
      const verified = await callVerifyApi({
        previousMeal,
        userContext: ctx.slice(0, 2000),
      });
      applyVerifiedResult(verified);
      setKiContext('');
    } catch (err) {
      console.error('Refine meal failed:', err);
      setAnalyzeError(err.message);
    } finally {
      setIsRefining(false);
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
      aiBlsBasis: analysis?.blsBasis || null,
      feedingType: analysis?.feedingType || null,
      feedingDetails: analysis?.feedingDetails || null,
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
          type="button"
          onClick={() => {
            if (step === 'textDescribe') {
              setStep('capture');
              setAnalyzeError(null);
            } else {
              navigate(-1);
            }
          }}
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
          <p className="text-center text-gray-500 mb-4">
            Fotografiere die Mahlzeit oder wähle ein Bild aus der Galerie.
          </p>

          <div className="mb-4">
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              Optional: Portions-Hinweis fürs Foto (z. B. „250 g“, „halber Teller“)
            </label>
            <input
              type="text"
              value={portionHints}
              onChange={(e) => setPortionHints(e.target.value)}
              maxLength={500}
              placeholder="Leer lassen, wenn nicht nötig"
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-sage-200 text-sm text-gray-800 placeholder:text-gray-400"
            />
          </div>

          {analyzeError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <p className="text-sm text-rose-600">{analyzeError}</p>
            </div>
          )}

          <button
            type="button"
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
            type="button"
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

          <button
            type="button"
            onClick={() => {
              setAnalyzeError(null);
              setTextDescribeInput('');
              setStep('textDescribe');
            }}
            className="w-full bg-white rounded-2xl p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition cursor-pointer border border-dashed border-sage-200"
          >
            <div className="w-14 h-14 rounded-xl bg-warm-100 flex items-center justify-center">
              <AlignLeft className="w-6 h-6 text-warm-700" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800">Nur Text</h3>
              <p className="text-sm text-gray-500">Mahlzeit beschreiben – ohne Foto</p>
            </div>
          </button>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => handleQuickMeal('breastfeeding')}
              className={`rounded-xl px-4 py-3 text-sm font-medium shadow-sm hover:shadow-md transition cursor-pointer ${
                quickType === 'breastfeeding' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-white text-gray-700'
              }`}
            >
              Stillen erfassen
            </button>
            <button
              onClick={() => handleQuickMeal('pre')}
              className={`rounded-xl px-4 py-3 text-sm font-medium shadow-sm hover:shadow-md transition cursor-pointer ${
                quickType === 'pre' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-white text-gray-700'
              }`}
            >
              Pre-Nahrung erfassen
            </button>
          </div>

          {quickType === 'pre' && (
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">Pre-Nahrung Details</h3>
              <input
                value={preForm.brand}
                onChange={e => setPreForm(prev => ({ ...prev, brand: e.target.value }))}
                placeholder="Marke (z. B. Aptamil)"
                className="w-full px-3 py-2 rounded-xl bg-warm-50 border border-sage-200 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={preForm.preparedMl}
                  onChange={e => setPreForm(prev => ({ ...prev, preparedMl: e.target.value }))}
                  placeholder="zubereitet (ml)"
                  className="w-full px-3 py-2 rounded-xl bg-warm-50 border border-sage-200 text-sm"
                />
                <input
                  type="number"
                  value={preForm.consumedMl}
                  onChange={e => setPreForm(prev => ({ ...prev, consumedMl: e.target.value }))}
                  placeholder="getrunken (ml)"
                  className="w-full px-3 py-2 rounded-xl bg-warm-50 border border-sage-200 text-sm"
                />
              </div>
              <textarea
                rows={2}
                value={preForm.comment}
                onChange={e => setPreForm(prev => ({ ...prev, comment: e.target.value }))}
                placeholder="Kommentar (optional)"
                className="w-full px-3 py-2 rounded-xl bg-warm-50 border border-sage-200 text-sm resize-none"
              />
              <button
                onClick={handleCreatePreMeal}
                className="w-full bg-sage-500 hover:bg-sage-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Pre-Mahlzeit übernehmen
              </button>
            </div>
          )}

          {quickType === 'breastfeeding' && (
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">Stillen Details</h3>
              <input
                type="number"
                value={breastForm.durationMin}
                onChange={e => setBreastForm(prev => ({ ...prev, durationMin: e.target.value }))}
                placeholder="Dauer (Minuten)"
                className="w-full px-3 py-2 rounded-xl bg-warm-50 border border-sage-200 text-sm"
              />
              <select
                value={breastForm.side}
                onChange={e => setBreastForm(prev => ({ ...prev, side: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-warm-50 border border-sage-200 text-sm"
              >
                <option value="links">Links</option>
                <option value="rechts">Rechts</option>
                <option value="beide">Beide</option>
              </select>
              <textarea
                rows={2}
                value={breastForm.comment}
                onChange={e => setBreastForm(prev => ({ ...prev, comment: e.target.value }))}
                placeholder="Kommentar (optional)"
                className="w-full px-3 py-2 rounded-xl bg-warm-50 border border-sage-200 text-sm resize-none"
              />
              <button
                onClick={handleCreateBreastMeal}
                className="w-full bg-sage-500 hover:bg-sage-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Stillmahlzeit übernehmen
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step: Textbeschreibung */}
      {step === 'textDescribe' && (
        <div className="px-6 py-8 space-y-4">
          <p className="text-sm text-gray-600">
            Beschreibe Gericht, ungefähre Menge und Zubereitung – die KI schätzt daraus Zutaten und Nährwerte (wie bei einer Fotoanalyse).
          </p>
          {analyzeError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <p className="text-sm text-rose-600">{analyzeError}</p>
            </div>
          )}
          <textarea
            value={textDescribeInput}
            onChange={(e) => { setTextDescribeInput(e.target.value); setAnalyzeError(null); }}
            rows={6}
            placeholder="z. B. Ca. halber Teller Vollkornnudeln mit Tomatensoße und geriebenem Parmesan, dazu ein kleiner Salat mit Öl …"
            className="w-full px-4 py-3 rounded-2xl bg-white border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 text-gray-800 placeholder:text-gray-400 resize-y min-h-[140px]"
          />
          <p className="text-xs text-gray-400">Mindestens 10 Zeichen.</p>
          <button
            type="button"
            onClick={runTextAnalysis}
            disabled={textDescribeInput.trim().length < 10}
            className="w-full bg-sage-500 hover:bg-sage-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Sparkles className="w-5 h-5" />
            Mit KI auswerten
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
                {imagePreview
                  ? 'KI erkennt Zutaten und Nährwerte'
                  : 'KI wertet deine Beschreibung aus'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && analysis && (
        <div className="px-6 pb-32 space-y-4">
          {imagePreview && (
            <div className="w-full h-44 rounded-2xl overflow-hidden shadow-sm ring-1 ring-black/5">
              <img src={imagePreview} alt="Mahlzeit" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-800">
                {analysis.feedingType ? 'Mahlzeit prüfen' : 'Deine Mahlzeit'}
              </h2>
              {!analysis.feedingType && (
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-sage-500 shrink-0" />
                  {analysis.confidence != null
                    ? `${analysis.confidence}% Plausibilität`
                    : 'KI-Schätzung'}
                </p>
              )}
            </div>
            {!analysis.feedingType && (analysis.flags?.length > 0 || analysis.openFoodFacts?.matched || analysis.blsBasis?.matched) && (
              <button
                type="button"
                onClick={() => setReviewDetailsOpen((o) => !o)}
                className={`shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  analysis.flags?.length
                    ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Details
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${reviewDetailsOpen ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>

          {analyzeError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <p className="text-sm text-rose-600">{analyzeError}</p>
            </div>
          )}

          {reviewDetailsOpen && !analysis.feedingType && (
            <div className="rounded-2xl border border-gray-200/90 bg-white p-4 space-y-4 shadow-sm">
              {analysis.confidence != null && (
                <p className="text-sm text-gray-700">
                  Gegencheck: <span className="font-semibold tabular-nums">{analysis.confidence}%</span>
                </p>
              )}
              {analysis.flags?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hinweise</p>
                  <ul className="space-y-2">
                    {analysis.flags.map((flag, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-600 leading-snug">
                        <span className="text-amber-500 shrink-0 mt-0.5">·</span>
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.openFoodFacts?.referencePer100g && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Open Food Facts · pro 100 g</p>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {[
                      { label: 'kcal', value: analysis.openFoodFacts.referencePer100g.calories },
                      { label: 'EW', value: analysis.openFoodFacts.referencePer100g.protein, u: 'g' },
                      { label: 'KH', value: analysis.openFoodFacts.referencePer100g.carbs, u: 'g' },
                      { label: 'Fett', value: analysis.openFoodFacts.referencePer100g.fat, u: 'g' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg bg-slate-50 py-2 px-1">
                        <p className="text-[10px] text-gray-400 uppercase">{item.label}</p>
                        <p className="text-xs font-semibold text-gray-800 tabular-nums">
                          {item.value != null ? Math.round(item.value) : '–'}
                          {item.u && item.value != null ? item.u : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                  {(analysis.openFoodFacts?.sampleSize ?? 0) > 0 && (
                    <p className="text-[11px] text-gray-400 mt-1.5">{analysis.openFoodFacts.sampleSize} Produktvergleiche</p>
                  )}
                </div>
              )}
              {analysis.blsBasis?.matched && analysis.blsBasis.referencePer100g && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">BLS (DE) · pro 100 g</p>
                  <p className="text-[11px] text-gray-400 mb-2 line-clamp-2">{analysis.blsBasis.nameDe}</p>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {[
                      { label: 'kcal', value: analysis.blsBasis.referencePer100g.calories },
                      { label: 'EW', value: analysis.blsBasis.referencePer100g.protein, u: 'g' },
                      { label: 'KH', value: analysis.blsBasis.referencePer100g.carbs, u: 'g' },
                      { label: 'Fett', value: analysis.blsBasis.referencePer100g.fat, u: 'g' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg bg-emerald-50/80 py-2 px-1">
                        <p className="text-[10px] text-emerald-700/70 uppercase">{item.label}</p>
                        <p className="text-xs font-semibold text-gray-800 tabular-nums">
                          {item.value != null ? Math.round(item.value) : '–'}
                          {item.u && item.value != null ? item.u : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Title (wächst mit Inhalt) */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Bezeichnung</label>
            <textarea
              ref={titleRef}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                requestAnimationFrame(() => adjustTitleHeight());
              }}
              rows={1}
              placeholder="Name der Mahlzeit"
              className="w-full px-4 py-3 rounded-xl bg-white border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800 resize-none overflow-hidden min-h-[48px] leading-snug"
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
                  {n.value != null ? n.value : '—'}{' '}
                  <span className="text-sm font-normal text-gray-400">
                    {n.value != null ? n.unit : ''}
                  </span>
                </p>
              </div>
            ))}
          </div>

          {analysis.summary ? (
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Kurzfassung</p>
              <p className="text-sm text-gray-700">{analysis.summary}</p>
            </div>
          ) : null}

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

          {/* KI-Kontext: standardmäßig zugeklappt */}
          {!analysis.feedingType && (
            <div className="rounded-xl border border-sage-100 bg-white overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => setKiSectionOpen((o) => !o)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-sage-50/50 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-sage-600 shrink-0" />
                <span className="flex-1 text-sm font-medium text-gray-800">Eingabe für die KI anpassen</span>
                {kiContext.trim().length >= 3 && (
                  <span className="text-[11px] font-medium text-sky-600 shrink-0">Neu werten möglich</span>
                )}
                <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${kiSectionOpen ? 'rotate-180' : ''}`} />
              </button>
              {kiSectionOpen && (
                <div className="px-4 pb-4 pt-0 space-y-3 border-t border-sage-50">
                  <p className="text-xs text-gray-500 pt-3 leading-relaxed">
                    Kurz ergänzen (verdeckte Zutaten, Portion) – die Schätzung wird neu berechnet.
                  </p>
                  <textarea
                    value={kiContext}
                    onChange={(e) => { setKiContext(e.target.value); setAnalyzeError(null); }}
                    rows={3}
                    disabled={isRefining}
                    placeholder="z. B. Noch Fisch unter der Soße, Portion eher groß …"
                    className="w-full px-3 py-2 rounded-xl bg-warm-50 border border-sage-200 text-sm text-gray-800 placeholder:text-gray-400 resize-y disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={runRefinement}
                    disabled={isRefining || kiContext.trim().length < 3}
                    className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isRefining ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Überarbeite …
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Mit Kontext neu auswerten
                      </>
                    )}
                  </button>
                </div>
              )}
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
