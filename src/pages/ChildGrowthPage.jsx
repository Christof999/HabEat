import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import GrowthCharts from '../components/child/GrowthCharts';
import { normalizeGrowthMeasurements } from '../lib/childGrowth';

export default function ChildGrowthPage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { childId } = useParams();

  const child = state.children.find((c) => c.id === childId);

  const measurements = useMemo(
    () => (child ? normalizeGrowthMeasurements(child.growthMeasurements) : []),
    [child],
  );

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    height: '',
    weight: '',
  });
  const [error, setError] = useState('');

  if (!child) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center px-6">
        <p className="text-gray-500">Kind wurde nicht gefunden.</p>
      </div>
    );
  }

  const handleAddMeasurement = (e) => {
    e.preventDefault();
    setError('');
    const h = form.height === '' ? null : Number(form.height);
    const w = form.weight === '' ? null : Number(form.weight);
    if (!Number.isFinite(h) && !Number.isFinite(w)) {
      setError('Bitte mindestens Größe oder Gewicht eintragen.');
      return;
    }
    if (h != null && (!Number.isFinite(h) || h < 30 || h > 200)) {
      setError('Größe bitte zwischen 30 und 200 cm.');
      return;
    }
    if (w != null && (!Number.isFinite(w) || w < 1 || w > 80)) {
      setError('Gewicht bitte zwischen 1 und 80 kg.');
      return;
    }

    const next = [...measurements];
    const idx = next.findIndex((m) => m.date === form.date);
    if (idx >= 0) {
      next[idx] = {
        ...next[idx],
        height: Number.isFinite(h) ? h : next[idx].height,
        weight: Number.isFinite(w) ? w : next[idx].weight,
      };
    } else {
      next.push({
        id: crypto.randomUUID(),
        date: form.date,
        height: Number.isFinite(h) ? h : null,
        weight: Number.isFinite(w) ? w : null,
      });
    }
    next.sort((a, b) => a.date.localeCompare(b.date));

    dispatch({
      type: 'UPDATE_CHILD',
      payload: {
        id: child.id,
        growthMeasurements: next,
        height: Number.isFinite(h) ? h : child.height,
        weight: Number.isFinite(w) ? w : child.weight,
        updatedAt: new Date().toISOString(),
      },
    });
    setForm((prev) => ({ ...prev, height: '', weight: '' }));
  };

  const removeMeasurement = (id) => {
    if (!confirm('Diesen Messpunkt löschen?')) return;
    const next = measurements.filter((m) => m.id !== id);
    const last = next[next.length - 1];
    dispatch({
      type: 'UPDATE_CHILD',
      payload: {
        id: child.id,
        growthMeasurements: next,
        height: last?.height ?? null,
        weight: last?.weight ?? null,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  return (
    <div className="min-h-screen bg-warm-50 pb-28">
      <div className="sticky top-0 bg-warm-50/90 backdrop-blur-sm z-10 px-6 py-4 flex items-center gap-3 border-b border-sage-100/50">
        <button
          type="button"
          onClick={() => navigate(`/settings/edit-child/${childId}`)}
          className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-lg text-gray-800">Wachstum</h1>
          <p className="text-sm text-gray-500 truncate">{child.name}</p>
        </div>
      </div>

      <div className="px-6 py-6 space-y-8">
        <GrowthCharts
          measurements={measurements}
          birthDate={child.birthDate}
          sex={child.sex}
        />

        <div className="bg-white rounded-2xl shadow-sm border border-sage-100 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Plus className="w-4 h-4 text-sage-600" />
            Messung hinzufügen
          </h2>
          <form onSubmit={handleAddMeasurement} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Datum</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-sage-200 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Größe (cm)</label>
                <input
                  type="number"
                  value={form.height}
                  onChange={(e) => setForm((p) => ({ ...p, height: e.target.value }))}
                  placeholder="optional"
                  className="w-full px-3 py-2 rounded-xl border border-sage-200 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Gewicht (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.weight}
                  onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))}
                  placeholder="optional"
                  className="w-full px-3 py-2 rounded-xl border border-sage-200 text-sm"
                />
              </div>
            </div>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-sage-500 text-white text-sm font-semibold cursor-pointer hover:bg-sage-600 transition"
            >
              Speichern
            </button>
          </form>
        </div>

        {measurements.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Messungen verwalten</h2>
            <ul className="space-y-2">
              {[...measurements].reverse().map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-3 py-2 text-sm"
                >
                  <span className="text-gray-700">
                    {new Date(`${m.date}T12:00:00`).toLocaleDateString('de-DE')}
                    <span className="text-gray-400 ml-2">
                      {m.height != null ? `${m.height} cm` : '–'}
                      {' · '}
                      {m.weight != null ? `${m.weight} kg` : '–'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMeasurement(m.id)}
                    className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                    aria-label="Messung löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
