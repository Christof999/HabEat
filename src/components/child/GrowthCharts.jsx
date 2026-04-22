import { useMemo } from 'react';
import { ageMonthsAtDate, lengthPercentile, weightPercentile } from '../../lib/growthReferences';

const CHART_H = 120;
const PAD = 8;

function buildPath(points, minY, maxY, width) {
  if (points.length === 0) return '';
  const span = Math.max(maxY - minY, 1e-6);
  const n = points.length;
  const step = n === 1 ? width / 2 : width / (n - 1);
  return points
    .map((y, i) => {
      const x = PAD + i * step;
      const yn = PAD + (1 - (y - minY) / span) * (CHART_H - PAD * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${yn.toFixed(1)}`;
    })
    .join(' ');
}

export default function GrowthCharts({ measurements, birthDate, sex }) {
  const heightSeries = useMemo(
    () => measurements.filter((m) => m.height != null).map((m) => ({ ...m, v: m.height })),
    [measurements],
  );
  const weightSeries = useMemo(
    () => measurements.filter((m) => m.weight != null).map((m) => ({ ...m, v: m.weight })),
    [measurements],
  );

  const width = 280;

  const heightPath = useMemo(() => {
    if (heightSeries.length === 0) return null;
    const vals = heightSeries.map((m) => m.v);
    const minY = Math.min(...vals) - 2;
    const maxY = Math.max(...vals) + 2;
    return buildPath(vals, minY, maxY, width - PAD * 2);
  }, [heightSeries, width]);

  const weightPath = useMemo(() => {
    if (weightSeries.length === 0) return null;
    const vals = weightSeries.map((m) => m.v);
    const minY = Math.min(...vals) - 0.5;
    const maxY = Math.max(...vals) + 0.5;
    return buildPath(vals, minY, maxY, width - PAD * 2);
  }, [weightSeries, width]);

  return (
    <div className="space-y-6">
      {heightSeries.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Größe (cm)</h3>
          <svg
            viewBox={`0 0 ${width} ${CHART_H}`}
            className="w-full max-w-md h-32 bg-white rounded-xl border border-sage-100"
            role="img"
            aria-label="Verlauf Körpergröße"
          >
            {heightPath && (
              <path
                d={heightPath}
                fill="none"
                stroke="rgb(120 140 100)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {heightSeries.map((m, i) => {
              const step = heightSeries.length === 1 ? (width - PAD * 2) / 2 : (width - PAD * 2) / (heightSeries.length - 1);
              const x = PAD + i * step;
              const vals = heightSeries.map((r) => r.v);
              const minY = Math.min(...vals) - 2;
              const maxY = Math.max(...vals) + 2;
              const span = Math.max(maxY - minY, 1e-6);
              const y = PAD + (1 - (m.v - minY) / span) * (CHART_H - PAD * 2);
              return <circle key={m.id} cx={x} cy={y} r="4" className="fill-sage-500" />;
            })}
          </svg>
        </div>
      )}

      {weightSeries.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Gewicht (kg)</h3>
          <svg
            viewBox={`0 0 ${width} ${CHART_H}`}
            className="w-full max-w-md h-32 bg-white rounded-xl border border-sage-100"
            role="img"
            aria-label="Verlauf Gewicht"
          >
            {weightPath && (
              <path
                d={weightPath}
                fill="none"
                stroke="rgb(180 120 120)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {weightSeries.map((m, i) => {
              const step = weightSeries.length === 1 ? (width - PAD * 2) / 2 : (width - PAD * 2) / (weightSeries.length - 1);
              const x = PAD + i * step;
              const vals = weightSeries.map((r) => r.v);
              const minY = Math.min(...vals) - 0.5;
              const maxY = Math.max(...vals) + 0.5;
              const span = Math.max(maxY - minY, 1e-6);
              const y = PAD + (1 - (m.v - minY) / span) * (CHART_H - PAD * 2);
              return <circle key={m.id} cx={x} cy={y} r="4" className="fill-rose-400" />;
            })}
          </svg>
        </div>
      )}

      {measurements.length > 0 && (
        <div className="rounded-xl border border-sage-100 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sage-50 text-left text-gray-600">
                <th className="px-3 py-2 font-medium">Datum</th>
                <th className="px-3 py-2 font-medium">Größe</th>
                <th className="px-3 py-2 font-medium text-right">P*</th>
                <th className="px-3 py-2 font-medium">Gewicht</th>
                <th className="px-3 py-2 font-medium text-right">P*</th>
              </tr>
            </thead>
            <tbody>
              {measurements.map((m) => {
                const ageM = ageMonthsAtDate(birthDate, m.date);
                const pH = m.height != null && ageM != null ? lengthPercentile(m.height, ageM, sex) : null;
                const pW = m.weight != null && ageM != null ? weightPercentile(m.weight, ageM, sex) : null;
                return (
                  <tr key={m.id} className="border-t border-gray-50">
                    <td className="px-3 py-2 text-gray-800">
                      {new Date(`${m.date}T12:00:00`).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-3 py-2">{m.height != null ? `${m.height} cm` : '–'}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{pH != null ? `${pH}` : '–'}</td>
                    <td className="px-3 py-2">{m.weight != null ? `${m.weight} kg` : '–'}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{pW != null ? `${pW}` : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[10px] text-gray-400 leading-snug border-t border-gray-50">
            * P = grobe Perzentil-Schätzung (Median WHO-ähnlich 0–24 Monate, linear interpoliert). Ab 24 Monaten
            entfällt die Kurve – Werte dienen nur der Orientierung, nicht der Diagnose. Bei Zweifeln Kinderarzt
            konsultieren.
          </p>
        </div>
      )}
    </div>
  );
}
