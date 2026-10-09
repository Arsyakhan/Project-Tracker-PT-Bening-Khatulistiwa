// Alur teknologi pengolahan air, urut dari air baku sampai air produk.
// Urutan dan nama modul mengikuti tab "[ARSIP] FINISHED PROJECT" di spreadsheet, supaya project
// yang sedang berjalan dan project arsip dibaca dengan cara yang sama.
//
// Kunci modul ARSIP (key) HARUS sama dengan ARCHIVE_MODULE_KEYS di apps-script/Archive.gs.
import { effectiveSystems } from './systems';

export const FLOW_PHASES = [
  { key: 'baku', label: 'Air baku' },
  { key: 'dosing', label: 'Dosing & klarifikasi' },
  { key: 'filtrasi', label: 'Filtrasi' },
  { key: 'lunak', label: 'Pelunakan' },
  { key: 'membran', label: 'Membran' },
  { key: 'produk', label: 'Polishing & produk' },
];

export const FLOW_STEPS = [
  { key: 'feed_pump', label: 'Feed Raw Water Pump', short: 'Pompa air baku', phase: 'baku' },
  { key: 'raw_tank', label: 'Raw / Intermediate Water Tank', short: 'Tangki air baku', phase: 'baku' },
  { key: 'dosing_hypo', label: 'Dosing Pump Sodium Hypochlorite', short: 'Dosing NaOCl', phase: 'dosing' },
  { key: 'dosing_pac', label: 'Dosing Pump PAC', short: 'Dosing PAC', phase: 'dosing' },
  { key: 'dosing_soda', label: 'Dosing Pump Soda Ash', short: 'Dosing Soda Ash', phase: 'dosing' },
  { key: 'dosing', label: 'Chemical Dosing', short: 'Dosing kimia', phase: 'dosing' },
  { key: 'clarifier', label: 'Clarifier', short: 'Clarifier', phase: 'dosing' },
  { key: 'filter_pump', label: 'Filter Pump', short: 'Pompa filter', phase: 'filtrasi' },
  { key: 'mmf', label: 'Multi Media Filter', short: 'MMF', phase: 'filtrasi' },
  { key: 'birm', label: 'Birm Filter', short: 'Birm', phase: 'filtrasi' },
  { key: 'chlorination', label: 'Chlorination', short: 'Chlorination', phase: 'filtrasi' },
  { key: 'acf', label: 'Activated Carbon Filter', short: 'ACF', phase: 'filtrasi' },
  { key: 'softener', label: 'Softener', short: 'Softener', phase: 'lunak' },
  { key: 'soft_tank', label: 'Soft Water Tank', short: 'Tangki soft', phase: 'lunak' },
  { key: 'int_tank', label: 'Intermediate Tank', short: 'Tangki antara', phase: 'lunak' },
  { key: 'uf_pump', label: 'UF Filter Feed Pump', short: 'Pompa UF', phase: 'membran' },
  { key: 'uf', label: 'Ultra Filtration', short: 'UF', phase: 'membran' },
  { key: 'cartridge', label: 'Cartridge Filter', short: 'Cartridge', phase: 'membran' },
  { key: 'booster', label: 'Booster Feed Pump', short: 'Pompa booster', phase: 'membran' },
  { key: 'ro', label: 'Reverse Osmosis', short: 'RO', phase: 'membran' },
  { key: 'mixedbed', label: 'Mixed Bed', short: 'Mixed Bed', phase: 'produk' },
  { key: 'product_tank', label: 'Product Water Tank', short: 'Tangki produk', phase: 'produk' },
];

const STEP_BY_KEY = Object.fromEntries(FLOW_STEPS.map((s) => [s.key, s]));
const ORDER = Object.fromEntries(FLOW_STEPS.map((s, i) => [s.key, i]));

export const stepInfo = (key) => STEP_BY_KEY[key] || null;

// Modul yang kuncinya tidak dikenal (kolom baru di sheet) ditaruh di akhir, di fase "produk".
export function sortModules(modules) {
  return (modules || []).slice().sort((a, b) => (ORDER[a.key] ?? 999) - (ORDER[b.key] ?? 999));
}

// Kelompokkan modul per fase (hanya fase yang berisi). Mengembalikan [{ key, label, items: [...] }].
export function groupByPhase(modules) {
  const sorted = sortModules(modules);
  const out = [];
  FLOW_PHASES.forEach((ph) => {
    const items = sorted.filter((m) => (STEP_BY_KEY[m.key]?.phase || 'produk') === ph.key);
    if (items.length) out.push({ ...ph, items });
  });
  return out;
}

export function moduleLabel(m, short = false) {
  const s = STEP_BY_KEY[m.key];
  if (s) return short ? s.short : s.label;
  return m.label || m.key;
}

export const ARCHIVE_UNITS = ['MPH', 'LPH', 'LITER', 'MPD', 'LPD'];

// Satuan isian spesifikasi (m3/hr, Liter, ...) -> satuan baku arsip. Tidak dikenal -> ''.
export function toArchiveUnit(unit) {
  const u = String(unit ?? '').toLowerCase().replace(/\s+/g, '');
  if (/^(mph|tph|m3\/h|m3\/hr|m3\/jam|m³\/jam|m3\/hour)$/.test(u)) return 'MPH';
  if (/^(lph|l\/h|l\/hr|liter\/jam)$/.test(u)) return 'LPH';
  if (/^(liter|l|litre|liters)$/.test(u)) return 'LITER';
  if (/^(mpd|m3\/day|m3\/hari)$/.test(u)) return 'MPD';
  if (/^(lpd|l\/day|liter\/hari)$/.test(u)) return 'LPD';
  return '';
}

const UNIT_LABEL = { LITER: 'L', LPH: 'LPH', MPH: 'MPH', MPD: 'MPD', LPD: 'LPD' };

// "8.5" + "MPH" -> "8,5 MPH". Kosong kalau tidak ada angka kapasitas.
export function formatCapacity(cap, unit) {
  const c = String(cap ?? '').trim();
  if (!c) return '';
  const num = /^\d+(\.\d+)?$/.test(c) ? Number(c).toLocaleString('id-ID', { maximumFractionDigits: 2 }) : c;
  const u = String(unit ?? '').trim();
  return u ? `${num} ${UNIT_LABEL[u.toUpperCase()] || u}` : num;
}

// ---------- Project yang sedang berjalan: sistem terpasang + spesifikasi -> modul alur ----------
// specs = nilai form Hand Over (kunci seperti ro_cap, ro_unit). Boleh null (kapasitas dikosongkan).
const FILTER_SLOTS = ['birm', 'mmf', 'acf'];

export function projectFlowModules(project, specs) {
  const keys = effectiveSystems(project).keys;
  const has = (k) => keys.includes(k);
  const v = (id) => String(specs?.[id] ?? '').trim();
  const mod = (key, cap, unit) => ({ key, cap: cap || '', unit: unit || '', detail: '' });
  const out = [];

  if (has('raw_water')) {
    out.push(mod('feed_pump', v('rw_pump_cap'), v('rw_pump_cap') ? 'm3/hr' : ''));
    out.push(mod('raw_tank', v('rw_tank_cap'), v('rw_tank_unit')));
  }
  if (has('dosing')) out.push(mod('dosing'));
  if (has('clarifier')) out.push(mod('clarifier', v('clarifier_cap'), v('clarifier_unit')));

  // Template Hand Over mengisi slot filter berurutan: Birm -> MMF -> Carbon (maksimal 2 slot terisi).
  const filters = FILTER_SLOTS.filter(has);
  filters.forEach((k, i) => {
    const slot = i === 0 ? 'f1' : i === 1 ? 'f2' : null;
    out.push(slot ? mod(k, v(`${slot}_cap`), v(`${slot}_unit`)) : mod(k));
  });

  if (has('softener')) out.push(mod('softener', v('soft_cap'), v('soft_unit')));
  if (has('int_tank')) out.push(mod('int_tank', v('int_tank_cap'), v('int_tank_unit')));
  if (has('uf')) out.push(mod('uf', v('uf_cap'), v('uf_unit')));
  if (has('ro')) out.push(mod('ro', v('ro_cap'), v('ro_unit')));
  if (has('mixedbed')) out.push(mod('mixedbed'));
  return sortModules(out);
}

// Urutan tampilan untuk daftar "Sistem terpasang" (hanya tampilan; urutan simpan tetap seperti SYSTEMS).
export const SYSTEM_DISPLAY_ORDER = ['raw_water', 'dosing', 'clarifier', 'mmf', 'birm', 'acf', 'softener', 'int_tank', 'uf', 'ro', 'mixedbed', 'panel'];

// ---------- Kemiripan dengan project arsip ----------
// Skor 0..1 = 60% kemiripan himpunan modul utama (RO/UF/softener/filter...) + 40% kedekatan kapasitas
// pada teknologi utama yang sama-sama dimiliki. Kapasitas dibandingkan setelah disamakan ke m3/jam.
const CORE = ['clarifier', 'mmf', 'birm', 'acf', 'softener', 'uf', 'ro', 'mixedbed'];
const CAPACITY_KEYS = ['ro', 'uf', 'softener', 'mmf', 'acf'];

// "30" + "MPH" / "m3/hr" / "TPH" -> 30 ; "160" + "LPH" -> 0.16 ; per hari dibagi 24. Tidak dikenal -> null.
export function toM3PerHour(cap, unit) {
  const n = Number(String(cap ?? '').replace(',', '.'));
  if (!(n > 0)) return null;
  const u = String(unit ?? '').toLowerCase().replace(/\s+/g, '');
  if (/^(mph|tph|m3\/h|m3\/hr|m3\/jam|m³\/jam)$/.test(u)) return n;
  if (/^(lph|l\/h|l\/hr|liter\/jam)$/.test(u)) return n / 1000;
  if (/^(mpd|m3\/day|m3\/hari)$/.test(u)) return n / 24;
  if (/^(lpd|l\/day|liter\/hari)$/.test(u)) return n / 1000 / 24;
  return null;
}

export function similarityScore(aModules, bModules) {
  const A = aModules || [];
  const B = bModules || [];
  const a = new Set(A.map((m) => m.key).filter((k) => CORE.includes(k)));
  const b = new Set(B.map((m) => m.key).filter((k) => CORE.includes(k)));
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((k) => { if (b.has(k)) inter += 1; });
  const jaccard = inter / (a.size + b.size - inter);

  // Kapasitas: pakai teknologi utama pertama yang dimiliki keduanya dan punya angka kapasitas.
  let capScore = 0.5; // netral kalau tidak bisa dibandingkan
  for (const k of CAPACITY_KEYS) {
    const ma = A.find((m) => m.key === k);
    const mb = B.find((m) => m.key === k);
    if (!ma || !mb) continue;
    const ca = toM3PerHour(ma.cap, ma.unit);
    const cb = toM3PerHour(mb.cap, mb.unit);
    if (ca && cb) { capScore = Math.min(ca, cb) / Math.max(ca, cb); break; }
  }
  return jaccard * 0.6 + capScore * 0.4;
}

export function findSimilar(modules, archive, limit = 3) {
  return (archive || [])
    .map((p) => ({ project: p, score: similarityScore(modules, p.modules) }))
    .filter((x) => x.score >= 0.6)
    .sort((a, b) => b.score - a.score || String(b.project.year).localeCompare(String(a.project.year)))
    .slice(0, limit);
}

// Ringkasan satu baris untuk daftar: "UF 6 MPH → RO 4 MPH".
export function chainText(modules, max = 4) {
  const core = sortModules(modules).filter((m) => !m.key.startsWith('dosing') && !['feed_pump', 'raw_tank', 'filter_pump', 'soft_tank', 'uf_pump', 'booster', 'cartridge', 'product_tank'].includes(m.key));
  const parts = core.slice(0, max).map((m) => {
    const cap = formatCapacity(m.cap, m.unit);
    return cap ? `${moduleLabel(m, true)} ${cap}` : moduleLabel(m, true);
  });
  return parts.join(' → ') + (core.length > max ? ` +${core.length - max}` : '');
}

// ---------- Teknologi project aktif (satu model dengan arsip) ----------
// Teknologi sebuah project = daftar modul yang sama dengan tab arsip (alur air baku -> produk, tiap modul
// punya kapasitas, satuan, dan detail). Disimpan di tab "Project Specs" sebagai kunci datar tech_<modul>_*.
// "Sistem terpasang" (untuk form Commissioning & Hand Over) DITURUNKAN dari modul ini.

// Modul yang bisa dipilih untuk project. Harus sama dengan kolom tab arsip (ARCHIVE_MODULE_KEYS di Archive.gs):
// pompa dosing dan tangki produk hanya dicatat "ada"; sisanya punya kapasitas, satuan, dan detail.
const ADA_ONLY = new Set(['dosing_hypo', 'dosing_pac', 'dosing_soda', 'product_tank']);
const NOT_IN_ARCHIVE = new Set(['dosing', 'int_tank']);
export const TECH_SCHEMA = FLOW_STEPS.filter((s) => !NOT_IN_ARCHIVE.has(s.key)).map((s) => {
  const full = !ADA_ONLY.has(s.key);
  return { key: s.key, label: s.label, hasCap: full, hasUnit: full, hasDetail: full };
});
const TECH_KEYS = new Set(TECH_SCHEMA.map((s) => s.key));
export const TECH_DETAIL_MAX = 800; // sel Project Specs dibatasi; 20 modul x 800 karakter masih aman

export const TECH_SPEC_IDS = ['tech_v'];
TECH_SCHEMA.forEach((s) => ['on', 'cap', 'unit', 'detail'].forEach((f) => TECH_SPEC_IDS.push(`tech_${s.key}_${f}`)));

// Nilai specs -> daftar modul, atau null kalau teknologi belum pernah disimpan.
export function readTech(specs) {
  if (String(specs?.tech_v ?? '') !== '1') return null;
  return TECH_SCHEMA.filter((s) => String(specs[`tech_${s.key}_on`] ?? '') === '1').map((s) => ({
    key: s.key,
    cap: String(specs[`tech_${s.key}_cap`] ?? ''),
    unit: String(specs[`tech_${s.key}_unit`] ?? ''),
    detail: String(specs[`tech_${s.key}_detail`] ?? ''),
  }));
}

// Daftar modul -> semua kunci tech_* (yang tidak dipilih dikosongkan supaya terhapus dari penyimpanan).
export function writeTech(modules) {
  const by = {};
  (modules || []).forEach((m) => { by[m.key] = m; });
  const out = { tech_v: '1' };
  TECH_SCHEMA.forEach((s) => {
    const m = by[s.key];
    out[`tech_${s.key}_on`] = m ? '1' : '';
    out[`tech_${s.key}_cap`] = m ? String(m.cap || '').trim() : '';
    out[`tech_${s.key}_unit`] = m ? String(m.unit || '') : '';
    out[`tech_${s.key}_detail`] = m ? String(m.detail || '').slice(0, TECH_DETAIL_MAX) : '';
  });
  return out;
}

// Isi awal untuk project yang belum punya teknologi tersimpan: dari sistem terpasang + spesifikasi yang sudah ada.
export function prefillTech(project, specs) {
  return projectFlowModules(project, specs)
    .filter((m) => TECH_KEYS.has(m.key))
    .map((m) => ({ key: m.key, cap: m.cap, unit: toArchiveUnit(m.unit), detail: '' }));
}

// Teknologi yang dipakai halaman: yang tersimpan, kalau belum ada pakai isi awal dari data lama.
export function currentTech(project, specs) {
  return readTech(specs) || prefillTech(project, specs);
}

// Modul teknologi -> kunci "sistem terpasang" (yang dipakai form Commissioning & Hand Over).
const MODULE_TO_SYSTEM = {
  feed_pump: 'raw_water', raw_tank: 'raw_water',
  dosing_hypo: 'dosing', dosing_pac: 'dosing', dosing_soda: 'dosing',
  clarifier: 'clarifier', birm: 'birm', mmf: 'mmf', acf: 'acf', softener: 'softener', uf: 'uf', ro: 'ro', mixedbed: 'mixedbed',
};

// Opsi di luar alur modul yang tetap dipilih manual (hanya untuk dokumen).
export const TECH_EXTRA_KEYS = ['dosing', 'int_tank', 'panel', 'ro_large', 'recycle'];

export const hasDosingModule = (modules) => (modules || []).some((m) => MODULE_TO_SYSTEM[m.key] === 'dosing');

// Kunci sistem terpasang = turunan modul + opsi tambahan yang dipilih manual (extras).
export function deriveSystemKeys(modules, extras = []) {
  const set = new Set(extras);
  (modules || []).forEach((m) => { if (MODULE_TO_SYSTEM[m.key]) set.add(MODULE_TO_SYSTEM[m.key]); });
  if (!set.has('ro')) { set.delete('ro_large'); set.delete('recycle'); }
  return Array.from(set);
}

// Modul untuk tampilan alur: teknologi tersimpan (ditambah dosing/tangki antara yang dipilih sebagai opsi tambahan),
// atau, kalau belum ada, dibaca dari sistem terpasang + spesifikasi lama.
export function projectTechModules(project, specs) {
  const saved = readTech(specs);
  if (!saved) return projectFlowModules(project, specs);
  const keys = effectiveSystems(project).keys;
  const out = [...saved];
  if (keys.includes('dosing') && !hasDosingModule(saved)) out.push({ key: 'dosing', cap: '', unit: '', detail: '' });
  if (keys.includes('int_tank')) out.push({ key: 'int_tank', cap: '', unit: '', detail: '' });
  return sortModules(out);
}

// ---------- Isi otomatis kapasitas di Spesifikasi Peralatan (untuk form Hand Over) ----------
// Saat teknologi disimpan, kolom kapasitas di Spesifikasi yang MASIH KOSONG diisi dari teknologi
// (satuan disesuaikan). Kolom yang sudah terisi tidak pernah ditimpa.
function toSpecCap(cap, unit, kind) {
  const n = Number(String(cap ?? '').replace(',', '.'));
  if (!(n > 0)) return null;
  const r = (x) => String(Math.round(x * 1000) / 1000);
  if (kind === 'flow') {
    if (unit === 'MPH') return { value: r(n), unit: 'm3/hr' };
    if (unit === 'LPH') return { value: r(n / 1000), unit: 'm3/hr' };
    if (unit === 'MPD') return { value: r(n), unit: 'CMD' };
    if (unit === 'LPD') return { value: r(n / 1000), unit: 'CMD' };
  }
  if (kind === 'volume' && unit === 'LITER') return { value: r(n), unit: 'Liters' };
  return null;
}

export function fillSpecCaps(specs, modules) {
  const out = { ...(specs || {}) };
  const by = {};
  (modules || []).forEach((m) => { by[m.key] = m; });
  const fill = (m, capId, unitId, kind) => {
    if (!m || String(out[capId] ?? '').trim()) return;
    const conv = toSpecCap(m.cap, m.unit, kind);
    if (!conv) return;
    out[capId] = conv.value;
    if (unitId) out[unitId] = conv.unit;
  };
  fill(by.feed_pump, 'rw_pump_cap', null, 'flow');
  fill(by.raw_tank, 'rw_tank_cap', 'rw_tank_unit', 'volume');
  fill(by.clarifier, 'clarifier_cap', 'clarifier_unit', 'flow');
  // Slot filter Hand Over diisi berurutan Birm -> MMF -> Carbon (maksimal 2 slot).
  FILTER_SLOTS.filter((k) => by[k]).slice(0, 2).forEach((k, i) => fill(by[k], i === 0 ? 'f1_cap' : 'f2_cap', i === 0 ? 'f1_unit' : 'f2_unit', 'flow'));
  fill(by.softener, 'soft_cap', 'soft_unit', 'flow');
  fill(by.uf, 'uf_cap', 'uf_unit', 'flow');
  fill(by.ro, 'ro_cap', 'ro_unit', 'flow');
  return out;
}
