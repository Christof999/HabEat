import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, ShieldCheck, AlertTriangle, TrendingUp, Sparkles,
  Loader2, ChevronRight, Info, Plus, Clock, X, Brain,
  ThermometerSun, Moon, Frown, Wind, HelpCircle,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { analyzeCorrelations, analyzeWithAI } from '../lib/detectiveEngine';
import SymptomLogger from '../components/detective/SymptomLogger';

const SYMPTOM_ICONS = {
  skin: ThermometerSun,
  digestion: AlertTriangle,
  sleep: Moon,
  mood: Frown,
  breathing: Wind,
  other: HelpCircle,
};

const SYMPTOM_LABELS = {
  skin: 'Haut',
  digestion: 'Verdauung',
  sleep: 'Schlaf',
  mood: 'Stimmung',
  breathing: 'Atmung',
  other: 'Sonstiges',
};

export default function DetectivePage() {
  const { state, activeChild } = useApp();
  const [showSymptomLogger, setShowSymptomLogger] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [showAiDetail, setShowAiDetail] = useState(false);

  const childMeals = state.meals.filter(m => m.childId === state.activeChildId);
  const childSymptoms = state.symptoms.filter(s => s.childId === state.activeChildId);

  const correlation = useMemo(
    () => analyzeCorrelations(childMeals, childSymptoms),
    [childMeals, childSymptoms]
  );

  const recentSymptoms = childSymptoms
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5);

  const runAiAnalysis = useCallback(async () => {
    if (!activeChild || childMeals.length === 0 || childSymptoms.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await analyzeWithAI(childMeals, childSymptoms, activeChild.name, {
        adultNutrition: state.adultNutrition,
      });
      setAiAnalysis(result);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  }, [activeChild, childMeals, childSymptoms, state.adultNutrition]);

  const getConfidenceColor = (confidence) => {
    if (confidence >= 70) return 'bg-rose-500';
    if (confidence >= 40) return 'bg-warm-500';
    return 'bg-sage-500';
  };

  const getConfidenceBarBg = (confidence) => {
    if (confidence >= 70) return 'bg-rose-100';
    if (confidence >= 40) return 'bg-warm-100';
    return 'bg-sage-100';
  };

  const formatTimeDiff = (ms) => {
    const hours = Math.round(ms / (60 * 60 * 1000));
    if (hours < 1) return '< 1 Stunde';
    return `~${hours}h`;
  };

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center">
            <Search className="w-5 h-5 text-sage-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Detektiv-Modus</h1>
            <p className="text-gray-400 text-sm">
              {activeChild ? `Analyse für ${activeChild.name}` : 'Korrelations-Analyse'}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 space-y-4 pb-28">
        {/* Status Card */}
        <div className={`rounded-2xl p-5 shadow-sm ${
          correlation.hasData && correlation.suspects.length > 0
            ? 'bg-warm-50 border border-warm-200'
            : 'bg-sage-50 border border-sage-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              correlation.hasData && correlation.suspects.length > 0
                ? 'bg-warm-100'
                : 'bg-sage-100'
            }`}>
              {correlation.hasData && correlation.suspects.length > 0 ? (
                <AlertTriangle className="w-6 h-6 text-warm-600" />
              ) : (
                <ShieldCheck className="w-6 h-6 text-sage-600" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-gray-800">
                {correlation.hasData && correlation.suspects.length > 0
                  ? `${correlation.suspects.length} Verdächtige gefunden`
                  : 'Dein HabEat-Detektiv ist wachsam'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {!correlation.hasData
                  ? 'Erfasse Mahlzeiten und Symptome, damit die Analyse starten kann.'
                  : correlation.suspects.length === 0
                    ? 'Bisher keine auffälligen Muster erkannt. Weiter beobachten!'
                    : 'Einige Lebensmittel zeigen auffällige Muster.'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowSymptomLogger(true)}
            className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md transition text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Symptom</p>
              <p className="text-[11px] text-gray-400">erfassen</p>
            </div>
          </button>

          <button
            onClick={runAiAnalysis}
            disabled={aiLoading || childMeals.length === 0 || childSymptoms.length === 0}
            className={`bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md transition text-left ${
              childMeals.length === 0 || childSymptoms.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-sage-50 flex items-center justify-center shrink-0">
              {aiLoading ? (
                <Loader2 className="w-5 h-5 text-sage-600 animate-spin" />
              ) : (
                <Brain className="w-5 h-5 text-sage-600" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">KI-Analyse</p>
              <p className="text-[11px] text-gray-400">starten</p>
            </div>
          </button>
        </div>

        {/* AI Analysis Results */}
        {aiError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
            <p className="text-sm text-rose-700">{aiError}</p>
          </div>
        )}

        {aiAnalysis && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => setShowAiDetail(!showAiDetail)}
              className="w-full px-5 py-4 flex items-center gap-3 cursor-pointer text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-sage-50 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-sage-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">KI-Erkenntnis</p>
                <p className="text-xs text-gray-500 truncate">{aiAnalysis.summary}</p>
              </div>
              <ChevronRight className={`w-4 h-4 text-gray-300 transition ${showAiDetail ? 'rotate-90' : ''}`} />
            </button>

            {showAiDetail && (
              <div className="px-5 pb-5 space-y-4 border-t border-gray-50 pt-4">
                <p className="text-sm text-gray-600">{aiAnalysis.summary}</p>

                {aiAnalysis.suspectedIngredients?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Verdächtige Zutaten</h4>
                    <div className="space-y-2">
                      {aiAnalysis.suspectedIngredients.map((item, i) => (
                        <div key={i} className="bg-warm-50 rounded-xl p-3">
                          <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{item.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiAnalysis.hiddenAllergens?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Versteckte Allergene</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {aiAnalysis.hiddenAllergens.map((a, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-600">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {aiAnalysis.recommendation && (
                  <div className="bg-sky-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-sky-700 mb-1">Empfehlung</p>
                    <p className="text-sm text-sky-800">{aiAnalysis.recommendation}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Top Suspects */}
        {correlation.suspects.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-1">
              Top-Verdächtige
            </h2>
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
              {correlation.suspects.map((suspect, i) => {
                const SymptomIcon = SYMPTOM_ICONS[suspect.primarySymptom] || AlertTriangle;
                return (
                  <div key={i} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-bold text-gray-800">{suspect.name}</span>
                        {suspect.primarySymptom && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 text-[11px] text-gray-500">
                            <SymptomIcon className="w-3 h-3" />
                            {SYMPTOM_LABELS[suspect.primarySymptom]}
                          </span>
                        )}
                      </div>
                      <span className={`text-sm font-bold ${
                        suspect.confidence >= 70 ? 'text-rose-600' : suspect.confidence >= 40 ? 'text-warm-600' : 'text-sage-600'
                      }`}>
                        {suspect.confidence}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className={`w-full h-2 rounded-full ${getConfidenceBarBg(suspect.confidence)}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getConfidenceColor(suspect.confidence)}`}
                        style={{ width: `${suspect.confidence}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                      <span>{suspect.symptomAppearances} von {suspect.totalAppearances} Mahlzeiten</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeDiff(suspect.avgTimeDiff)} Verzögerung
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Insights */}
        {correlation.insights.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-1">
              Erkenntnisse
            </h2>
            <div className="space-y-3">
              {correlation.insights.map((insight, i) => (
                <div
                  key={i}
                  className={`rounded-2xl p-4 ${
                    insight.type === 'alert'
                      ? 'bg-rose-50 border border-rose-200'
                      : insight.type === 'warning'
                        ? 'bg-warm-50 border border-warm-200'
                        : 'bg-sky-50 border border-sky-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      insight.type === 'alert'
                        ? 'bg-rose-100'
                        : insight.type === 'warning'
                          ? 'bg-warm-100'
                          : 'bg-sky-100'
                    }`}>
                      {insight.type === 'alert' ? (
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                      ) : insight.type === 'warning' ? (
                        <TrendingUp className="w-4 h-4 text-warm-600" />
                      ) : (
                        <Info className="w-4 h-4 text-sky-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{insight.title}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{insight.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Symptoms */}
        {recentSymptoms.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-1">
              Letzte Symptome
            </h2>
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
              {recentSymptoms.map(symptom => {
                const SymptomIcon = SYMPTOM_ICONS[symptom.type] || AlertTriangle;
                return (
                  <div key={symptom.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                      <SymptomIcon className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{SYMPTOM_LABELS[symptom.type]}</p>
                      <p className="text-[11px] text-gray-400">
                        Schweregrad {symptom.severity}/5 ·{' '}
                        {new Date(symptom.timestamp).toLocaleString('de-DE', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-4 rounded-full ${
                            i < symptom.severity ? 'bg-warm-400' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Data Summary */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Datenbasis</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-sage-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-sage-700">{childMeals.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Mahlzeiten</p>
            </div>
            <div className="bg-warm-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-warm-700">{childSymptoms.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Symptome</p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-sky-800">Wichtiger Hinweis</p>
            <p className="text-xs text-sky-700 mt-0.5">
              Dies ist keine medizinische Diagnose. Die Analyse basiert auf statistischen
              Mustern und KI-Vermutungen. Bitte besprich alle Beobachtungen mit deinem
              Kinderarzt, bevor du Lebensmittel aus der Ernährung streichst.
            </p>
          </div>
        </div>
      </div>

      {/* Symptom Logger Modal */}
      {showSymptomLogger && (
        <SymptomLogger onClose={() => setShowSymptomLogger(false)} />
      )}
    </div>
  );
}
