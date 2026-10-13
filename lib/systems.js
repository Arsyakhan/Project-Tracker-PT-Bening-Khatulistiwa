// "Sistem" = modul apa saja yang ada di sebuah project (RO, UF, Softener, dst.), dipakai untuk mengisi otomatis
// form Commissioning & Hand Over.
//
// Sumbernya Teknologi project (grid AA-CT di tab Project Tracker, dibawa daftar project sebagai `project.tech`):
// `projectSystems`. Kolom lama "Sistem Terpasang" tidak lagi diisi dari UI; isinya hanya dibaca untuk (a) OPSI
// DOKUMEN yang tidak ada di alur teknologi (CIP/dosing terpisah, tangki antara, panel, RO besar, recycle) dan
// (b) project lama yang teknologinya belum dicatat (cadangan).

export const SYSTEMS = [
  { key: 'raw_water', label: 'Raw Water Tank', hint: 'Tangki & pompa air baku' },
  { key: 'clarifier', label: 'Clarifier' },
  { key: 'dosing', label: 'Chemical Dosing', hint: 'Sistem dosing terpisah' },
  { key: 'birm', label: 'Birm Filter' },
  { key: 'mmf', label: 'Multi Media Filter' },
  { key: 'acf', label: 'Activated Carbon' },
  { key: 'softener', label: 'Softener' },
  { key: 'uf', label: 'Ultra Filtration' },
  { key: 'ro', label: 'Reverse Osmosis' },
  { key: 'mixedbed', label: 'Mixed Bed', hint: 'Hanya ada di Commissioning' },
  { key: 'int_tank', label: 'Intermediate Tank', hint: 'Hanya ada di Hand Over' },
  { key: 'panel', label: 'Control Panel', hint: 'Hanya ada di Hand Over' },
];

// Opsi tambahan khusus RO (hanya relevan di Commissioning)
export const RO_OPTIONS = [
  { key: 'ro_large', label: '+ Backpressure (RO besar)' },
  { key: 'recycle', label: '+ Flow Recycle' },
];

export const ALL_SYSTEM_KEYS = [...SYSTEMS.map((s) => s.key), ...RO_OPTIONS.map((o) => o.key)];

const LABELS = Object.fromEntries(SYSTEMS.map((s) => [s.key, s.label]));
export function systemLabel(key) {
  return LABELS[key] || key;
}

// Nilai dari sheet/API -> array kunci yang valid (urutan kanonik)
export function normalizeSystems(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  const set = new Set(raw.map((v) => String(v).trim()).filter(Boolean));
  return ALL_SYSTEM_KEYS.filter((k) => set.has(k));
}

// ---- Deteksi otomatis (cadangan) dari nama project + kolom Bentuk Project (Technology/Capacity di sheet) ----
const DETECT_RULES = [
  ['ro', /\bro(?![a-z])|reverse osmosis/i],
  ['uf', /\buf(?![a-z])|ultra ?filtration/i],
  ['mixedbed', /mix(ed)? ?bed/i],
  ['mmf', /\bmmf(?![a-z])|multi ?media/i],
  ['acf', /\bacf(?![a-z])|activated carbon|carbon filter/i],
  ['birm', /birm/i],
  ['softener', /softener/i],
  ['clarifier', /clarifier/i],
];

export function detectSystems(project) {
  const text = `${project?.projectName || ''} ${project?.technology || ''}`;
  return DETECT_RULES.filter(([, re]) => re.test(text)).map(([key]) => key);
}

// Cadangan untuk project yang teknologinya belum dicatat: kolom lama "Sistem Terpasang", kalau kosong pakai hasil deteksi.
export function effectiveSystems(project) {
  const saved = normalizeSystems(project?.sistemTerpasang);
  if (saved.length > 0) return { keys: saved, detected: false };
  return { keys: detectSystems(project), detected: true };
}

// ---- Teknologi (modul alur) -> kunci sistem ----
export const MODULE_TO_SYSTEM = {
  feed_pump: 'raw_water', raw_tank: 'raw_water',
  dosing_hypo: 'dosing', dosing_pac: 'dosing', dosing_soda: 'dosing', dosing_polimer: 'dosing',
  dosing_smbs: 'dosing', dosing_antiscalant: 'dosing', dosing_ph: 'dosing',
  clarifier: 'clarifier', birm: 'birm', mmf: 'mmf', acf: 'acf', softener: 'softener', uf: 'uf', ro: 'ro', mixedbed: 'mixedbed',
  ro2: 'ro', // RO pass 2 memakai seksi RO di dokumen
  // Modul lain (strainer, aerator, flokulator, greensand, ERD, degasifier, ion exchange, EDI, remineralisasi, UV, ozon,
  // filter 0,2 um, pompa distribusi, cleaning/flushing pump & tank) tidak punya seksi di template dokumen, jadi tidak
  // diterjemahkan ke kunci sistem; datanya tetap tercatat di Teknologi dan dibaca sebagai catatan.
};

// Opsi di luar alur modul yang tetap dipilih manual (hanya untuk dokumen); disimpan di kolom lama "Sistem Terpasang".
export const TECH_EXTRA_KEYS = ['dosing', 'int_tank', 'panel', 'ro_large', 'recycle'];

export const hasDosingModule = (modules) => (modules || []).some((m) => MODULE_TO_SYSTEM[m.key] === 'dosing');

// Kunci sistem = turunan modul + opsi dokumen yang dipilih manual (extras).
export function deriveSystemKeys(modules, extras = []) {
  const set = new Set(extras);
  (modules || []).forEach((m) => { if (MODULE_TO_SYSTEM[m.key]) set.add(MODULE_TO_SYSTEM[m.key]); });
  if (!set.has('ro')) { set.delete('ro_large'); set.delete('recycle'); }
  return ALL_SYSTEM_KEYS.filter((k) => set.has(k));
}

// Opsi dokumen yang tersimpan di project (tanpa kunci turunan modul).
export function documentExtras(project) {
  return normalizeSystems(project?.sistemTerpasang).filter((k) => TECH_EXTRA_KEYS.includes(k));
}

// Sistem sebuah project untuk dokumen & tampilan. `techModules` (opsional) = teknologi yang sedang dibuka di halaman
// (mis. yang belum disimpan); kalau tidak ada dipakai `project.tech` dari daftar project.
//  - teknologi terisi  -> diturunkan dari modul + opsi dokumen (tidak pernah basi);
//  - teknologi kosong / backend belum membawa `tech` -> cadangan lama (`effectiveSystems`).
export function projectSystems(project, techModules) {
  const mods = Array.isArray(techModules) ? techModules : project?.tech;
  if (Array.isArray(mods) && mods.length > 0) {
    return { keys: deriveSystemKeys(mods, documentExtras(project)), detected: false, fromTech: true };
  }
  return { ...effectiveSystems(project), fromTech: false };
}

// ---- Pemetaan ke form Commissioning ----
export function toCommissioningModules(keys) {
  const has = (k) => keys.includes(k);
  return {
    has_clarifier: has('clarifier'),
    has_dosing: has('dosing'),
    has_birm: has('birm'),
    has_mmf: has('mmf'),
    has_acf: has('acf'),
    has_softener: has('softener'),
    has_uf: has('uf'),
    has_ro: has('ro'),
    has_mixedbed: has('mixedbed'),
    is_ro_large: has('ro') && has('ro_large'),
    has_recycle: has('ro') && has('recycle'),
  };
}

// ---- Pemetaan ke form Hand Over ----
// Template Hand Over hanya punya 2 slot filter (Filter 1 & Filter 2), diisi berurutan:
// Birm -> MMF -> Carbon.
const FILTER_ORDER = [
  { key: 'birm', name: 'Birm Iron Removal Filter' },
  { key: 'mmf', name: 'Multi Media Filter' },
  { key: 'acf', name: 'Activated Carbon Filter' },
];

export function toHandoverModules(keys) {
  const has = (k) => keys.includes(k);
  const filters = FILTER_ORDER.filter((f) => has(f.key));
  return {
    values: {
      has_raw_water: has('raw_water'),
      has_clarifier: has('clarifier'),
      has_filter_1: filters.length >= 1,
      has_filter_2: filters.length >= 2,
      has_uf: has('uf'),
      has_int_tank: has('int_tank'),
      has_softener: has('softener'),
      has_ro: has('ro'),
      has_cip: has('dosing'),
      has_panel: has('panel'),
      f1_type: filters[0] ? filters[0].name : '',
      f2_type: filters[1] ? filters[1].name : '',
    },
    // Filter yang tidak muat di 2 slot Hand Over (perlu dicatat manual di "Item Tambahan")
    overflowFilters: filters.slice(2).map((f) => f.name),
    // Kunci modul filter yang tidak muat; spesifikasinya tampil sebagai seksi tambahan (lib/docgen/specExtra.js)
    overflowKeys: filters.slice(2).map((f) => f.key),
    // Sistem yang tidak punya seksi di template Hand Over
    notInHandover: has('mixedbed') ? ['Mixed Bed'] : [],
  };
}

// ---- Judul sistem (System Title) yang disarankan ----
const TREATMENT_KEYS = ['clarifier', 'birm', 'mmf', 'acf', 'softener', 'uf', 'ro', 'mixedbed'];

export function suggestSystemTitle(keys, { upper = false } = {}) {
  const treat = keys.filter((k) => TREATMENT_KEYS.includes(k));
  let title = '';
  if (treat.length >= 2) title = 'Water Treatment Plant';
  else if (treat[0] === 'ro') title = 'Reverse Osmosis System';
  else if (treat[0] === 'uf') title = 'Ultra Filtration System';
  else if (treat[0] === 'softener') title = 'Softener System';
  else if (treat[0] === 'mmf') title = 'Multi Media Filter System';
  else if (treat[0] === 'acf') title = 'Activated Carbon Filter System';
  else if (treat[0] === 'birm') title = 'Birm Iron Removal System';
  else if (treat[0] === 'clarifier') title = 'Clarifier System';
  else if (treat[0] === 'mixedbed') title = 'Mixed Bed System';
  else if (keys.includes('dosing')) title = 'Chemical Dosing System';
  return upper ? title.toUpperCase() : title;
}

// ---- Kesiapan data untuk membuat dokumen ----
// Mengembalikan { ready, missing[], note }. "missing" = hal yang sebaiknya dilengkapi di detail project.
export function docReadiness(project, docType) {
  const missing = [];
  if (!String(project?.client || '').trim()) missing.push('client');
  if (!String(project?.lokasiPlant || '').trim()) missing.push('lokasi plant');
  const { keys, detected } = projectSystems(project);
  if (keys.length === 0) missing.push('teknologi');
  if (docType === 'commissioning' && !String(project?.kontakOwner || '').trim()) missing.push('kontak owner');
  return {
    ready: missing.length === 0,
    missing,
    note: detected && keys.length > 0 ? 'Teknologi belum dicatat; sistem terdeteksi dari nama project, cek kembali.' : '',
  };
}
