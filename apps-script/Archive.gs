/**
 * BENING HUB — ARSIP PROJECT SELESAI + TEKNOLOGI PROJECT AKTIF (baca & tulis, dua arah dengan spreadsheet)
 * ---------------------------------------------------
 * FILE TAMBAHAN di project Apps Script Tracker yang SAMA dengan Code.gs
 * (di editor: klik "+" di samping "Files" > Script > beri nama "Archive").
 *
 * Mengelola dua tempat yang berformat sama (grid modul teknologi):
 *   1. Tab "[ARSIP] FINISHED PROJECT" (project selesai).
 *   2. Grid kolom AA-CT di tab "Project Tracker" (teknologi project yang sedang berjalan; lihat bagian
 *      "TEKNOLOGI PROJECT AKTIF" di bawah). Sejak Code.gs v2.8 inilah satu-satunya tempat teknologi project aktif.
 * Edit di web langsung tertulis ke sheet, dan edit manual di sheet langsung terbaca web (tidak ada cache).
 * Kode ini membaca grid PER POSISI KOLOM, jadi urutan kolom dan dua baris judul tidak boleh digeser.
 *
 * Format tab: baris 1 = nama modul (sel judul digabung ke samping; sel lanjutannya kosong), baris 2 =
 * sub-judul ("Ada", "Kapasitas", "Satuan", "Detail Spesifikasi"; dipakai juga sebagai baris filter),
 * data mulai baris 3. Kolom A-C = No, Tahun (tahun project selesai), Nama Project. Kolom "Ada" berupa
 * kotak centang. Format ini SAMA dengan grid "Spesifikasi Teknologi" di tab Project Tracker (kolom AA-CT).
 * Modul baru: tambah kolomnya di sheet (nama di baris 1, sub-judul di baris 2) lalu muat ulang web;
 * modul yang namanya belum dikenal tetap terbaca dengan kunci otomatis.
 *
 * Tidak bentrok antar-penyunting: setiap baris punya `rev` (sidik jari isi baris). Simpan dari web
 * ditolak kalau baris itu berubah sejak dimuat (mis. diedit manual di sheet), supaya tidak saling menimpa.
 *
 * AGAR TERPAKAI: doGet/doPost di Code.gs harus mengenali 5 aksi:
 *   GET  archive                 -> getArchive_()
 *   POST saveArchiveProject      -> saveArchiveProject_(payload)
 *   POST deleteArchiveProject    -> deleteArchiveProject_(payload)
 *   GET  tech                    -> getProjectTech_(projectId)      (Code.gs v2.8)
 *   POST saveProjectTech         -> saveProjectTech_(payload)       (Code.gs v2.8)
 * Setelah ditempel: Deploy > Manage deployments > ikon pensil > Version: New version > Deploy.
 */

const SHEET_ARCHIVE = '[ARSIP] FINISHED PROJECT';
const ARCHIVE_MAX_MODULES = 40;
const ARCHIVE_UNITS = ['MPH', 'LPH', 'LITER', 'MPD', 'LPD'];

// Kunci tetap untuk modul yang sudah dikenal (urutan alur pengolahan air ada di sisi web).
// Harus sama dengan FLOW_STEPS di lib/techflow.js. Keterangan dalam kurung pada judul diabaikan saat mencocokkan
// (mis. "Dosing Pump Sodium Hypochlorite (NaOH)" dikenali sebagai 'dosing pump sodium hypochlorite').
const ARCHIVE_MODULE_KEYS = {
  'feed raw water pump': 'feed_pump',
  'raw / intermediate water tank': 'raw_tank',
  'dosing pump sodium hypochlorite': 'dosing_hypo',
  'dosing pump pac': 'dosing_pac',
  'dosing pump soda ash': 'dosing_soda',
  'dosing pump polimer': 'dosing_polimer',
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
  const norm = cleanText_(label).toLowerCase().replace(/\s+/g, ' ');
  if (ARCHIVE_MODULE_KEYS[norm]) return ARCHIVE_MODULE_KEYS[norm];
  const bare = norm.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  if (bare !== norm && ARCHIVE_MODULE_KEYS[bare]) return ARCHIVE_MODULE_KEYS[bare];
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

// Letak kolom tiap modul dari 2 baris judul. Fungsi MURNI. Mulai dari kolom `from` (indeks 0; bawaan 3 = kolom D tab
// arsip) sampai akhir `head`, jadi untuk grid di Project Tracker `head`/`sub` dipotong dulu tepat sebelum kolom Project ID.
function archiveSchemaFromHeaders_(head, sub, from) {
  const modules = [];
  for (let c = (from === undefined ? 3 : from); c < head.length; c++) {
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

// Modul yang dicentang di satu baris -> [{ key, label, cap, unit, detail }]. Dipakai arsip dan grid Project Tracker.
function archiveModulesFromRow_(modules, row) {
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
  return mods;
}

// Daftar modul yang dikenal sheet -> bentuk yang dikirim ke web: [{ key, label, hasCap, hasUnit, hasDetail }].
function archiveSchemaOf_(modules) {
  return modules.filter(function (m) { return m.key; }).map(function (m) {
    return { key: m.key, label: m.label, hasCap: m.cols.cap > -1, hasUnit: m.cols.unit > -1, hasDetail: m.cols.detail > -1 };
  });
}

function archiveProjectFromRow_(modules, row, rowNumber) {
  const no = cleanText_(row[0]);
  return {
    id: 'arc_' + (no || String(rowNumber)),
    no: no,
    row: rowNumber,
    rev: archiveRev_(row),
    year: cleanText_(row[1]),
    name: cleanText_(row[2]),
    modules: archiveModulesFromRow_(modules, row)
  };
}

// Fungsi MURNI (tidak memakai API Apps Script) supaya mudah diuji: values = array 2 dimensi dari sheet.
// Hasil: { schema: [{key,label,hasCap,hasUnit,hasDetail}], projects: [...] }
function parseArchiveValues_(values) {
  if (!values || values.length < 2) return { schema: [], projects: [] };
  const modules = archiveSchemaFromHeaders_(values[0], values[1]);
  const schema = archiveSchemaOf_(modules);
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

// Nomor baris (1-based) untuk project baru: tepat di bawah baris terakhir yang punya Nama Project. Sengaja TIDAK
// memakai getLastRow(): kotak centang "Ada" di baris kosong bisa tertinggal berisi FALSE setelah diklik dua kali,
// dan itu membuat getLastRow() lebih besar sehingga project baru jatuh jauh di bawah tabel. Fungsi MURNI.
function archiveNextRow_(values) {
  let last = 2;
  for (let r = 2; r < (values || []).length; r++) {
    if (cleanText_(values[r][2])) last = r + 1;
  }
  return last + 1;
}

// Semua project arsip. Kalau tab belum ada, hasilnya kosong (bukan error).
function getArchive_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ARCHIVE);
  if (!sh) return { schema: [], projects: [] };
  return parseArchiveValues_(readArchiveValues_(sh).values);
}

// Rapikan daftar modul dari web. Hanya modul yang kolomnya ada di sheet (schema) yang diterima.
function sanitizeArchiveModules_(list, schema) {
  if (!Array.isArray(list)) throw new Error('Daftar modul tidak valid.');
  if (list.length > ARCHIVE_MAX_MODULES) throw new Error('Terlalu banyak modul.');

  const byKey = {};
  schema.forEach(function (m) { byKey[m.key] = m; });
  const seen = {};
  const modules = [];
  list.forEach(function (m) {
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
  return modules;
}

// Rapikan isian dari web. Hanya modul yang kolomnya ada di sheet yang diterima.
function sanitizeArchiveProject_(p, schema) {
  const name = clip_(cleanText_(p.name), 200);
  if (!name) throw new Error('Nama project wajib diisi.');
  const year = cleanText_(p.year);
  if (!/^\d{4}$/.test(year)) throw new Error('Tahun harus 4 angka, mis. 2026.');
  return { name: name, year: year, modules: sanitizeArchiveModules_(p.modules, schema) };
}

// Isi kapasitas, satuan, dan detail satu modul di satu baris (m = modul terpilih, atau undefined = dikosongkan).
function setArchiveModuleCells_(row, d, m) {
  if (d.cols.cap > -1) row[d.cols.cap] = m && m.cap !== '' ? (/^\d+(\.\d+)?$/.test(m.cap) ? Number(m.cap) : sheetSafe_(m.cap)) : '';
  if (d.cols.unit > -1) row[d.cols.unit] = m ? sheetSafe_(m.unit) : '';
  if (d.cols.detail > -1) row[d.cols.detail] = m ? sheetSafe_(m.detail) : '';
}

// Tulis nilai modul ke satu baris (array sel). Modul yang tidak dipilih dimatikan dan dikosongkan.
function applyArchiveModules_(row, modulesDef, chosen) {
  const byKey = {};
  chosen.forEach(function (m) { byKey[m.key] = m; });
  modulesDef.forEach(function (d) {
    if (!d.key) return;
    const m = byKey[d.key];
    row[d.cols.on] = !!m;
    setArchiveModuleCells_(row, d, m);
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

  // Baru: nomor = nomor terbesar + 1, ditaruh tepat di bawah project terakhir.
  let maxNo = 0;
  parsed.projects.forEach(function (p) { const n = Number(p.no); if (n > maxNo) maxNo = n; });
  const row = [];
  for (let i = 0; i < lastCol; i++) row.push('');
  row[0] = maxNo + 1;
  row[1] = clean.year;
  row[2] = sheetSafe_(clean.name);
  modulesDef.forEach(function (d) { if (d.key) row[d.cols.on] = false; });
  applyArchiveModules_(row, modulesDef, clean.modules);
  const target = archiveNextRow_(values);
  if (target > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), target - sh.getMaxRows());
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


// ==================================================================
// TEKNOLOGI PROJECT AKTIF: grid di tab Project Tracker
// ==================================================================
// Kolom "Ada / Kapasitas / Satuan / Detail Spesifikasi" per modul (AA-CT) di tab Project Tracker, formatnya sama
// dengan tab arsip, jadi memakai fungsi yang sama di atas. Bedanya: satu baris = satu project yang dicari lewat kolom
// Project ID, dan HANYA sel grid yang ditulis. Kolom lain (termasuk yang berumus) dan sel berumus di dalam grid tidak
// disentuh. Sejak Code.gs v2.8 grid ini satu-satunya tempat teknologi project aktif (dulu tersimpan di tab Project
// Specs sebagai kunci tech_*). Web membaca/menulis lewat:
//   GET  tech            -> getProjectTech_(projectId)               -> { projectId, row, rev, modules: [...] }
//   POST saveProjectTech -> saveProjectTech_({ projectId, modules, baseRev, user })   (hasil sama dengan GET)

// Kunci modul yang dikenal web (nilai ARCHIVE_MODULE_KEYS). Modul dengan kunci otomatis "x_..." (kolom baru di sheet
// yang belum dikenal web) terbaca tetapi TIDAK PERNAH diubah atau dikosongkan saat web menyimpan.
function isKnownArchiveKey_(key) {
  for (const label in ARCHIVE_MODULE_KEYS) {
    if (ARCHIVE_MODULE_KEYS[label] === key) return true;
  }
  return false;
}

// Nilai sel -> teks pembanding (kosong = ''; kotak centang = TRUE/FALSE), untuk mendeteksi sel yang benar-benar berubah.
function techCellKey_(v) {
  if (v === null || v === undefined) return '';
  if (v === true) return 'TRUE';
  if (v === false) return 'FALSE';
  return String(v);
}

// Letak grid dari 2 baris judul. Grid dimulai di kolom pertama yang sub-judulnya persis "Ada" (dan judul modulnya
// terisi) dan berakhir tepat sebelum kolom "Project ID". Fungsi MURNI. Hasil null kalau grid tidak ditemukan
// (mis. tab Project Tracker masih berformat lama tanpa dua baris judul).
function trackerGridFromHeaders_(head, sub) {
  let pid = -1;
  for (let c = 0; c < head.length; c++) {
    if (cleanText_(head[c]) === ID_HEADER) { pid = c; break; }
  }
  if (pid === -1) return null;
  let start = -1;
  for (let c = 0; c < pid; c++) {
    if (cleanText_(sub[c]).toLowerCase() === 'ada' && cleanText_(head[c])) { start = c; break; }
  }
  if (start === -1) return null;
  const modules = archiveSchemaFromHeaders_(head.slice(0, pid), sub.slice(0, pid), start);
  if (!modules.some(function (m) { return m.key; })) return null;
  return { start: start, end: pid, pidCol: pid, modules: modules };
}

// Teknologi satu project dari satu baris. `rev` = sidik jari sel grid saja (perubahan kolom lain tidak dihitung).
function trackerTechFromRow_(grid, row, rowNumber, id) {
  return {
    projectId: id,
    row: rowNumber,
    rev: archiveRev_(row.slice(grid.start, grid.end)),
    modules: archiveModulesFromRow_(grid.modules, row)
  };
}

// Baca tab Project Tracker sekali: { sh, values, grid, poCol, nameCol }.
function readTrackerGrid_() {
  const sh = getSheet_(SHEET_PROJECTS);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) throw new Error('Baris judul tab Project Tracker belum lengkap (baris 1 dan 2).');
  const grid = trackerGridFromHeaders_(values[0], values[1]);
  if (!grid) {
    throw new Error('Grid teknologi tidak ditemukan di tab Project Tracker (kolom "Ada / Kapasitas / Satuan / Detail Spesifikasi" sebelum kolom Project ID).');
  }
  const headers = values[0].map(function (h) { return cleanText_(h); });
  return { sh: sh, values: values, grid: grid, poCol: headers.indexOf('PO Number'), nameCol: headers.indexOf('Project Name') };
}

// Indeks (0) baris project di `values`. Data mulai baris 3, baris 2 adalah sub-judul.
function findTrackerRowById_(values, grid, projectId) {
  const id = cleanText_(projectId);
  if (!id) throw new Error('ID project wajib diisi.');
  const hits = [];
  for (let r = 2; r < values.length; r++) {
    if (cleanText_(values[r][grid.pidCol]) === id) hits.push(r);
  }
  if (hits.length === 0) throw new Error('Project tidak ditemukan. Mungkin sudah dihapus. Muat ulang halaman.');
  if (hits.length > 1) throw new Error('Project ID dobel di tab Project Tracker. Perbaiki dulu di spreadsheet.');
  return hits[0];
}

function getProjectTech_(projectId) {
  const ctx = readTrackerGrid_();
  const r = findTrackerRowById_(ctx.values, ctx.grid, projectId);
  return trackerTechFromRow_(ctx.grid, ctx.values[r], r + 1, cleanText_(projectId));
}

// Ringkasan teknologi SEMUA project untuk daftar project (GET projects): { [projectId]: [{ key, cap, unit }] }.
// Tanpa "detail" (teks panjang) supaya daftar tetap ringan; detail lengkap lewat getProjectTech_. Hasil null kalau
// grid tidak ditemukan (tab masih berformat lama) -> web memakai mode lama. Tidak pernah melempar galat.
function getTrackerTechIndex_() {
  try {
    const ctx = readTrackerGrid_();
    const index = {};
    for (let r = 2; r < ctx.values.length; r++) {
      const id = cleanText_(ctx.values[r][ctx.grid.pidCol]);
      if (!id || index[id]) continue;
      index[id] = archiveModulesFromRow_(ctx.grid.modules, ctx.values[r]).map(function (m) {
        return { key: m.key, cap: m.cap, unit: m.unit };
      });
    }
    return index;
  } catch (e) {
    return null;
  }
}

// Seperti applyArchiveModules_, tetapi hati-hati terhadap sel yang dipegang pengguna di sheet:
//  - modul yang belum dikenal web (kunci "x_...") tidak disentuh;
//  - modul yang tidak dipilih hanya dimatikan dan dikosongkan kalau sebelumnya aktif (sel yang tidak pernah
//    dicentang dibiarkan apa adanya).
function applyTechModules_(row, modulesDef, chosen) {
  const byKey = {};
  chosen.forEach(function (m) { byKey[m.key] = m; });
  modulesDef.forEach(function (d) {
    if (!d.key || !isKnownArchiveKey_(d.key)) return;
    const m = byKey[d.key];
    if (!m && !archiveIsOn_(row[d.cols.on])) return;
    row[d.cols.on] = !!m;
    setArchiveModuleCells_(row, d, m);
  });
}

function saveProjectTech_(payload) {
  const user = payload.user || 'Tidak diketahui';
  const id = cleanText_(payload.projectId);
  const ctx = readTrackerGrid_();
  const r = findTrackerRowById_(ctx.values, ctx.grid, id);
  const rowNumber = r + 1;
  const row = ctx.values[r].slice();
  const before = trackerTechFromRow_(ctx.grid, row, rowNumber, id);
  if (cleanText_(payload.baseRev) !== before.rev) {
    throw new Error('Teknologi project ini sudah diubah (di web atau di spreadsheet) sejak Anda membukanya. Muat ulang halaman, lalu ulangi perubahan Anda.');
  }
  const schema = archiveSchemaOf_(ctx.grid.modules).filter(function (m) { return isKnownArchiveKey_(m.key); });
  const chosen = sanitizeArchiveModules_(payload.modules, schema);

  const next = row.slice();
  applyTechModules_(next, ctx.grid.modules, chosen);

  // Tulis hanya sel yang berubah; sel berumus di dalam grid dilewati.
  const formulas = ctx.sh.getRange(rowNumber, ctx.grid.start + 1, 1, ctx.grid.end - ctx.grid.start).getFormulas()[0];
  const updates = {};
  for (let c = ctx.grid.start; c < ctx.grid.end; c++) {
    if (formulas[c - ctx.grid.start]) continue;
    if (techCellKey_(next[c]) !== techCellKey_(row[c])) updates[c] = next[c];
  }
  if (Object.keys(updates).length === 0) return before;

  writeCells_(ctx.sh, rowNumber, updates);
  // Baca ulang dari sheet: rev dan isi persis seperti yang akan dibaca penyunting berikutnya.
  const after = getProjectTech_(id);
  invalidateProjectsCache_(); // daftar project membawa ringkasan teknologi
  logActivity_(user, 'Update Teknologi', id,
    ctx.poCol > -1 ? cleanText_(row[ctx.poCol]) : '', ctx.nameCol > -1 ? cleanText_(row[ctx.nameCol]) : '',
    'Sebelumnya: ' + (archiveSummary_(before.modules) || 'kosong') + ' | Sekarang: ' + (archiveSummary_(after.modules) || 'kosong'));
  return after;
}
