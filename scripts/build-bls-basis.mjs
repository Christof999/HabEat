/**
 * BLS 4.0 → server/data/bls-basis.json
 * Voraussetzung: ZIP von https://blsdb.de/download entpacken,
 *   Pfad zur XLSX als Argument oder Umgebungsvariable BLS_XLSX.
 *
 *   BLS_XLSX=./BLS_4_0_2025_DE/BLS_4_0_Daten_2025_DE.xlsx node scripts/build-bls-basis.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const xlsxPath = process.argv[2] || process.env.BLS_XLSX;
if (!xlsxPath || !fs.existsSync(xlsxPath)) {
  console.error('Bitte Pfad zur BLS_4_0_Daten_*_DE.xlsx angeben, z. B.:');
  console.error('  BLS_XLSX=../pfad/BLS_4_0_Daten_2025_DE.xlsx node scripts/build-bls-basis.mjs');
  process.exit(1);
}

const ENERCC = 'ENERCC Energie (Kilokalorien) [kcal/100g]';
const PROT = 'PROT625 Protein (Nx6,25) [g/100g]';
const FAT = 'FAT Fett [g/100g]';
const CHO = 'CHO Kohlenhydrate, verfügbar [g/100g]';

function parseNum(v) {
  if (v === '' || v === '-' || v == null) return null;
  const s = String(v).replace(',', '.').trim();
  if (s.startsWith('<') || s.startsWith('>')) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function isBasisFood(row) {
  const code = String(row['BLS Code'] || '').trim();
  const name = String(row['Lebensmittelbezeichnung'] || '');
  if (/ roh$/i.test(name)) return true;
  if (/^C[123]/.test(code)) return true;
  if (!code.startsWith('M')) return false;
  const n = name.toLowerCase();
  if (!/milch|joghurt|quark|buttermilch|kefir|schmand|sauerrahm|saure sahne|schlagsahne|crème fraîche|creme fraiche/.test(n)) {
    return false;
  }
  if (/pulver|kondens|frucht|schokolade|dessert|pudding|drink|drinks|alternative|soja|hafer|mandel|reis|kokos|lutsch|eis|mokia|aroma|aromen|sirup|kaffee|tee|cocktail|likör|likoer|honig|marmelade|aufstrich|würzm|wuerzm|dip|sauce|soße|sosse/.test(n)) {
    return false;
  }
  return true;
}

const wb = XLSX.readFile(xlsxPath);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

const seen = new Set();
const items = [];
for (const row of data) {
  if (!isBasisFood(row)) continue;
  const code = String(row['BLS Code'] || '').trim();
  if (!code || seen.has(code)) continue;
  seen.add(code);
  const kcal = parseNum(row[ENERCC]);
  if (kcal == null) continue;
  items.push({
    code,
    nameDe: String(row['Lebensmittelbezeichnung'] || '').trim().slice(0, 200),
    nameEn: String(row['Food name'] || '').trim().slice(0, 200),
    kcalPer100g: kcal,
    proteinPer100g: parseNum(row[PROT]),
    fatPer100g: parseNum(row[FAT]),
    carbsPer100g: parseNum(row[CHO]),
  });
}

items.sort((a, b) => a.code.localeCompare(b.code));

const out = {
  meta: {
    source: 'Bundeslebensmittelschlüssel (BLS) 4.0',
    publisher: 'Max Rubner-Institut (MRI)',
    license: 'CC BY 4.0',
    citation:
      'Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährwertdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0',
    subsetDescription:
      'Teilmenge: Bezeichnung endet auf „roh“, Getreidegrundprodukte (BLS-Codes C1–C3), Milchbasis ohne Frucht-/Dessert-/Pflanzendrink-Varianten.',
    itemCount: items.length,
    generatedAt: new Date().toISOString().slice(0, 10),
  },
  items,
};

const dest = path.join(root, 'server', 'data', 'bls-basis.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out), 'utf8');
console.log('OK', dest, items.length, 'Einträge,', fs.statSync(dest).size, 'Bytes');
