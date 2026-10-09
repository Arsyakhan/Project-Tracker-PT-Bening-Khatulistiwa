/**
 * BENING HUB — ARSIP PROJECT SELESAI (baca & tulis, dua arah dengan spreadsheet)
 * ---------------------------------------------------
 * FILE TAMBAHAN di project Apps Script Tracker yang SAMA dengan Code.gs
 * (di editor: klik "+" di samping "Files" > Script > beri nama "Archive").
 *
 * Mengelola tab "[ARSIP] FINISHED PROJECT". Edit di web langsung tertulis ke tab ini, dan edit manual
 * di tab ini langsung terbaca web (tidak ada cache). Struktur tab TIDAK diubah: kolom, urutan modul,
 * dan baris judul tetap seperti buatan Anda.
 *
 * Format tab: baris 1 = nama modul (sel kosong = lanjutan modul sebelumnya), baris 2 = sub-judul
 * ("Ada", "Kapasitas", "Satuan", "Detail Spesifikasi"), data mulai baris 3. Kolom A-C = No, Tahun,
 * Nama Project. Modul baru: tambah kolomnya di sheet (nama di baris 1, sub-judul di baris 2) lalu
 * muat ulang web; modul yang namanya belum dikenal tetap terbaca dengan kunci otomatis.
 *
 * Tidak bentrok antar-penyunting: setiap baris punya `rev` (sidik jari isi baris). Simpan dari web
 * ditolak kalau baris itu berubah sejak dimuat (mis. diedit manual di sheet), supaya tidak saling menimpa.
 *
 * AGAR TERPAKAI: doGet/doPost di Code.gs harus mengenali 3 aksi:
 *   GET  archive                 -> getArchive_()
 *   POST saveArchiveProject      -> saveArchiveProject_(payload)
 *   POST deleteArchiveProject    -> deleteArchiveProject_(payload)
 * (sudah ada di Code.gs v2.5). Setelah ditempel: Deploy > Manage deployments > ikon pensil >
 * Version: New version > Deploy.
 */

const SHEET_ARCHIVE = '[ARSIP] FINISHED PROJECT';
const ARCHIVE_MAX_MODULES = 40;
const ARCHIVE_UNITS = ['MPH', 'LPH', 'LITER', 'MPD', 'LPD'];

// Kunci tetap untuk modul yang sudah dikenal (urutan alur pengolahan air ada di sisi web).
const ARCHIVE_MODULE_KEYS = {
  'feed raw water pump': 'feed_pump',
  'raw / intermediate water tank': 'raw_tank',
  'dosing pump sodium hypochlorite': 'dosing_hypo',
  'dosing pump pac': 'dosing_pac',
  'dosing pump soda ash': 'dosing_soda',
  'clarifier': 'clarifier',
  'filter pump': 'filter_pump',
  'mmf': 'mmf',
  'birm filter': 'birm',
  'chlorination': 'chlorination',
  'acf': 'acf',
  'softener': 'softener',
  'soft water tank': 'soft_tank',
  'uf filter feed pump': 'uf_pump',
  'uf': 'uf',
  'cartridge filter': 'cartridge',
  'booster feed pump': 'booster',
  'ro': 'ro',
  'mixed bed': 'mixedbed',
  'product water tank': 'product_tank'
};

function archiveModuleKey_(label) {
  const norm = cleanText_(label).toLowerCase();
  if (ARCHIVE_MODULE_KEYS[norm]) return ARCHIVE_MODULE_KEYS[norm];
  const slug = norm.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 40);
  return slug ? 'x_' + slug : '';
}

function archiveIsOn_(v) {
  if (v === true) return true;
  return String(v === null || v === undefined ? '' : v).trim().toUpperCase() === 'TRUE';
}

// "5," -> "5", "8,5" -> "8.5", 1.8 -> "1.8"; teks bebas dibiarkan.
function archiveCap_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return String(v);
  let s = String(v).trim().replace(/[,.\s]+$/, '');
  if (/^\d+,\d+$/.test(s)) s = s.replace(',', '.');
  return s;
}

// Sidik jari isi satu baris (djb2). Berubah kalau ada sel yang berubah, di web maupun di sheet.
function archiveRev_(row) {
  const str = (row || []).map(function (c) {
    return c === null || c === undefined ? '' : (c === true ? 'TRUE' : c === false ? 'FALSE' : String(c));
  }).join('\u0001');
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + '.' + str.length.toString(36);
}

// Letak kolom tiap modul dari 2 baris judul. Fungsi MURNI.
function archiveSchemaFromHeaders_(head, sub) {
  const modules = [];
  for (let c = 3; c < head.length; c++) {
    const label = cleanText_(head[c]);
    if (label) modules.push({ label: label, key: archiveModuleKey_(label), start: c, end: head.length });
  }
  for (let i = 0; i < modules.length - 1; i++) modules[i].end = modules[i + 1].start;
  modules.forEach(function (m) {
    m.cols = { on: m.start, cap: -1, unit: -1, detail: -1 };
    for (let c = m.start; c < m.end; c++) {
      const s = cleanText_(sub[c]).toLowerCase();
      if (s.indexOf('ada') === 0) m.cols.on = c;
      else if (s.indexOf('kapasitas') === 0) m.cols.cap = c;
      else if (s.indexOf('satuan') === 0) m.cols.unit = c;
      else if (s.indexOf('detail') === 0) m.cols.detail = c;
    }
  });
  return modules;
}

function archiveProjectFromRow_(modules, row, rowNumber) {
  const no = cleanText_(row[0]);
  const mods = [];
  modules.forEach(function (m) {
    if (!m.key || !archiveIsOn_(row[m.cols.on])) return;
    mods.push({
      key: m.key,
      label: m.label,
      cap: m.cols.cap > -1 ? archiveCap_(row[m.cols.cap]) : '',
      unit: m.cols.unit > -1 ? cleanText_(row[m.cols.unit]).toUpperCase() : '',
      detail: m.cols.detail > -1 ? clip_(cleanText_(row[m.cols.detail]), 4000) : ''
    });
  });
  return {
    id: 'arc_' + (no || String(rowNumber)),
    no: no,
    row: rowNumber,
    rev: archiveRev_(row),
    year: cleanText_(row[1]),
    name: cleanText_(row[2]),
    modules: mods
  };
}

// Fungsi MURNI (tidak memakai API Apps Script) supaya mudah diuji: values = array 2 dimensi dari sheet.
// Hasil: { schema: [{key,label,hasCap,hasUnit,hasDetail}], projects: [...] }
function parseArchiveValues_(values) {
  if (!values || values.length < 2) return { schema: [], projects: [] };
  const modules = archiveSchemaFromHeaders_(values[0], values[1]);
  const schema = modules.filter(function (m) { return m.key; }).map(function (m) {
    return { key: m.key, label: m.label, hasCap: m.cols.cap > -1, hasUnit: m.cols.unit > -1, hasDetail: m.cols.detail > -1 };
  });
  const projects = [];
  for (let r = 2; r < values.length; r++) {
    if (!cleanText_(values[r][2])) continue;
    projects.push(archiveProjectFromRow_(modules, values[r], r + 1));
  }
  return { schema: schema, projects: projects };
}

function getArchiveSheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ARCHIVE);
  if (!sh) throw new Error('Tab "' + SHEET_ARCHIVE + '" tidak ditemukan di spreadsheet.');
  return sh;
}

function readArchiveValues_(sh) {
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 4) return { values: [], lastCol: lastCol };
  return { values: sh.getRange(1, 1, lastRow, lastCol).getValues(), lastCol: lastCol };
}

// Semua project arsip. Kalau tab belum ada, hasilnya kosong (bukan error).
function getArchive_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ARCHIVE);
  if (!sh) return { schema: [], projects: [] };
  return parseArchiveValues_(readArchiveValues_(sh).values);
}

// Rapikan isian dari web. Hanya modul yang kolomnya ada di sheet yang diterima.
function sanitizeArchiveProject_(p, schema) {
  const name = clip_(cleanText_(p.name), 200);
  if (!name) throw new Error('Nama project wajib diisi.');
  const year = cleanText_(p.year);
  if (!/^\d{4}$/.test(year)) throw new Error('Tahun harus 4 angka, mis. 2026.');
  if (!Array.isArray(p.modules)) throw new Error('Daftar modul tidak valid.');
  if (p.modules.length > ARCHIVE_MAX_MODULES) throw new Error('Terlalu banyak modul.');

  const byKey = {};
  schema.forEach(function (m) { byKey[m.key] = m; });
  const seen = {};
  const modules = [];
  p.modules.forEach(function (m) {
    const key = cleanText_(m && m.key);
    const def = byKey[key];
    if (!def) throw new Error('Modul tidak dikenal: ' + key);
    if (seen[key]) throw new Error('Modul dobel: ' + def.label);
    seen[key] = true;
    const cap = def.hasCap ? clip_(cleanText_(m.cap).replace(',', '.'), 40) : '';
    if (cap && /^\d+(\.\d+)?$/.test(cap) === false && /^[0-9.,\s]+$/.test(cap)) throw new Error('Kapasitas ' + def.label + ' tidak valid.');
    let unit = def.hasUnit ? clip_(cleanText_(m.unit).toUpperCase(), 10) : '';
    if (unit && ARCHIVE_UNITS.indexOf(unit) === -1) throw new Error('Satuan ' + def.label + ' tidak dikenal: ' + unit);
    modules.push({ key: key, cap: cap, unit: unit, detail: def.hasDetail ? clip_(cleanText_(m.detail), 4000) : '' });
  });
  return { name: name, year: year, modules: modules };
}

// Tulis nilai modul ke satu baris (array sel). Modul yang tidak dipilih dimatikan dan dikosongkan.
function applyArchiveModules_(row, modulesDef, chosen) {
  const byKey = {};
  chosen.forEach(function (m) { byKey[m.key] = m; });
  modulesDef.forEach(function (d) {
    if (!d.key) return;
    const m = byKey[d.key];
    row[d.cols.on] = !!m;
    if (d.cols.cap > -1) row[d.cols.cap] = m && m.cap !== '' ? (/^\d+(\.\d+)?$/.test(m.cap) ? Number(m.cap) : sheetSafe_(m.cap)) : '';
    if (d.cols.unit > -1) row[d.cols.unit] = m ? sheetSafe_(m.unit) : '';
    if (d.cols.detail > -1) row[d.cols.detail] = m ? sheetSafe_(m.detail) : '';
  });
}

function archiveSummary_(modules) {
  return modules.map(function (m) { return m.key + (m.cap ? ' ' + m.cap + (m.unit ? ' ' + m.unit : '') : ''); }).join(', ');
}

function saveArchiveProject_(payload) {
  const user = payload.user || 'Tidak diketahui';
  const sh = getArchiveSheet_();
  const read = readArchiveValues_(sh);
  if (read.values.length < 2) throw new Error('Baris judul tab arsip belum lengkap (baris 1 dan 2).');
  const values = read.values;
  const lastCol = read.lastCol;
  const modulesDef = archiveSchemaFromHeaders_(values[0], values[1]);
  const parsed = parseArchiveValues_(values);
  const clean = sanitizeArchiveProject_(payload, parsed.schema);
  const id = cleanText_(payload.id);

  if (id) {
    const cur = parsed.projects.filter(function (p) { return p.id === id; });
    if (cur.length === 0) throw new Error('Project arsip tidak ditemukan. Mungkin sudah dihapus. Muat ulang halaman.');
    if (cur.length > 1) throw new Error('Nomor arsip dobel di sheet (kolom No). Perbaiki dulu di spreadsheet.');
    const found = cur[0];
    if (cleanText_(payload.baseRev) !== found.rev) {
      throw new Error('Baris arsip ini sudah diubah (di web atau di spreadsheet) sejak Anda membukanya. Muat ulang halaman, lalu ulangi perubahan Anda.');
    }
    const row = values[found.row - 1].slice();
    while (row.length < lastCol) row.push('');
    row[1] = clean.year;
    row[2] = sheetSafe_(clean.name);
    applyArchiveModules_(row, modulesDef, clean.modules);
    sh.getRange(found.row, 1, 1, lastCol).setValues([row]);
    logActivity_(user, 'Update Arsip', '', '', clean.name, archiveSummary_(clean.modules) || 'tanpa modul');
    return archiveProjectFromRow_(modulesDef, row, found.row);
  }

  // Baru: nomor = nomor terbesar + 1, ditaruh di baris paling bawah.
  let maxNo = 0;
  parsed.projects.forEach(function (p) { const n = Number(p.no); if (n > maxNo) maxNo = n; });
  const row = [];
  for (let i = 0; i < lastCol; i++) row.push('');
  row[0] = maxNo + 1;
  row[1] = clean.year;
  row[2] = sheetSafe_(clean.name);
  modulesDef.forEach(function (d) { if (d.key) row[d.cols.on] = false; });
  applyArchiveModules_(row, modulesDef, clean.modules);
  const target = sh.getLastRow() + 1;
  sh.getRange(target, 1, 1, lastCol).setValues([row]);
  logActivity_(user, 'Tambah Arsip', '', '', clean.name, clean.year + ' | ' + (archiveSummary_(clean.modules) || 'tanpa modul'));
  return archiveProjectFromRow_(modulesDef, row, target);
}

function deleteArchiveProject_(payload) {
  const id = cleanText_(payload.id);
  if (!id) throw new Error('ID arsip wajib diisi.');
  const sh = getArchiveSheet_();
  const parsed = parseArchiveValues_(readArchiveValues_(sh).values);
  const cur = parsed.projects.filter(function (p) { return p.id === id; });
  if (cur.length === 0) throw new Error('Project arsip tidak ditemukan atau sudah dihapus.');
  if (cur.length > 1) throw new Error('Nomor arsip dobel di sheet (kolom No). Perbaiki dulu di spreadsheet.');
  const found = cur[0];
  sh.deleteRow(found.row);
  logActivity_(payload.user, 'Hapus Arsip', '', '', found.name,
    'Snapshot data sebelum dihapus: ' + clip_(JSON.stringify(found), 45000));
  return { deleted: true, id: id };
}
