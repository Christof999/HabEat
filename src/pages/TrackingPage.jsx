import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, Image, Sparkles, Loader2, StickyNote, Check,
  AlertCircle, Baby, Clock, Droplets, Search, Database, Pencil, X,
  ShieldCheck, ArrowRightLeft, Info,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { analyzeImageWithGemini } from '../lib/gemini';
import { searchProducts, validateNutritionByIngredients } from '../lib/openFoodFacts';
import { hasDiabetesType1, calculateCarbUnits } from '../lib/diabetes';

// Keywords in notes that map to allergens (German)
const ALLERGEN_KEYWORDS = {
  'nüsse': 'Nüsse', 'nuss': 'Nüsse', 'erdnuss': 'Erdnüsse', 'erdnüsse': 'Erdnüsse',
  'milch': 'Milch', 'laktose': 'Milch', 'käse': 'Milch', 'sahne': 'Milch', 'butter': 'Milch',
  'ei': 'Ei', 'eier': 'Ei',
  'gluten': 'Gluten', 'weizen': 'Gluten', 'dinkel': 'Gluten', 'roggen': 'Gluten',
  'soja': 'Soja',
  'fisch': 'Fisch',
  'schalentier': 'Schalentiere', 'garnele': 'Schalentiere', 'krebs': 'Schalentiere',
  'sellerie': 'Sellerie', 'senf': 'Senf', 'sesam': 'Sesam', 'lupine': 'Lupine',
};

function detectAllergensFromText(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = new Set();
  for (const [keyword, label] of Object.entries(ALLERGEN_KEYWORDS)) {
    if (lower.includes(keyword)) found.add(label);
  }
  return [...found];
}

function getAiIngredientNames(analysis) {
  if (!analysis) return [];
  if (analysis.ingredientNames?.length > 0) return analysis.ingredientNames;
  if (analysis.ingredients?.length > 0) {
    return analysis.ingredients
      .map(i => (typeof i === 'string' ? i : i?.name))
      .filter(Boolean);
  }
  return [];
}

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

  // Editable nutrition state (initialized from analysis/OFF)
  const [editCalories, setEditCalories] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editFat, setEditFat] = useState('');
  const [editSugar, setEditSugar] = useState('');
  const [editFiber, setEditFiber] = useState('');

  // Allergens (merged from Gemini + OFF + notes)
  const [allergens, setAllergens] = useState([]);

  // OFF search state
  const [offQuery, setOffQuery] = useState('');
  const [offResults, setOffResults] = useState([]);
  const [offSearching, setOffSearching] = useState(false);
  const [offProduct, setOffProduct] = useState(null);
  const [showOffSearch, setShowOffSearch] = useState(false);

  // Nutrition validation state (OFF cross-check)
  const [validationResult, setValidationResult] = useState(null); // { corrected, corrections[], matched, total }
  const [isValidating, setIsValidating] = useState(false);

  // Breastfeeding state
  const [bfDuration, setBfDuration] = useState('');
  const [bfSide, setBfSide] = useState(null);

  // Formula state
  const [formulaAmount, setFormulaAmount] = useState('');
  const [formulaBrand, setFormulaBrand] = useState('');

  const aiIngredientNames = getAiIngredientNames(analysis);
  const detailedOffIngredients = offProduct?.ingredientList || [];
  const hasDetailedOffIngredients = detailedOffIngredients.length >= 3;
  const isType1Diabetes = hasDiabetesType1(activeChild?.knownConditions || []);
  const carbUnits = calculateCarbUnits(parseFloat(editCarbs) || 0);

  // Re-analyze allergens when notes change
  useEffect(() => {
    const fromNotes = detectAllergensFromText(notes);
    const baseAllergens = [
      ...(analysis?.allergens || []),
      ...(offProduct?.allergens || []),
    ];
    const merged = [...new Set([...baseAllergens, ...fromNotes])];
    setAllergens(merged);
  }, [notes, analysis, offProduct]);

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
      ? ` Das Kind hat folgende Vorerkrankungen: ${activeChild.knownConditions.join(', ')}. Berücksichtige dies bei der Bewertung (z.B. bei Diabetes Typ 1 besonders Kohlenhydrate und Broteinheiten beachten).`
      : '';

    const prompt = `Du bist ein Ernährungsexperte für Kleinkinder. Analysiere dieses Foto einer Mahlzeit.
${childAllergies}${childConditions}

Erkenne:
1. Was ist auf dem Teller? Gib einen kurzen deutschen Titel.
2. Liste alle erkennbaren Zutaten auf.
3. Schätze die Nährwerte (für eine Kinderportion).
4. Prüfe auf häufige Allergene (Milch, Ei, Gluten, Nüsse, Soja, Fisch, Schalentiere).
5. Schätze auch Zucker und Ballaststoffe wenn möglich.

Antworte NUR mit diesem JSON-Format, ohne Markdown:
{
  "title": "Bezeichnung der Mahlzeit",
  "ingredients": [{"name": "Zutat1", "amount_g": 50}, {"name": "Zutat2", "amount_g": 30}],
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "sugar": 0,
  "fiber": 0,
  "summary": "Kurze Bewertung der Mahlzeit (1 Satz)",
  "allergens": ["nur wenn Allergene erkannt wurden"]
}
Wichtig: Bei "ingredients" gib für jede Zutat den Namen und die geschätzte Menge in Gramm (amount_g) für eine Kinderportion an.`;

    try {
      const response = await analyzeImageWithGemini(base64Image, prompt);
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      // Normalize ingredients: support both old string[] and new {name, amount_g}[] format
      const rawIngredients = parsed.ingredients || [];
      const ingredients = rawIngredients.map(ing =>
        typeof ing === 'string' ? { name: ing, amount_g: null } : { name: ing.name, amount_g: ing.amount_g || null }
      );

      const result = {
        title: parsed.title || 'Mahlzeit',
        ingredients,
        ingredientNames: ingredients.map(i => i.name),
        calories: parsed.calories || 0,
        protein: parsed.protein || 0,
        carbs: parsed.carbs || 0,
        fat: parsed.fat || 0,
        sugar: parsed.sugar || 0,
        fiber: parsed.fiber || 0,
        summary: parsed.summary || '',
        allergens: parsed.allergens || [],
      };

      setAnalysis(result);
      setTitle(result.title);
      setEditCalories(String(result.calories));
      setEditProtein(String(result.protein));
      setEditCarbs(String(result.carbs));
      setEditFat(String(result.fat));
      setEditSugar(String(result.sugar || ''));
      setEditFiber(String(result.fiber || ''));
      setAllergens(result.allergens);
      setIsAnalyzing(false);
      setStep('review');

      // Auto-search OFF with the recognized title
      if (result.title && result.title !== 'Mahlzeit') {
        runOffSearch(result.title);
      }

      // Auto-validate nutrition values by searching each ingredient in OFF
      if (ingredients.length > 0) {
        runNutritionValidation(result, ingredients);
      }
    } catch (err) {
      console.error('Gemini analysis failed:', err);
      setIsAnalyzing(false);
      setAnalyzeError(err.message);
      setStep('capture');
    }
  };

  // --- Open Food Facts search ---
  const runOffSearch = async (q) => {
    if (!q || q.length < 2) return;
    setOffSearching(true);
    try {
      const results = await searchProducts(q, 5);
      setOffResults(results);
    } catch (err) {
      console.error('OFF search failed:', err);
    } finally {
      setOffSearching(false);
    }
  };

  // --- Nutrition validation via OFF ingredient lookup ---
  const runNutritionValidation = async (geminiResult, ingredients) => {
    setIsValidating(true);
    try {
      const validation = await validateNutritionByIngredients(ingredients, {
        calories: geminiResult.calories,
        protein: geminiResult.protein,
        carbs: geminiResult.carbs,
        fat: geminiResult.fat,
        sugar: geminiResult.sugar,
        fiber: geminiResult.fiber,
      });
      setValidationResult(validation);

      // Auto-apply corrected values if OFF had enough data
      if (validation.corrected && validation.matched >= 2) {
        const c = validation.offNutrition;
        if (c.calories != null) setEditCalories(String(c.calories));
        if (c.protein != null) setEditProtein(String(c.protein));
        if (c.carbs != null) setEditCarbs(String(c.carbs));
        if (c.fat != null) setEditFat(String(c.fat));
        if (c.sugar != null) setEditSugar(String(c.sugar));
        if (c.fiber != null) setEditFiber(String(c.fiber));
      }
    } catch (err) {
      console.error('Nutrition validation failed:', err);
    } finally {
      setIsValidating(false);
    }
  };

  const handleOffSearchSubmit = (e) => {
    e.preventDefault();
    runOffSearch(offQuery);
    setShowOffSearch(true);
  };

  const applyOffProduct = (product) => {
    setOffProduct(product);
    setShowOffSearch(false);

    // Merge OFF nutrition data — prefer OFF values if available
    const n = product.nutrition;
    if (n.calories != null) setEditCalories(String(n.calories));
    if (n.protein != null) setEditProtein(String(n.protein));
    if (n.carbs != null) setEditCarbs(String(n.carbs));
    if (n.fat != null) setEditFat(String(n.fat));
    if (n.sugar != null) setEditSugar(String(n.sugar));
    if (n.fiber != null) setEditFiber(String(n.fiber));

    // Merge allergens
    const merged = [...new Set([...allergens, ...product.allergens])];
    setAllergens(merged);
  };

  // --- Save handlers ---
  const handleSave = () => {
    const finalIngredients = hasDetailedOffIngredients
      ? detailedOffIngredients
      : aiIngredientNames;
    const units = calculateCarbUnits(parseFloat(editCarbs) || 0);

    const meal = {
      id: crypto.randomUUID(),
      childId: state.activeChildId,
      timestamp: new Date().toISOString(),
      mealType: 'food',
      imageUrl: imagePreview,
      title: title || analysis?.title || 'Mahlzeit',
      summary: analysis?.summary || '',
      ingredients: finalIngredients,
      aiIngredients: aiIngredientNames,
      ingredientsSource: hasDetailedOffIngredients ? 'openfoodfacts' : 'gemini',
      offIngredientsText: offProduct?.ingredients || null,
      calories: parseFloat(editCalories) || 0,
      protein: parseFloat(editProtein) || 0,
      carbs: parseFloat(editCarbs) || 0,
      fat: parseFloat(editFat) || 0,
      sugar: parseFloat(editSugar) || null,
      fiber: parseFloat(editFiber) || null,
      carbsBE: units.be,
      carbsKE: units.ke,
      allergens,
      notes,
      dataSource: validationResult?.corrected ? 'gemini+off-validiert' : offProduct ? 'gemini+openfoodfacts' : 'gemini',
      nutritionValidated: !!validationResult,
      nutritionCorrected: validationResult?.corrected || false,
      offProductName: offProduct?.name || null,
      offBrand: offProduct?.brand || null,
      nutriscoreGrade: offProduct?.nutriscoreGrade || null,
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
                KI erkennt Zutaten und gleicht Nährwerte ab
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

          {/* Data Source Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sage-50 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-sage-600" />
              <span className="text-xs font-medium text-sage-700">KI-Analyse</span>
            </div>
            {offProduct && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-full">
                <Database className="w-3.5 h-3.5 text-orange-600" />
                <span className="text-xs font-medium text-orange-700">
                  Open Food Facts{offProduct.brand ? ` (${offProduct.brand})` : ''}
                </span>
              </div>
            )}
            {isValidating && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-full">
                <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                <span className="text-xs font-medium text-blue-600">Werte werden abgeglichen...</span>
              </div>
            )}
            {validationResult && !isValidating && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                validationResult.corrected ? 'bg-amber-50' : 'bg-green-50'
              }`}>
                {validationResult.corrected ? (
                  <>
                    <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-xs font-medium text-amber-700">
                      Werte korrigiert ({validationResult.matched}/{validationResult.total} Zutaten)
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-xs font-medium text-green-700">
                      Werte bestätigt ({validationResult.matched}/{validationResult.total} Zutaten)
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Validation details - show corrections */}
          {validationResult?.corrected && validationResult.corrections.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-amber-800">Nährwerte angepasst</h3>
              </div>
              <p className="text-xs text-amber-700 mb-2">
                Die KI-Schätzung wurde anhand von Open Food Facts Daten korrigiert:
              </p>
              <div className="space-y-1">
                {validationResult.corrections.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-amber-800 font-medium">{c.label}</span>
                    <span className="text-amber-600">
                      <span className="line-through opacity-60">{c.aiValue}</span>
                      {' → '}
                      <span className="font-semibold">{c.offValue}</span>
                      <span className="ml-1 opacity-50">({c.deviation}% Abw.)</span>
                    </span>
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

          {/* Open Food Facts Search */}
          <div>
            <button
              onClick={() => setShowOffSearch(!showOffSearch)}
              className="flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700 transition cursor-pointer"
            >
              <Database className="w-4 h-4" />
              {showOffSearch ? 'Produktsuche ausblenden' : 'Produkt in Open Food Facts suchen'}
            </button>

            {showOffSearch && (
              <div className="mt-3 space-y-3">
                <form onSubmit={handleOffSearchSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={offQuery}
                    onChange={e => setOffQuery(e.target.value)}
                    placeholder="z.B. Hipp Gemüsereis, Aptamil..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-300 transition text-sm text-gray-800 placeholder:text-gray-400"
                  />
                  <button
                    type="submit"
                    disabled={offSearching || !offQuery.trim()}
                    className="px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition cursor-pointer disabled:opacity-40"
                  >
                    {offSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </form>

                {/* Search Results */}
                {offResults.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {offResults.map((product, i) => (
                      <button
                        key={i}
                        onClick={() => applyOffProduct(product)}
                        className="w-full bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 hover:shadow-md transition cursor-pointer text-left"
                      >
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                            <Database className="w-5 h-5 text-orange-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{product.name || 'Unbekannt'}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {product.brand}{product.nutrition.calories != null ? ` · ${product.nutrition.calories} kcal/100g` : ''}
                          </p>
                        </div>
                        {product.nutriscoreGrade && (
                          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                            product.nutriscoreGrade === 'a' ? 'bg-green-100 text-green-700' :
                            product.nutriscoreGrade === 'b' ? 'bg-lime-100 text-lime-700' :
                            product.nutriscoreGrade === 'c' ? 'bg-yellow-100 text-yellow-700' :
                            product.nutriscoreGrade === 'd' ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {product.nutriscoreGrade}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {offSearching && (
                  <div className="flex items-center justify-center py-4 gap-2 text-orange-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Suche in Open Food Facts...</span>
                  </div>
                )}

                {!offSearching && offResults.length === 0 && offQuery.length >= 2 && (
                  <p className="text-xs text-gray-400 text-center py-2">Keine Ergebnisse gefunden</p>
                )}
              </div>
            )}
          </div>

          {/* Applied OFF product badge */}
          {offProduct && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl">
              <Database className="w-4 h-4 text-orange-500 shrink-0" />
              <span className="text-sm text-orange-700 flex-1 truncate">
                Nährwerte von: {offProduct.name}{offProduct.brand ? ` (${offProduct.brand})` : ''}
              </span>
              <button onClick={() => setOffProduct(null)} className="cursor-pointer shrink-0">
                <X className="w-4 h-4 text-orange-400 hover:text-orange-600" />
              </button>
            </div>
          )}

          {/* Editable Nutrients */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium text-gray-700">Nährwerte (pro Portion)</h3>
              <Pencil className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Kalorien', value: editCalories, set: setEditCalories, unit: 'kcal', bg: 'bg-warm-50', border: 'border-warm-200' },
                { label: 'Protein', value: editProtein, set: setEditProtein, unit: 'g', bg: 'bg-rose-50', border: 'border-rose-200' },
                { label: 'Kohlenhydrate', value: editCarbs, set: setEditCarbs, unit: 'g', bg: 'bg-warm-50', border: 'border-warm-200' },
                { label: 'Fett', value: editFat, set: setEditFat, unit: 'g', bg: 'bg-sky-50', border: 'border-sky-200' },
                { label: 'Zucker', value: editSugar, set: setEditSugar, unit: 'g', bg: 'bg-amber-50', border: 'border-amber-200' },
                { label: 'Ballaststoffe', value: editFiber, set: setEditFiber, unit: 'g', bg: 'bg-green-50', border: 'border-green-200' },
              ].map(n => (
                <div key={n.label} className={`${n.bg} rounded-xl p-3`}>
                  <span className="text-xs text-gray-500 block mb-1">{n.label}</span>
                  <div className="flex items-baseline gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={n.value}
                      onChange={e => n.set(e.target.value)}
                      className={`w-full bg-transparent text-lg font-bold text-gray-800 focus:outline-none border-b ${n.border} focus:border-sage-400 transition`}
                    />
                    <span className="text-sm font-normal text-gray-400 shrink-0">{n.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Type 1 diabetes helpers */}
          {isType1Diabetes && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-sky-800 mb-1">Diabetes Typ 1</h3>
              <p className="text-sm text-sky-700">
                {carbUnits.carbs} g Kohlenhydrate entsprechen ca. <strong>{carbUnits.be} BE</strong> ({carbUnits.ke} KE).
              </p>
              <p className="text-xs text-sky-600 mt-1">
                Hinweis: Schätzwert pro Portion. Bitte vor Insulingabe individuell prüfen.
              </p>
            </div>
          )}

          {/* Nutri-Score badge if available */}
          {offProduct?.nutriscoreGrade && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Nutri-Score:</span>
              <span className={`text-sm font-bold uppercase px-3 py-1 rounded-full ${
                offProduct.nutriscoreGrade === 'a' ? 'bg-green-100 text-green-700' :
                offProduct.nutriscoreGrade === 'b' ? 'bg-lime-100 text-lime-700' :
                offProduct.nutriscoreGrade === 'c' ? 'bg-yellow-100 text-yellow-700' :
                offProduct.nutriscoreGrade === 'd' ? 'bg-orange-100 text-orange-700' :
                'bg-red-100 text-red-700'
              }`}>
                {offProduct.nutriscoreGrade.toUpperCase()}
              </span>
            </div>
          )}

          {/* Ingredients */}
          {(analysis.ingredients.length > 0 || hasDetailedOffIngredients) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">Erkannte Zutaten</h3>
                {hasDetailedOffIngredients && (
                  <span className="text-xs text-orange-600 font-medium">detailliert aus Open Food Facts</span>
                )}
              </div>

              {hasDetailedOffIngredients ? (
                <div className="flex flex-wrap gap-1.5">
                  {detailedOffIngredients.map((ingredient, i) => (
                    <span
                      key={`${ingredient}-${i}`}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 ring-1 ring-orange-200"
                    >
                      {ingredient}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {analysis.ingredients.map((ing, i) => {
                    const name = typeof ing === 'string' ? ing : ing.name;
                    const weight = typeof ing === 'object' ? ing.amount_g : null;
                    const detail = validationResult?.details?.find(d => d.name === name);
                    return (
                      <span
                        key={i}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          detail?.matched
                            ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
                            : 'bg-sage-50 text-sage-700'
                        }`}
                        title={detail?.matched ? `OFF: ${detail.product}${detail.brand ? ` (${detail.brand})` : ''}` : 'Nicht in OFF gefunden'}
                      >
                        {name}{weight ? ` ~${weight}g` : ''}
                        {detail?.matched && <ShieldCheck className="w-3 h-3 inline ml-1 -mt-0.5" />}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Allergen Warning */}
          {allergens.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-semibold text-rose-700">Allergene erkannt</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allergens.map((allergen, i) => (
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
              placeholder="z.B. Hat gut geschmeckt, enthält Nüsse..."
              className="w-full px-4 py-3 rounded-xl bg-white border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800 placeholder:text-gray-400 resize-none"
            />
            {detectAllergensFromText(notes).length > 0 && (
              <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Allergene aus Notizen erkannt: {detectAllergensFromText(notes).join(', ')}
              </p>
            )}
          </div>

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
