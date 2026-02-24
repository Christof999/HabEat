import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Ruler, Weight, TrendingUp, TrendingDown,
  AlertTriangle, Plus, Trash2, Calendar, Baby, Activity,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { calculateGrowthPercentiles } from '../lib/growthPercentiles';

function calculateAge(birthDate) {
  const birth = new Date(birthDate);
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years > 0) return `${years} J. ${remainingMonths} M.`;
  return `${remainingMonths} Monate`;
}

function calculateBMI(weight, heightCm) {
  if (!weight || !heightCm) return null;
  const heightM = heightCm / 100;
  return (weight / (heightM * heightM)).toFixed(1);
}

function formatPercentile(value) {
  if (value == null) return '—';
  return `P${Math.round(value)}`;
}

function getSexLabel(sex) {
  if (sex === 'male') return 'Junge';
  if (sex === 'female') return 'Mädchen';
  return null;
}

function getPercentileCategory(percentile) {
  if (percentile == null) return null;
  if (percentile < 3) {
    return {
      shortLabel: 'deutlich unterer Bereich',
      detailLabel: 'deutlich unter dem alters- und geschlechtsbezogenen Vergleichsbereich',
      textClass: 'text-rose-700',
      dotClass: 'bg-rose-400',
    };
  }
  if (percentile < 10) {
    return {
      shortLabel: 'unterer Bereich',
      detailLabel: 'im unteren alters- und geschlechtsbezogenen Vergleichsbereich',
      textClass: 'text-warm-700',
      dotClass: 'bg-warm-400',
    };
  }
  if (percentile <= 90) {
    return {
      shortLabel: 'typischer Bereich',
      detailLabel: 'im typischen alters- und geschlechtsbezogenen Vergleichsbereich',
      textClass: 'text-sage-700',
      dotClass: 'bg-sage-500',
    };
  }
  if (percentile <= 97) {
    return {
      shortLabel: 'oberer Bereich',
      detailLabel: 'im oberen alters- und geschlechtsbezogenen Vergleichsbereich',
      textClass: 'text-warm-700',
      dotClass: 'bg-warm-400',
    };
  }
  return {
    shortLabel: 'deutlich oberer Bereich',
    detailLabel: 'deutlich ueber dem alters- und geschlechtsbezogenen Vergleichsbereich',
    textClass: 'text-rose-700',
    dotClass: 'bg-rose-400',
  };
}

function getWeightAlert(entries, childId) {
  const childEntries = entries
    .filter(e => e.childId === childId && e.weight)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (childEntries.length < 2) return null;

  const latest = childEntries[childEntries.length - 1];
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const earlier = [...childEntries]
    .reverse()
    .find(e => new Date(e.timestamp) < twoWeeksAgo);

  if (!earlier) return null;

  const percentChange = ((latest.weight - earlier.weight) / earlier.weight) * 100;

  if (percentChange <= -5) {
    return {
      type: 'danger',
      text: `${Math.abs(percentChange).toFixed(1)}% Gewichtsverlust seit ${new Date(earlier.timestamp).toLocaleDateString('de-DE')}`,
      detail: `${earlier.weight} kg \u2192 ${latest.weight} kg`,
    };
  }
  if (percentChange <= -3) {
    return {
      type: 'warning',
      text: `${Math.abs(percentChange).toFixed(1)}% Gewichtsverlust seit ${new Date(earlier.timestamp).toLocaleDateString('de-DE')}`,
      detail: `${earlier.weight} kg \u2192 ${latest.weight} kg`,
    };
  }
  return null;
}

// Simple SVG growth chart
function GrowthChart({ entries, dataKey, label, unit, color }) {
  const data = entries
    .filter(e => e[dataKey])
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (data.length < 2) {
    return (
      <div className="bg-gray-50 rounded-xl p-6 text-center">
        <Activity className="w-6 h-6 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Mindestens 2 Messungen fuer {label}-Kurve noetig</p>
      </div>
    );
  }

  const values = data.map(d => d[dataKey]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const padding = range * 0.15;

  const chartW = 280;
  const chartH = 120;
  const padL = 35;
  const padR = 10;
  const padT = 10;
  const padB = 25;
  const drawW = chartW - padL - padR;
  const drawH = chartH - padT - padB;

  const points = data.map((d, i) => {
    const x = padL + (i / (data.length - 1)) * drawW;
    const y = padT + drawH - ((d[dataKey] - (minVal - padding)) / (range + 2 * padding)) * drawH;
    return { x, y, value: d[dataKey], date: d.timestamp };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const ySteps = 4;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const val = (minVal - padding) + ((range + 2 * padding) / ySteps) * i;
    return val.toFixed(1);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}-Verlauf</p>
        <p className="text-xs text-gray-400">{data.length} Messungen</p>
      </div>
      <div className="bg-white rounded-xl p-3 overflow-x-auto">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ minWidth: 250 }}>
          {yLabels.map((val, i) => {
            const y = padT + drawH - (i / ySteps) * drawH;
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#f3f4f6" strokeWidth="0.5" />
                <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="6" fill="#9ca3af">{val}</text>
              </g>
            );
          })}
          <path
            d={`${pathD} L ${points[points.length - 1].x} ${padT + drawH} L ${points[0].x} ${padT + drawH} Z`}
            fill={color}
            opacity="0.1"
          />
          <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="3.5" fill="white" stroke={color} strokeWidth="1.5" />
              <text x={p.x} y={p.y - 6} textAnchor="middle" fontSize="6" fill={color} fontWeight="600">
                {p.value}
              </text>
            </g>
          ))}
          {points.filter((_, i) => i === 0 || i === points.length - 1 || points.length <= 5).map((p, i) => (
            <text key={i} x={p.x} y={chartH - 5} textAnchor="middle" fontSize="5.5" fill="#9ca3af">
              {new Date(p.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
            </text>
          ))}
          <text x={2} y={padT + 4} fontSize="6" fill="#9ca3af">{unit}</text>
        </svg>
      </div>
    </div>
  );
}

function AddGrowthModal({ child, onSave, onClose }) {
  const [height, setHeight] = useState(child.height || '');
  const [weight, setWeight] = useState(child.weight || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [percentilePreview, setPercentilePreview] = useState({
    weight: null,
    height: null,
  });

  const hasPercentileContext = !!child.birthDate && !!child.sex;
  const previewHeightCategory = getPercentileCategory(percentilePreview.height);
  const previewWeightCategory = getPercentileCategory(percentilePreview.weight);

  useEffect(() => {
    let active = true;
    const h = height ? parseFloat(height) : null;
    const w = weight ? parseFloat(weight) : null;

    if (!hasPercentileContext || (!h && !w)) {
      return () => { active = false; };
    }

    calculateGrowthPercentiles({
      birthDate: child.birthDate,
      sex: child.sex,
      timestamp: new Date(`${date}T12:00:00`),
      heightCm: h,
      weightKg: w,
    })
      .then((result) => {
        if (!active) return;
        setPercentilePreview({
          weight: result.weightPercentile,
          height: result.heightPercentile,
        });
      })
      .catch(() => {
        if (!active) return;
        setPercentilePreview({ weight: null, height: null });
      });

    return () => {
      active = false;
    };
  }, [child.birthDate, child.sex, date, hasPercentileContext, height, weight]);

  const handleSave = () => {
    const h = height ? parseFloat(height) : null;
    const w = weight ? parseFloat(weight) : null;
    if (!h && !w) return;
    onSave({
      id: crypto.randomUUID(),
      childId: child.id,
      height: h,
      weight: w,
      timestamp: new Date(date + 'T12:00:00').toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-6">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 space-y-4 safe-bottom">
        <h3 className="font-bold text-lg text-gray-800">Neue Messung</h3>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4" /> Datum
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-sm text-gray-800 appearance-none"
            style={{ minHeight: '48px' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Ruler className="w-4 h-4" /> Groesse (cm)
            </label>
            <input
              type="number"
              value={height}
              onChange={e => setHeight(e.target.value)}
              placeholder="z.B. 85"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-sm text-gray-800 placeholder:text-gray-400"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Weight className="w-4 h-4" /> Gewicht (kg)
            </label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="z.B. 12.5"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-sm text-gray-800 placeholder:text-gray-400"
            />
          </div>
        </div>

        {!hasPercentileContext && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
            <p className="text-xs text-sky-700">
              Für Perzentilen bitte im Profil Geburtsdatum und Geschlecht angeben.
            </p>
          </div>
        )}

        {hasPercentileContext && (height || weight) && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-sky-800 mb-1">Perzentilen-Vorschau</p>
            <div className="space-y-1 text-xs text-sky-700">
              {height && (
                <p>
                  Groesse: {formatPercentile(percentilePreview.height)}
                  {previewHeightCategory && (
                    <span className={`ml-1 ${previewHeightCategory.textClass}`}>
                      ({previewHeightCategory.shortLabel})
                    </span>
                  )}
                </p>
              )}
              {weight && (
                <p>
                  Gewicht: {formatPercentile(percentilePreview.weight)}
                  {previewWeightCategory && (
                    <span className={`ml-1 ${previewWeightCategory.textClass}`}>
                      ({previewWeightCategory.shortLabel})
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 cursor-pointer"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={!height && !weight}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-sage-500 text-white cursor-pointer disabled:opacity-40"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyChildPage() {
  const { state, dispatch, activeChild } = useApp();
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPercentiles, setCurrentPercentiles] = useState({
    weight: null,
    height: null,
  });

  // All hooks MUST be before any conditional return
  const childId = activeChild?.id;

  const childEntries = useMemo(
    () => (state.growthEntries || [])
      .filter(e => e.childId === childId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [state.growthEntries, childId]
  );

  const weightAlert = useMemo(
    () => childId ? getWeightAlert(state.growthEntries || [], childId) : null,
    [state.growthEntries, childId]
  );

  // Navigate away if no active child (in useEffect, not during render)
  useEffect(() => {
    if (!activeChild) {
      navigate('/');
    }
  }, [activeChild, navigate]);

  useEffect(() => {
    let active = true;
    if (!activeChild) return () => { active = false; };

    const hasContext = !!activeChild.birthDate && !!activeChild.sex;
    const hasMeasurement = !!activeChild.height || !!activeChild.weight;
    if (!hasContext || !hasMeasurement) {
      return () => { active = false; };
    }

    calculateGrowthPercentiles({
      birthDate: activeChild.birthDate,
      sex: activeChild.sex,
      timestamp: new Date(),
      heightCm: activeChild.height,
      weightKg: activeChild.weight,
    })
      .then((result) => {
        if (!active) return;
        setCurrentPercentiles({
          weight: result.weightPercentile,
          height: result.heightPercentile,
        });
      })
      .catch(() => {
        if (!active) return;
        setCurrentPercentiles({ weight: null, height: null });
      });

    return () => {
      active = false;
    };
  }, [activeChild]);

  if (!activeChild) {
    return null;
  }

  const child = activeChild;
  const childHasPercentileContext = !!child.birthDate && !!child.sex;
  const bmi = calculateBMI(child.weight, child.height);
  const age = calculateAge(child.birthDate);
  const heightPercentileCategory = getPercentileCategory(currentPercentiles.height);
  const weightPercentileCategory = getPercentileCategory(currentPercentiles.weight);
  const hasAnyPercentile = currentPercentiles.height != null || currentPercentiles.weight != null;

  const latestWithWeight = childEntries.find(e => e.weight);
  const previousWithWeight = childEntries.filter(e => e.weight)[1];
  const weightTrend = latestWithWeight && previousWithWeight
    ? latestWithWeight.weight - previousWithWeight.weight
    : null;

  const latestWithHeight = childEntries.find(e => e.height);
  const previousWithHeight = childEntries.filter(e => e.height)[1];
  const heightTrend = latestWithHeight && previousWithHeight
    ? latestWithHeight.height - previousWithHeight.height
    : null;

  const handleAddEntry = (entry) => {
    dispatch({ type: 'ADD_GROWTH_ENTRY', payload: entry });
    // Update child's current height/weight — pass full child object so
    // Firestore always receives a complete document (prevents data loss
    // if the original ADD_CHILD write failed due to network errors).
    dispatch({
      type: 'UPDATE_CHILD',
      payload: {
        ...child,
        ...(entry.height && { height: entry.height }),
        ...(entry.weight && { weight: entry.weight }),
      },
    });
  };

  const handleDeleteEntry = (entryId) => {
    dispatch({ type: 'REMOVE_GROWTH_ENTRY', payload: entryId });
  };

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Mein Kind</h1>
            <p className="text-gray-400 text-sm mt-0.5">Wachstum & Entwicklung</p>
          </div>
        </div>
      </div>

      <div className="px-6 space-y-5 pb-28">
        {/* Child Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full ${child.avatarColor} flex items-center justify-center shrink-0 overflow-hidden`}>
              {child.photoUrl ? (
                <img src={child.photoUrl} alt={child.name || ''} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-gray-700">{(child.name || '?').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-800">{child.name || 'Unbenannt'}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Baby className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-sm text-gray-500">{age}</span>
                {getSexLabel(child.sex) && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 text-[10px] font-medium">
                    {getSexLabel(child.sex)}
                  </span>
                )}
              </div>
              {child.knownAllergies?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {child.knownAllergies.map(a => (
                    <span key={a} className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-medium">
                      {a}
                    </span>
                  ))}
                </div>
              )}
              {child.knownConditions?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {child.knownConditions.map(c => (
                    <span key={c} className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 text-[10px] font-medium">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Weight Loss Alert */}
        {weightAlert && (
          <div className={`rounded-2xl p-4 flex items-start gap-3 ${
            weightAlert.type === 'danger' ? 'bg-rose-50 border border-rose-200' : 'bg-warm-50 border border-warm-200'
          }`}>
            <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${
              weightAlert.type === 'danger' ? 'text-rose-500' : 'text-warm-500'
            }`} />
            <div>
              <p className={`text-sm font-semibold ${
                weightAlert.type === 'danger' ? 'text-rose-700' : 'text-warm-700'
              }`}>
                {weightAlert.text}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{weightAlert.detail}</p>
              <p className="text-xs text-gray-400 mt-1">
                Bitte sprich mit eurem Kinderarzt, wenn der Gewichtsverlust anhaelt.
              </p>
            </div>
          </div>
        )}

        {!child.sex && (
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3">
            <p className="text-xs text-sky-700">
              Für medizinische Perzentilen bitte im Profil das Geschlecht hinterlegen.
            </p>
          </div>
        )}

        {/* Current Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <Ruler className="w-5 h-5 text-sage-500 mx-auto mb-1.5" />
            <p className="text-lg font-bold text-gray-800">{child.height || '\u2014'}</p>
            <p className="text-[11px] text-gray-400">cm</p>
            {childHasPercentileContext && currentPercentiles.height != null && (
              <p className={`text-[10px] mt-1 font-medium ${heightPercentileCategory?.textClass || 'text-sky-600'}`}>
                {formatPercentile(currentPercentiles.height)} {heightPercentileCategory ? `(${heightPercentileCategory.shortLabel})` : ''}
              </p>
            )}
            {heightTrend !== null && (
              <div className={`flex items-center justify-center gap-0.5 mt-1 ${heightTrend >= 0 ? 'text-sage-600' : 'text-rose-500'}`}>
                {heightTrend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span className="text-[10px] font-medium">{heightTrend > 0 ? '+' : ''}{heightTrend.toFixed(1)}</span>
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <Weight className="w-5 h-5 text-sky-500 mx-auto mb-1.5" />
            <p className="text-lg font-bold text-gray-800">{child.weight || '\u2014'}</p>
            <p className="text-[11px] text-gray-400">kg</p>
            {childHasPercentileContext && currentPercentiles.weight != null && (
              <p className={`text-[10px] mt-1 font-medium ${weightPercentileCategory?.textClass || 'text-sky-600'}`}>
                {formatPercentile(currentPercentiles.weight)} {weightPercentileCategory ? `(${weightPercentileCategory.shortLabel})` : ''}
              </p>
            )}
            {weightTrend !== null && (
              <div className={`flex items-center justify-center gap-0.5 mt-1 ${weightTrend >= 0 ? 'text-sage-600' : 'text-rose-500'}`}>
                {weightTrend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span className="text-[10px] font-medium">{weightTrend > 0 ? '+' : ''}{weightTrend.toFixed(1)}</span>
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <Activity className="w-5 h-5 text-warm-500 mx-auto mb-1.5" />
            <p className="text-lg font-bold text-gray-800">{bmi || '\u2014'}</p>
            <p className="text-[11px] text-gray-400">BMI</p>
          </div>
        </div>

        {childHasPercentileContext && hasAnyPercentile && (
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-sky-800 uppercase tracking-wide mb-2">
              Einordnung der Perzentilen
            </p>
            <div className="space-y-1.5">
              {currentPercentiles.height != null && (
                <div className="flex items-start gap-2">
                  <span className={`w-2 h-2 rounded-full mt-1.5 ${heightPercentileCategory?.dotClass || 'bg-sky-400'}`} />
                  <p className="text-xs text-sky-900">
                    <span className="font-semibold">Groesse ({formatPercentile(currentPercentiles.height)}): </span>
                    {heightPercentileCategory?.detailLabel}
                  </p>
                </div>
              )}
              {currentPercentiles.weight != null && (
                <div className="flex items-start gap-2">
                  <span className={`w-2 h-2 rounded-full mt-1.5 ${weightPercentileCategory?.dotClass || 'bg-sky-400'}`} />
                  <p className="text-xs text-sky-900">
                    <span className="font-semibold">Gewicht ({formatPercentile(currentPercentiles.weight)}): </span>
                    {weightPercentileCategory?.detailLabel}
                  </p>
                </div>
              )}
            </div>
            <p className="text-[11px] text-sky-700 mt-2">
              Perzentilen sind eine Orientierung und keine Diagnose. Wichtiger als ein Einzelwert ist der Verlauf ueber
              mehrere Messungen. Bei Unsicherheit bitte mit eurem Kinderarzt sprechen.
            </p>
          </div>
        )}

        {/* Growth Charts */}
        <GrowthChart
          entries={childEntries}
          dataKey="weight"
          label="Gewicht"
          unit="kg"
          color="#0ea5e9"
        />
        <GrowthChart
          entries={childEntries}
          dataKey="height"
          label="Groesse"
          unit="cm"
          color="#2d5a3d"
        />

        {/* Measurement History */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Messverlauf</h3>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sage-50 text-sage-600 text-xs font-medium cursor-pointer hover:bg-sage-100 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Neue Messung
            </button>
          </div>

          {childEntries.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
              {childEntries.map((entry) => {
                const entryDate = new Date(entry.timestamp);
                return (
                  <div key={entry.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-10 text-center shrink-0">
                      <p className="text-sm font-bold text-gray-700">
                        {entryDate.toLocaleDateString('de-DE', { day: '2-digit' })}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase">
                        {entryDate.toLocaleDateString('de-DE', { month: 'short' })}
                      </p>
                    </div>
                    <div className="w-px h-8 bg-gray-200 shrink-0" />
                    <div className="flex-1 flex items-center gap-4">
                      {entry.height && (
                        <div className="flex items-center gap-1.5">
                          <Ruler className="w-3.5 h-3.5 text-sage-500" />
                          <span className="text-sm font-medium text-gray-700">{entry.height} cm</span>
                        </div>
                      )}
                      {entry.weight && (
                        <div className="flex items-center gap-1.5">
                          <Weight className="w-3.5 h-3.5 text-sky-500" />
                          <span className="text-sm font-medium text-gray-700">{entry.weight} kg</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
              <Activity className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Noch keine Messungen</p>
              <p className="text-xs text-gray-400 mt-1">
                Erfasse Groesse und Gewicht regelmaessig, um das Wachstum zu verfolgen.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Growth Modal */}
      {showAddModal && (
        <AddGrowthModal
          child={child}
          onSave={handleAddEntry}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
