const DATA_SOURCES = {
  infantWeight: 'https://www.cdc.gov/growthcharts/data/zscore/wtageinf.csv',
  infantLength: 'https://www.cdc.gov/growthcharts/data/zscore/lenageinf.csv',
  childWeight: 'https://www.cdc.gov/growthcharts/data/zscore/wtage.csv',
  childStature: 'https://www.cdc.gov/growthcharts/data/zscore/statage.csv',
};

let growthTablesPromise = null;
let growthTables = null;

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function normalizeSex(sex) {
  if (!sex) return null;
  const normalized = sex.toString().toLowerCase().trim();
  if (['male', 'm', 'junge', 'boy', '1'].includes(normalized)) return '1';
  if (['female', 'f', 'maedchen', 'madchen', 'girl', '2'].includes(normalized)) return '2';
  return null;
}

export function calculateAgeMonths(birthDate, atTimestamp = new Date()) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const at = new Date(atTimestamp);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(at.getTime())) return null;
  const diffMs = at.getTime() - birth.getTime();
  if (diffMs < 0) return null;
  // Average calendar month length.
  return diffMs / (1000 * 60 * 60 * 24 * 30.4375);
}

function parseCsvTable(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { percentiles: [], bySex: { 1: [], 2: [] } };

  const headers = lines[0].split(',').map(h => h.trim());
  const sexIndex = headers.indexOf('Sex');
  const ageIndex = headers.indexOf('Agemos');

  const percentileColumns = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => /^P\d+(\.\d+)?$/i.test(header))
    .map(({ header, index }) => ({ p: Number(header.slice(1)), index }))
    .sort((a, b) => a.p - b.p);

  const percentiles = percentileColumns.map(col => col.p);
  const bySex = { 1: [], 2: [] };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = line.split(',');
    const sex = cells[sexIndex]?.trim();
    const age = toNumber(cells[ageIndex]);
    if (!['1', '2'].includes(sex) || age == null) continue;

    const values = percentileColumns.map(({ index }) => toNumber(cells[index]));
    if (values.some(v => v == null)) continue;

    bySex[sex].push({ age, values });
  }

  bySex['1'].sort((a, b) => a.age - b.age);
  bySex['2'].sort((a, b) => a.age - b.age);

  return { percentiles, bySex };
}

async function loadGrowthTables() {
  if (growthTables) return growthTables;
  if (growthTablesPromise) return growthTablesPromise;

  growthTablesPromise = Promise.all(
    Object.entries(DATA_SOURCES).map(async ([key, url]) => {
      const response = await fetch(url, { headers: { Accept: 'text/csv' } });
      if (!response.ok) {
        throw new Error(`Growth data request failed (${key}): ${response.status}`);
      }
      const csvText = await response.text();
      return [key, parseCsvTable(csvText)];
    })
  )
    .then(entries => {
      growthTables = Object.fromEntries(entries);
      return growthTables;
    })
    .catch((err) => {
      growthTablesPromise = null;
      throw err;
    });

  return growthTablesPromise;
}

function interpolateByAge(rows, ageMonths) {
  if (!rows || rows.length === 0 || ageMonths == null) return null;
  if (ageMonths <= rows[0].age) return rows[0].values;
  if (ageMonths >= rows[rows.length - 1].age) return rows[rows.length - 1].values;

  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (ageMonths < a.age || ageMonths > b.age) continue;

    const span = b.age - a.age || 1;
    const t = (ageMonths - a.age) / span;
    return a.values.map((valueA, idx) => valueA + (b.values[idx] - valueA) * t);
  }

  return rows[rows.length - 1].values;
}

function estimatePercentile(measurement, valuesByPercentile, percentileSteps) {
  const value = toNumber(measurement);
  if (value == null || !valuesByPercentile || valuesByPercentile.length < 2) return null;

  const points = percentileSteps.map((p, idx) => ({ p, v: valuesByPercentile[idx] }));

  if (value <= points[0].v) {
    const first = points[0];
    const second = points[1];
    const slope = (second.p - first.p) / Math.max(0.0001, second.v - first.v);
    return Math.max(1, roundOne(first.p - (first.v - value) * slope));
  }

  for (let i = 0; i < points.length - 1; i++) {
    const low = points[i];
    const high = points[i + 1];
    if (value < low.v || value > high.v) continue;
    const span = high.v - low.v || 1;
    const t = (value - low.v) / span;
    return roundOne(low.p + (high.p - low.p) * t);
  }

  const last = points[points.length - 1];
  const beforeLast = points[points.length - 2];
  const slope = (last.p - beforeLast.p) / Math.max(0.0001, last.v - beforeLast.v);
  return Math.min(99, roundOne(last.p + (value - last.v) * slope));
}

function tableKeyForMetric(metric, ageMonths) {
  if (metric === 'weight') return ageMonths <= 36 ? 'infantWeight' : 'childWeight';
  if (metric === 'height') return ageMonths <= 36 ? 'infantLength' : 'childStature';
  return null;
}

async function getMetricPercentile({ metric, sexCode, ageMonths, value }) {
  if (value == null) return null;
  const tables = await loadGrowthTables();
  const key = tableKeyForMetric(metric, ageMonths);
  if (!key || !tables[key]) return null;

  const table = tables[key];
  const rows = table.bySex[sexCode];
  if (!rows || rows.length === 0) return null;

  const interpolated = interpolateByAge(rows, ageMonths);
  if (!interpolated) return null;

  return estimatePercentile(value, interpolated, table.percentiles);
}

export async function calculateGrowthPercentiles({
  birthDate,
  sex,
  timestamp = new Date(),
  weightKg = null,
  heightCm = null,
}) {
  const ageMonths = calculateAgeMonths(birthDate, timestamp);
  const sexCode = normalizeSex(sex);

  if (ageMonths == null || !sexCode) {
    return {
      ageMonths,
      reference: 'CDC',
      weightPercentile: null,
      heightPercentile: null,
    };
  }

  const [weightPercentile, heightPercentile] = await Promise.all([
    getMetricPercentile({ metric: 'weight', sexCode, ageMonths, value: weightKg }),
    getMetricPercentile({ metric: 'height', sexCode, ageMonths, value: heightCm }),
  ]);

  return {
    ageMonths: roundOne(ageMonths),
    reference: 'CDC',
    weightPercentile,
    heightPercentile,
  };
}
