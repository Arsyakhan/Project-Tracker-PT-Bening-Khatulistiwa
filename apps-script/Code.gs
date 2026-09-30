/**
 * PT BENING KHATULISTIWA — BENING HUB API  (v2.2)
 * ---------------------------------------------------
 * Backend untuk aplikasi web "Bening Hub". Paste seluruh file ini ke:
 * Extensions > Apps Script (dibuka DARI spreadsheet
 * "Project Tracker_PT Bening Khatulistiwa", jadi otomatis terikat ke sheet-nya).
 *
 * YANG BARU DI v2.2:
 *   - 4 kolom baru di sheet Project Tracker (dibuat OTOMATIS, tidak perlu ditambah manual):
 *       "Lokasi Plant", "Alamat", "Kontak Owner", "Sistem Terpasang"
 *     Dipakai untuk mengisi otomatis form Commissioning & Hand Over.
 *   - Semua fitur v2.1 (Comments, Activity Log, Document Log, cache) tetap sama.
 *
 * SETUP (sekali saja):
 *   1. Save, lalu pilih fungsi `setup` di dropdown > klik Run > izinkan akses.
 *      - membuat API_TOKEN rahasia (disimpan di Script Properties, BUKAN di kode)
 *      - menambah kolom "Project ID" + 4 kolom baru di sheet Project Tracker & Checklist
 *      - membuat baris checklist untuk project yang belum punya
 *      - membuat tab "Activity Log" dan "Document Log" kalau belum ada
 *   2. Buka View > Execution log, copy API_TOKEN yang tampil.
 *      Tempel ke Vercel sebagai GAS_API_TOKEN.
 *   3. (Opsional) Project Settings > Script Properties > tambah
 *      ADMIN_NOTIFICATION_EMAILS = email1@x.com,email2@x.com
 *      (penerima email notifikasi saat ada project dihapus)
 *   4. Deploy > New deployment > Web app
 *        Execute as: Me | Who has access: Anyone
 *      Copy URL-nya ke Vercel sebagai GAS_API_URL.
 *
 * MENGUPDATE KODE (setelah paste versi baru): Deploy > Manage deployments >
 * ikon pensil > Version: "New version" > Deploy. URL web app tetap sama.
 * Tanpa langkah ini, web app masih menjalankan kode lama.
 *
 * KEAMANAN: semua request WAJIB membawa token. Tanpa token yang benar, API
 * hanya membalas "Unauthorized". Token ini hanya dipegang server Next.js
 * (API route /api/gas) — tidak pernah dikirim ke browser.
 *
 * Setiap baca/tulis terjadi langsung di sheet asli, jadi edit manual di
 * spreadsheet dan edit lewat website tetap sinkron dua arah — dengan catatan:
 * hasil baca di-cache 30 detik (lihat bagian Cache di bawah), jadi edit manual
 * langsung di spreadsheet butuh sampai 30 detik untuk muncul di web. Edit lewat
 * web selalu langsung terlihat karena cache otomatis dihapus tiap ada yang disimpan.
 */


// ---- CONFIG: sesuaikan kalau nama tab kamu berbeda ----
const SHEET_PROJECTS = 'Project Tracker';
const SHEET_CHECKLIST = 'Engineering Deliverables Checklist';
const SHEET_ACTIVITY_LOG = 'Activity Log'; // dibuat otomatis kalau belum ada
const SHEET_COMMENTS = 'Comments';         // dibuat otomatis kalau belum ada
const SHEET_DOCUMENTS = 'Document Log';    // dibuat otomatis kalau belum ada (riwayat dokumen yang di-generate)
const COMMENT_MAX_LENGTH = 2000;


const ID_HEADER = 'Project ID';       // kolom kunci permanen (jangan diedit manual)
const ENFORCE_UNIQUE_PO = true;       // true = PO Number tidak boleh kembar antar project
const LOCK_WAIT_MS = 20000;
const ACTIVITY_LIMIT = 300;
const ACTIVITY_LOG_COLUMNS = ['Timestamp', 'User', 'Action', 'PO Number', 'Project Name', 'Detail', 'Project ID'];


// Kolom tambahan di sheet Project Tracker (dibuat otomatis kalau belum ada).
const COL_LOKASI = 'Lokasi Plant';
const COL_ALAMAT = 'Alamat';
const COL_KONTAK = 'Kontak Owner';
const COL_SISTEM = 'Sistem Terpasang';
const PROJECT_EXTRA_COLUMNS = [COL_LOKASI, COL_ALAMAT, COL_KONTAK, COL_SISTEM];

// Kunci sistem terpasang yang valid (urutan ini dipakai saat menyimpan).
// Harus sama dengan lib/systems.js di frontend.
const SYSTEM_KEYS = [
  'raw_water', 'clarifier', 'dosing', 'birm', 'mmf', 'acf', 'softener', 'uf', 'ro',
  'mixedbed', 'int_tank', 'panel', 'ro_large', 'recycle'
];


// Riwayat dokumen (Commissioning Report / Handover Report) yang dibuat lewat Generator Dokumen.
const DOCUMENT_LOG_COLUMNS = ['Timestamp', 'User', 'Type', 'PO Number', 'Project Name', 'File Name', 'Document URL', 'Project ID'];
const DOCUMENT_TYPES = ['commissioning', 'handover'];
const DOCUMENT_LIMIT = 200;


// Cache hasil getProjects_() supaya navigasi antar halaman tidak selalu membaca ulang
// seluruh sheet. Dihapus otomatis setiap ada perubahan (add/update/checklist/delete),
// jadi data yang dilihat setelah menyimpan selalu segar; TTL cuma jaring pengaman.
// (v2: bentuk data berubah karena ada field baru, jadi kunci cache diganti.)
const PROJECTS_CACHE_KEY = 'projects_v2';
const PROJECTS_CACHE_TTL_SECONDS = 30;


// ---- Stage → progress mapping (sama dengan tabel Reference) ----
const STAGE_WEIGHTS = {
  'PO': 5,
  'SOS': 10,
  'BOM, PID, EWD, GAD': 25,
  'Review & Approval': 30,
  'Procurement of Material': 45,
  'Collecting Material / Inspection': 55,
  'Fabrication': 70,
  'Delivery': 90,
  'Installation': 95,
  'Commissioning': 97,
  'Preparation Manual Book': 98,
  'Hand Over and Finished': 100
};
const STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Completed'];
const PRIORITIES = ['Low', 'Medium', 'High'];
const CHECKLIST_ITEMS = [
  'BOM (Bill of Materials)',
  'P&ID (Drawings)',
  'EWD (Electrical Wiring)',
  'GAD (General Arrangement)',
  'Commissioning Report',
  'Manual Book',
  'Handover Report'
];
const CHECKLIST_STATUSES = ['Not Started', 'Drafting', 'Under Review', 'Completed', 'N/A'];
const CHECKLIST_WEIGHTS = { 'Not Started': 0, 'Drafting': 30, 'Under Review': 70, 'Completed': 100 };


// Field dari website -> nama kolom di sheet Project Tracker
const TEXT_FIELDS = [
  ['projectName', 'Project Name'],
  ['client', 'Client'],
  ['technology', 'Technology/Capacity'],
  ['pic', 'PIC'],
  ['remarks', 'Remarks'],
  ['deskripsiPesanan', 'Deskripsi Pesanan'],
  ['spesifikasiTeknologi', 'Spesifikasi Teknologi'],
  ['lokasiPlant', COL_LOKASI],
  ['alamat', COL_ALAMAT],
  ['kontakOwner', COL_KONTAK],
  ['sistemTerpasang', COL_SISTEM]
];
const DATE_FIELDS = [
  ['tanggalPO', 'Tanggal PO'],
  ['tanggalDP', 'Tanggal DP'],
  ['targetFinishDate', 'Target Finish Date']
];


// ------------------------------------------------------------------
// Lock (tidak re-entrant di Apps Script, jadi kita bungkus sendiri)
// ------------------------------------------------------------------
let LOCK_HELD_ = false;


function withLock_(fn) {
  if (LOCK_HELD_) return fn();
  const lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_MS);
  LOCK_HELD_ = true;
  try {
    return fn();
  } finally {
    LOCK_HELD_ = false;
    lock.releaseLock();
  }
}


// ------------------------------------------------------------------
// Auth (token rahasia di Script Properties)
// ------------------------------------------------------------------
function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}


function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}


function requireToken_(token) {
  const expected = getProp_('API_TOKEN');
  if (!expected || expected.length < 24) {
    throw new Error('API_TOKEN belum diset. Jalankan fungsi setup() sekali dari editor Apps Script.');
  }
  if (!safeEqual_(String(token || ''), expected)) throw new Error('Unauthorized');
}


function generateToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}


// ------------------------------------------------------------------
// HTTP entry points
// ------------------------------------------------------------------
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    requireToken_(params.token);
    const action = params.action || 'projects';
    let data;
    if (action === 'projects') data = getProjectsCached_();
    else if (action === 'dashboard') data = computeDashboard_(getProjectsCached_());
    else if (action === 'meta') data = getMeta_();
    else if (action === 'activityLog') data = getActivityLog_();
    else if (action === 'comments') data = getComments_(params.projectId);
    else if (action === 'documents') data = getDocuments_(params.projectId);
    else throw new Error('Unknown action: ' + action);
    return jsonOut_({ ok: true, data: data });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  }
}


function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    requireToken_(body.token);
    const action = body.action;
    const payload = body.payload || {};
    const data = withLock_(function () {
      if (action === 'addProject') return addProject_(payload);
      if (action === 'updateProject') return updateProject_(payload);
      if (action === 'updateChecklist') return updateChecklist_(payload);
      if (action === 'deleteProject') return deleteProject_(payload);
      if (action === 'addComment') return addComment_(payload);
      if (action === 'logDocument') return logDocument_(payload);
      throw new Error('Unknown action: ' + action);
    });
    return jsonOut_({ ok: true, data: data });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  }
}


function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


function getMeta_() {
  return {
    stages: Object.keys(STAGE_WEIGHTS),
    stageWeights: STAGE_WEIGHTS,
    statuses: STATUSES,
    priorities: PRIORITIES,
    checklistItems: CHECKLIST_ITEMS,
    checklistStatuses: CHECKLIST_STATUSES
  };
}


// ------------------------------------------------------------------
// Cache (mempercepat baca berulang, dihapus otomatis tiap ada tulis)
// ------------------------------------------------------------------
function getProjectsCached_() {
  const cache = CacheService.getScriptCache();
  try {
    const cached = cache.get(PROJECTS_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    // Cache rusak/tidak terbaca -> abaikan, baca fresh dari sheet di bawah.
  }
  const fresh = getProjects_();
  try {
    cache.put(PROJECTS_CACHE_KEY, JSON.stringify(fresh), PROJECTS_CACHE_TTL_SECONDS);
  } catch (e) {
    // Data > 100KB (limit CacheService) atau CacheService lagi bermasalah:
    // tidak fatal, cuma berarti request berikutnya baca fresh lagi.
  }
  return fresh;
}


function invalidateProjectsCache_() {
  try { CacheService.getScriptCache().remove(PROJECTS_CACHE_KEY); } catch (e) {}
}


// ------------------------------------------------------------------
// Setup (jalankan manual sekali dari editor)
// ------------------------------------------------------------------
function setup() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty('API_TOKEN');
  if (!token) {
    token = generateToken_();
    props.setProperty('API_TOKEN', token);
    Logger.log('API_TOKEN BARU (copy ke Vercel sebagai GAS_API_TOKEN):\n' + token);
  } else {
    Logger.log('API_TOKEN sudah ada, tidak diubah. (Lihat di Project Settings > Script Properties)');
  }


  const result = withLock_(function () {
    const r = migrateSchema_();
    getOrCreateActivityLogSheet_();
    getOrCreateDocumentLogSheet_();
    return r;
  });
  Logger.log('Migrasi selesai: ' + JSON.stringify(result));


  if (!getProp_('ADMIN_NOTIFICATION_EMAILS')) {
    Logger.log('Catatan: ADMIN_NOTIFICATION_EMAILS belum diset di Script Properties, jadi email notifikasi hapus project tidak akan dikirim.');
  }
}


// Buat token baru (misalnya kalau token lama bocor). Setelah ini, update
// GAS_API_TOKEN di Vercel lalu redeploy frontend.
function rotateApiToken() {
  const token = generateToken_();
  PropertiesService.getScriptProperties().setProperty('API_TOKEN', token);
  Logger.log('API_TOKEN BARU (copy ke Vercel sebagai GAS_API_TOKEN):\n' + token);
}


// ------------------------------------------------------------------
// Sheet <-> object helpers
// ------------------------------------------------------------------
function getSheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name);
  return sh;
}


// Baca seluruh sheet SEKALI: { sheet, headers, rows[] } (rows berisi object per baris + _row)
function readSheet_(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = (values[0] || []).map(function (h) { return String(h).trim(); });
  const poIdx = headers.indexOf('PO Number');
  const nameIdx = headers.indexOf('Project Name');
  const idIdx = headers.indexOf(ID_HEADER);
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const hasKey = (poIdx > -1 && row[poIdx]) || (nameIdx > -1 && row[nameIdx]) || (idIdx > -1 && row[idIdx]);
    if (!hasKey) continue; // baris kosong / baris template
    const obj = {};
    headers.forEach(function (h, idx) { obj[h] = row[idx]; });
    obj._row = i + 1;
    rows.push(obj);
  }
  return { sheet: sheet, headers: headers, rows: rows };
}


function cleanText_(v) {
  return String(v === null || v === undefined ? '' : v).trim();
}


function clip_(s, n) {
  s = String(s);
  return s.length > n ? s.substring(0, n) + '…' : s;
}


// Teks dari user yang ditulis ke sheet: kalau diawali = + - @ diberi tanda ' supaya
// tidak dieksekusi sebagai rumus spreadsheet.
function sheetSafe_(v) {
  const s = cleanText_(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}


function normalizePO_(po) {
  return cleanText_(po).toUpperCase().replace(/\s+/g, '').replace(/\/+/g, '/');
}


function toPercentNumber_(val) {
  if (val === '' || val === null || val === undefined) return 0;
  if (typeof val === 'number') return val <= 1 ? Math.round(val * 100) : Math.round(val);
  const n = parseFloat(String(val).replace('%', '').trim());
  return isNaN(n) ? 0 : n;
}


function formatDate_(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(val);
}


// 'yyyy-MM-dd' -> Date (jam 00:00 zona waktu script). Kosong -> ''.
function parseDateInput_(s) {
  if (s === null || s === undefined || s === '') return '';
  if (s instanceof Date) return s;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (!m) return String(s);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}


function computeDaysRemaining_(deliveryDateVal) {
  if (!deliveryDateVal) return '';
  const deadline = new Date(deliveryDateVal);
  if (isNaN(deadline.getTime())) return '';
  const tz = Session.getScriptTimeZone();
  // Bandingkan tanggal kalender saja (bukan jam-menit) supaya hasilnya bulat.
  const deadlineDay = new Date(Utilities.formatDate(deadline, tz, 'yyyy-MM-dd'));
  const todayDay = new Date(Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'));
  return Math.round((deadlineDay - todayDay) / (1000 * 60 * 60 * 24));
}


// Sistem terpasang: terima array atau teks "a,b,c" -> array kunci valid (urutan kanonik).
function parseSystems_(value) {
  const raw = Array.isArray(value) ? value : String(value === null || value === undefined ? '' : value).split(',');
  const set = {};
  raw.forEach(function (v) { set[String(v).trim()] = true; });
  return SYSTEM_KEYS.filter(function (k) { return set[k]; });
}

// -> teks "a,b,c" untuk disimpan di sel sheet.
function serializeSystems_(value) {
  return parseSystems_(value).join(',');
}


// Pastikan sebuah header ada; kalau belum, tambahkan di kolom paling kanan. Return nomor kolom (1-based).
function ensureColumn_(sheet, name) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  const idx = headers.indexOf(name);
  if (idx > -1) return idx + 1;
  const col = lastCol + 1;
  if (col > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), col - sheet.getMaxColumns());
  sheet.getRange(1, col).setValue(name);
  return col;
}


// Tulis beberapa sel di satu baris. Sel yang berdampingan digabung jadi satu setValues.
// updates = { indexKolom(0-based): nilai }
function writeCells_(sheet, rowIndex, updates) {
  const cols = Object.keys(updates).map(Number).sort(function (a, b) { return a - b; });
  let i = 0;
  while (i < cols.length) {
    let j = i;
    while (j + 1 < cols.length && cols[j + 1] === cols[j] + 1) j++;
    const values = [cols.slice(i, j + 1).map(function (c) { return updates[c]; })];
    sheet.getRange(rowIndex, cols[i] + 1, 1, values[0].length).setValues(values);
    i = j + 1;
  }
}


// Tulis nilai ID ke kolom tertentu untuk beberapa baris dengan 1x baca + 1x tulis.
function writeIdCells_(sheet, col, writes) {
  if (!writes.length) return;
  const lastRow = sheet.getLastRow();
  const range = sheet.getRange(2, col, lastRow - 1, 1);
  const vals = range.getValues();
  writes.forEach(function (w) { vals[w.row - 2][0] = w.id; });
  range.setValues(vals);
}


// Cari baris berdasarkan Project ID. Return { rowIndex, headers } atau null.
function findRowById_(sheet, id) {
  if (!id) return null;
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return null;
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  const col = headers.indexOf(ID_HEADER);
  if (col === -1) return null;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const ids = sheet.getRange(2, col + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(id).trim()) return { rowIndex: i + 2, headers: headers };
  }
  return null;
}


function generateProjectId_(used) {
  let id;
  do {
    id = 'prj_' + Utilities.getUuid().replace(/-/g, '').substring(0, 12);
  } while (used && used[id]);
  if (used) used[id] = true;
  return id;
}


// ------------------------------------------------------------------
// Skema: Project ID + kolom tambahan + baris checklist (migrasi otomatis & idempotent)
// ------------------------------------------------------------------
function schemaNeedsMigration_(p, c) {
  if (p.headers.indexOf(ID_HEADER) === -1 || c.headers.indexOf(ID_HEADER) === -1) return true;
  for (let x = 0; x < PROJECT_EXTRA_COLUMNS.length; x++) {
    if (p.headers.indexOf(PROJECT_EXTRA_COLUMNS[x]) === -1) return true; // kolom baru v2.2 belum ada
  }
  const seen = {};
  for (let i = 0; i < p.rows.length; i++) {
    const id = cleanText_(p.rows[i][ID_HEADER]);
    if (!id || seen[id]) return true;
    seen[id] = true;
  }
  const checkIds = {};
  c.rows.forEach(function (r) {
    const id = cleanText_(r[ID_HEADER]);
    if (id) checkIds[id] = true;
  });
  for (let k = 0; k < p.rows.length; k++) {
    if (!checkIds[cleanText_(p.rows[k][ID_HEADER])]) return true; // project belum punya baris checklist
  }
  return false;
}


function findUnclaimed_(list, claimed, predicate) {
  for (let i = 0; i < list.length; i++) {
    if (!claimed[list[i]._row] && predicate(list[i])) return list[i];
  }
  return null;
}


function appendChecklistRow_(checkSheet, id, po, name, client) {
  const headers = checkSheet.getRange(1, 1, 1, checkSheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  const obj = {};
  obj[ID_HEADER] = id;
  obj['PO Number'] = po || '';
  obj['Project Name'] = name || '';
  obj['Client'] = client || '';
  obj['Overall Status'] = 'Not Started';
  obj['Progress (%)'] = 0;
  CHECKLIST_ITEMS.forEach(function (item) { obj[item] = 'Not Started'; });
  checkSheet.appendRow(headers.map(function (h) { return obj.hasOwnProperty(h) ? obj[h] : ''; }));
}


// HARUS dipanggil di dalam lock.
function migrateSchema_() {
  const projSheet = getSheet_(SHEET_PROJECTS);
  const checkSheet = getSheet_(SHEET_CHECKLIST);
  ensureColumn_(projSheet, ID_HEADER);
  ensureColumn_(checkSheet, ID_HEADER);
  PROJECT_EXTRA_COLUMNS.forEach(function (name) { ensureColumn_(projSheet, name); });


  const p = readSheet_(projSheet);
  const c = readSheet_(checkSheet);
  const pIdCol = p.headers.indexOf(ID_HEADER) + 1;
  const cIdCol = c.headers.indexOf(ID_HEADER) + 1;


  // 1) Setiap project punya Project ID unik (ID kembar akibat copy-paste baris diberi ID baru)
  const used = {};
  const projectWrites = [];
  p.rows.forEach(function (r) {
    const existing = cleanText_(r[ID_HEADER]);
    if (existing && !used[existing]) {
      used[existing] = true;
      r[ID_HEADER] = existing;
      return;
    }
    const fresh = generateProjectId_(used);
    r[ID_HEADER] = fresh;
    projectWrites.push({ row: r._row, id: fresh });
  });
  writeIdCells_(projSheet, pIdCol, projectWrites);


  // 2) Hubungkan baris checklist ke project: berdasarkan ID, lalu PO persis, lalu PO ternormalisasi
  const checkById = {};
  const noId = [];
  c.rows.forEach(function (r) {
    const id = cleanText_(r[ID_HEADER]);
    if (id) { if (!checkById[id]) checkById[id] = r; } else noId.push(r);
  });


  const claimed = {};
  const checkWrites = [];
  const missing = [];
  p.rows.forEach(function (proj) {
    const id = proj[ID_HEADER];
    if (checkById[id]) return;
    const po = cleanText_(proj['PO Number']);
    const name = cleanText_(proj['Project Name']);
    let match = null;
    if (po) {
      match = findUnclaimed_(noId, claimed, function (r) { return cleanText_(r['PO Number']) === po; }) ||
              findUnclaimed_(noId, claimed, function (r) { return normalizePO_(r['PO Number']) === normalizePO_(po); });
    } else if (name) {
      match = findUnclaimed_(noId, claimed, function (r) { return !cleanText_(r['PO Number']) && cleanText_(r['Project Name']) === name; });
    }
    if (match) {
      claimed[match._row] = true;
      checkWrites.push({ row: match._row, id: id });
      checkById[id] = match;
    } else {
      missing.push(proj);
    }
  });
  writeIdCells_(checkSheet, cIdCol, checkWrites);
  missing.forEach(function (proj) {
    appendChecklistRow_(checkSheet, proj[ID_HEADER], proj['PO Number'], proj['Project Name'], proj['Client']);
  });


  return {
    projectIdsAssigned: projectWrites.length,
    checklistLinked: checkWrites.length,
    checklistCreated: missing.length
  };
}


// Baca kedua sheet; kalau skema belum lengkap, migrasi lalu baca ulang.
function loadAll_() {
  let p = readSheet_(getSheet_(SHEET_PROJECTS));
  let c = readSheet_(getSheet_(SHEET_CHECKLIST));
  if (schemaNeedsMigration_(p, c)) {
    withLock_(function () { migrateSchema_(); });
    p = readSheet_(getSheet_(SHEET_PROJECTS));
    c = readSheet_(getSheet_(SHEET_CHECKLIST));
  }
  return { p: p, c: c };
}


// ------------------------------------------------------------------
// Read
// ------------------------------------------------------------------
function getProjects_() {
  const all = loadAll_();
  const checkById = {};
  all.c.rows.forEach(function (c) {
    const id = cleanText_(c[ID_HEADER]);
    if (id && !checkById[id]) checkById[id] = c;
  });


  return all.p.rows.map(function (p) {
    const c = checkById[cleanText_(p[ID_HEADER])] || null;
    return {
      id: cleanText_(p[ID_HEADER]),
      row: p._row,
      no: p['No'],
      poNumber: p['PO Number'],
      projectName: p['Project Name'],
      client: p['Client'],
      technology: p['Technology/Capacity'],
      pic: p['PIC'],
      currentStage: p['Current Stage'],
      status: p['Status'],
      stageProgress: toPercentNumber_(p['Stage Progress (%)']),
      engineeringDocProgress: toPercentNumber_(p['Engineering Doc Progress (%)']),
      priority: p['Priority'],
      tanggalPO: formatDate_(p['Tanggal PO']),
      tanggalDP: formatDate_(p['Tanggal DP']),
      deliveryDate: formatDate_(p['Delivery Date']),
      // Dihitung ulang tiap kali dibaca supaya selalu akurat terhadap tanggal hari ini.
      daysRemaining: computeDaysRemaining_(p['Delivery Date']),
      remarks: p['Remarks'],
      deskripsiPesanan: p['Deskripsi Pesanan'] || '',
      spesifikasiTeknologi: p['Spesifikasi Teknologi'] || '',
      targetFinishDate: formatDate_(p['Target Finish Date']),
      lokasiPlant: cleanText_(p[COL_LOKASI]),
      alamat: cleanText_(p[COL_ALAMAT]),
      kontakOwner: cleanText_(p[COL_KONTAK]),
      sistemTerpasang: parseSystems_(p[COL_SISTEM]),
      checklist: c ? {
        row: c._row,
        overallStatus: c['Overall Status'],
        items: CHECKLIST_ITEMS.reduce(function (acc, key) { acc[key] = c[key] || 'Not Started'; return acc; }, {}),
        links: CHECKLIST_ITEMS.reduce(function (acc, key) { acc[key] = c[key + ' Link'] || ''; return acc; }, {}),
        progress: toPercentNumber_(c['Progress (%)'])
      } : null
    };
  });
}


function computeDashboard_(projects) {
  const buckets = { preDelivery: 0, delivered: 0, completed: 0 };
  projects.forEach(function (p) {
    const sp = p.stageProgress;
    if (sp >= 100) buckets.completed++;
    else if (sp >= 90) buckets.delivered++;
    else buckets.preDelivery++;
  });
  return {
    total: projects.length,
    preDelivery: buckets.preDelivery,
    delivered: buckets.delivered,
    completed: buckets.completed
  };
}


// ------------------------------------------------------------------
// Write: add project
// ------------------------------------------------------------------
function assertPoUnique_(rows, poNumber, excludeId) {
  if (!ENFORCE_UNIQUE_PO) return;
  const target = normalizePO_(poNumber);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (excludeId && cleanText_(r[ID_HEADER]) === cleanText_(excludeId)) continue;
    if (normalizePO_(r['PO Number']) === target) {
      throw new Error('PO Number "' + poNumber + '" sudah dipakai project "' + (r['Project Name'] || '-') + '".');
    }
  }
}


function assertEnum_(label, value, allowed) {
  if (allowed.indexOf(value) === -1) throw new Error(label + ' tidak valid: "' + value + '".');
}


function addProject_(payload) {
  const poNumber = cleanText_(payload.poNumber);
  const projectName = cleanText_(payload.projectName);
  if (!poNumber || !projectName) throw new Error('PO Number dan Nama Project wajib diisi.');


  const stage = cleanText_(payload.currentStage) || 'PO';
  const status = cleanText_(payload.status) || 'In Progress';
  const priority = cleanText_(payload.priority) || 'Medium';
  assertEnum_('Current Stage', stage, Object.keys(STAGE_WEIGHTS));
  assertEnum_('Status', status, STATUSES);
  assertEnum_('Priority', priority, PRIORITIES);


  const all = loadAll_();
  assertPoUnique_(all.p.rows, poNumber, null);


  let maxNo = 0;
  const used = {};
  all.p.rows.forEach(function (r) {
    const n = parseFloat(r['No']);
    if (!isNaN(n) && n > maxNo) maxNo = n;
    used[cleanText_(r[ID_HEADER])] = true;
  });
  const id = generateProjectId_(used);
  const deliveryDate = cleanText_(payload.deliveryDate);


  const rowObj = {
    'No': maxNo + 1,
    'PO Number': poNumber,
    'Project Name': projectName,
    'Client': cleanText_(payload.client),
    'Technology/Capacity': cleanText_(payload.technology),
    'PIC': cleanText_(payload.pic),
    'Current Stage': stage,
    'Status': status,
    'Stage Progress (%)': STAGE_WEIGHTS[stage] / 100,
    'Engineering Doc Progress (%)': 0,
    'Priority': priority,
    'Tanggal PO': parseDateInput_(cleanText_(payload.tanggalPO)),
    'Tanggal DP': parseDateInput_(cleanText_(payload.tanggalDP)),
    'Delivery Date': parseDateInput_(deliveryDate),
    'Days Remaining': computeDaysRemaining_(deliveryDate),
    'Remarks': cleanText_(payload.remarks),
    'Deskripsi Pesanan': cleanText_(payload.deskripsiPesanan),
    'Spesifikasi Teknologi': cleanText_(payload.spesifikasiTeknologi),
    'Target Finish Date': parseDateInput_(cleanText_(payload.targetFinishDate))
  };
  rowObj[COL_LOKASI] = cleanText_(payload.lokasiPlant);
  rowObj[COL_ALAMAT] = cleanText_(payload.alamat);
  rowObj[COL_KONTAK] = cleanText_(payload.kontakOwner);
  rowObj[COL_SISTEM] = serializeSystems_(payload.sistemTerpasang);
  rowObj[ID_HEADER] = id;


  const projSheet = getSheet_(SHEET_PROJECTS);
  projSheet.appendRow(all.p.headers.map(function (h) { return rowObj.hasOwnProperty(h) ? rowObj[h] : ''; }));
  appendChecklistRow_(getSheet_(SHEET_CHECKLIST), id, poNumber, projectName, rowObj['Client']);


  logActivity_(payload.user, 'Tambah', id, poNumber, projectName, 'Project baru ditambahkan');
  invalidateProjectsCache_();
  return { id: id, poNumber: poNumber };
}


// ------------------------------------------------------------------
// Write: update project (hanya sel yang benar-benar berubah yang ditulis)
// ------------------------------------------------------------------
function updateProject_(payload) {
  const sheet = getSheet_(SHEET_PROJECTS);
  const found = findRowById_(sheet, payload.projectId);
  if (!found) throw new Error('Project tidak ditemukan. Mungkin sudah dihapus — muat ulang halaman.');
  const headers = found.headers;
  const rowIndex = found.rowIndex;
  const rowVals = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];


  const updates = {};
  const changes = [];
  const newValues = {};


  function col(name) { return headers.indexOf(name); }


  function currentText(c) {
    const v = rowVals[c];
    return v instanceof Date ? formatDate_(v) : cleanText_(v);
  }


  // Return true kalau nilainya berubah.
  function applyText(colName, raw, allowed) {
    if (raw === undefined) return false;
    const c = col(colName);
    if (c === -1) return false;
    const oldStr = currentText(c);
    const newStr = cleanText_(raw);
    if (oldStr === newStr) return false;
    if (allowed) assertEnum_(colName, newStr, allowed);
    changes.push(colName + ': "' + clip_(oldStr || '-', 80) + '" -> "' + clip_(newStr || '-', 80) + '"');
    updates[c] = newStr;
    rowVals[c] = newStr;
    newValues[colName] = newStr;
    return true;
  }


  function applyDate(colName, raw) {
    if (raw === undefined) return false;
    const c = col(colName);
    if (c === -1) return false;
    const oldStr = currentText(c);
    const newStr = cleanText_(raw);
    if (oldStr === newStr) return false;
    changes.push(colName + ': "' + (oldStr || '-') + '" -> "' + (newStr || '-') + '"');
    const parsed = parseDateInput_(newStr);
    updates[c] = parsed;
    rowVals[c] = parsed;
    newValues[colName] = newStr;
    return true;
  }


  // PO Number: wajib terisi & unik
  if (payload.poNumber !== undefined) {
    const newPo = cleanText_(payload.poNumber);
    const poCol = col('PO Number');
    if (poCol > -1 && currentText(poCol) !== newPo) {
      if (!newPo) throw new Error('PO Number tidak boleh kosong.');
      assertPoUnique_(readSheet_(sheet).rows, newPo, payload.projectId);
    }
    applyText('PO Number', newPo);
  }


  // Sistem terpasang: rapikan dulu jadi teks "a,b,c" berurutan & hanya kunci yang valid.
  if (payload.sistemTerpasang !== undefined) {
    payload.sistemTerpasang = serializeSystems_(payload.sistemTerpasang);
  }


  TEXT_FIELDS.forEach(function (f) { applyText(f[1], payload[f[0]]); });
  applyText('Priority', payload.priority, PRIORITIES);
  applyText('Status', payload.status, STATUSES);
  DATE_FIELDS.forEach(function (f) { applyDate(f[1], payload[f[0]]); });


  if (applyDate('Delivery Date', payload.deliveryDate)) {
    const dc = col('Days Remaining');
    if (dc > -1) updates[dc] = computeDaysRemaining_(cleanText_(payload.deliveryDate));
  }


  if (payload.currentStage !== undefined) {
    applyText('Current Stage', payload.currentStage, Object.keys(STAGE_WEIGHTS));
    const weight = STAGE_WEIGHTS[cleanText_(payload.currentStage)];
    const sc = col('Stage Progress (%)');
    if (weight !== undefined && sc > -1 && toPercentNumber_(rowVals[sc]) !== weight) {
      updates[sc] = weight / 100;
    }
  }


  const currentName = currentText(col('Project Name'));
  const currentPo = currentText(col('PO Number'));


  if (Object.keys(updates).length > 0) {
    writeCells_(sheet, rowIndex, updates);
  }


  // Jaga kolom identitas di sheet Checklist tetap sama dengan sheet Project Tracker
  const identity = {};
  if (newValues['PO Number'] !== undefined) identity['PO Number'] = newValues['PO Number'];
  if (newValues['Project Name'] !== undefined) identity['Project Name'] = newValues['Project Name'];
  if (newValues['Client'] !== undefined) identity['Client'] = newValues['Client'];
  if (Object.keys(identity).length > 0) {
    const checkSheet = getSheet_(SHEET_CHECKLIST);
    const cf = findRowById_(checkSheet, payload.projectId);
    if (cf) {
      const cu = {};
      Object.keys(identity).forEach(function (name) {
        const ci = cf.headers.indexOf(name);
        if (ci > -1) cu[ci] = identity[name];
      });
      writeCells_(checkSheet, cf.rowIndex, cu);
    }
  }


  if (changes.length > 0) {
    logActivity_(payload.user, 'Update', payload.projectId, currentPo, currentName, changes.join('; '));
    invalidateProjectsCache_();
  }
  return { id: payload.projectId, poNumber: currentPo };
}


// ------------------------------------------------------------------
// Write: checklist
// ------------------------------------------------------------------
function updateChecklist_(payload) {
  const sheet = getSheet_(SHEET_CHECKLIST);
  const found = findRowById_(sheet, payload.projectId);
  if (!found) throw new Error('Checklist project ini tidak ditemukan. Muat ulang halaman.');
  const headers = found.headers;
  const rowIndex = found.rowIndex;
  const rowVals = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];


  const items = payload.items || {};
  const links = payload.links || {};
  const updates = {};
  const changes = [];


  function setCol(c, value) {
    updates[c] = value;
    rowVals[c] = value;
  }


  CHECKLIST_ITEMS.forEach(function (item) {
    if (items[item] !== undefined) {
      const c = headers.indexOf(item);
      if (c > -1) {
        const oldStatus = cleanText_(rowVals[c]) || 'Not Started';
        const newStatus = cleanText_(items[item]);
        assertEnum_('Status dokumen', newStatus, CHECKLIST_STATUSES);
        if (oldStatus !== newStatus) {
          changes.push(item + ': ' + oldStatus + ' -> ' + newStatus);
          setCol(c, newStatus);
        }
      }
    }
    if (links[item] !== undefined) {
      const linkName = item + ' Link';
      let c = headers.indexOf(linkName);
      const newLink = cleanText_(links[item]);
      const oldLink = c > -1 ? cleanText_(rowVals[c]) : '';
      if (oldLink !== newLink) {
        if (newLink && !/^https?:\/\//i.test(newLink)) {
          throw new Error('Link ' + item + ' harus diawali http:// atau https://');
        }
        if (c === -1) {
          const newCol = ensureColumn_(sheet, linkName);
          while (headers.length < newCol) { headers.push(''); rowVals.push(''); }
          headers[newCol - 1] = linkName;
          c = newCol - 1;
        }
        setCol(c, newLink);
        changes.push('Link ' + item + ': ' + (newLink ? 'diperbarui' : 'dihapus'));
      }
    }
  });


  // Hitung progress dari status terbaru (tanpa baca ulang sheet)
  let sum = 0, count = 0;
  CHECKLIST_ITEMS.forEach(function (item) {
    const c = headers.indexOf(item);
    if (c === -1) return;
    const status = cleanText_(rowVals[c]);
    if (status && status !== 'N/A' && CHECKLIST_WEIGHTS.hasOwnProperty(status)) {
      sum += CHECKLIST_WEIGHTS[status];
      count++;
    }
  });
  const progress = count > 0 ? Math.round(sum / count) : 0;
  const overall = progress >= 100 ? 'Completed' : progress > 0 ? 'In Progress' : 'Not Started';


  const pc = headers.indexOf('Progress (%)');
  const oc = headers.indexOf('Overall Status');
  const progressChanged = pc > -1 && toPercentNumber_(rowVals[pc]) !== progress;
  if (pc > -1 && progressChanged) setCol(pc, progress / 100);
  if (oc > -1 && cleanText_(rowVals[oc]) !== overall) setCol(oc, overall);


  if (Object.keys(updates).length > 0) writeCells_(sheet, rowIndex, updates);


  // Sinkronkan "Engineering Doc Progress (%)" di sheet Project Tracker
  let projectName = '';
  let projectPo = '';
  const projSheet = getSheet_(SHEET_PROJECTS);
  const pf = findRowById_(projSheet, payload.projectId);
  if (pf) {
    const docCol = pf.headers.indexOf('Engineering Doc Progress (%)');
    if (docCol > -1 && (progressChanged || changes.length > 0)) {
      projSheet.getRange(pf.rowIndex, docCol + 1).setValue(progress / 100);
    }
    const nameCol = pf.headers.indexOf('Project Name');
    const poCol = pf.headers.indexOf('PO Number');
    if (nameCol > -1) projectName = projSheet.getRange(pf.rowIndex, nameCol + 1).getValue();
    if (poCol > -1) projectPo = projSheet.getRange(pf.rowIndex, poCol + 1).getValue();
  }


  if (changes.length > 0) {
    logActivity_(payload.user, 'Update Checklist', payload.projectId, projectPo, projectName, changes.join('; '));
    invalidateProjectsCache_();
  }
  return { id: payload.projectId, progress: progress };
}


// ------------------------------------------------------------------
// Write: delete project
// ------------------------------------------------------------------
function rowToSnapshot_(headers, values) {
  const snap = {};
  headers.forEach(function (h, idx) {
    if (!h) return;
    const v = values[idx];
    snap[h] = v instanceof Date ? formatDate_(v) : v;
  });
  return snap;
}


function deleteProject_(payload) {
  const id = cleanText_(payload.projectId);
  if (!id) throw new Error('Project ID tidak ditemukan.');


  const projSheet = getSheet_(SHEET_PROJECTS);
  const pf = findRowById_(projSheet, id);
  if (!pf) throw new Error('Project tidak ditemukan atau sudah dihapus.');


  const pVals = projSheet.getRange(pf.rowIndex, 1, 1, pf.headers.length).getValues()[0];
  const snapshot = { project: rowToSnapshot_(pf.headers, pVals), checklist: null };
  const projectName = snapshot.project['Project Name'] || '';
  const poNumber = snapshot.project['PO Number'] || '';


  const checkSheet = getSheet_(SHEET_CHECKLIST);
  const cf = findRowById_(checkSheet, id);
  if (cf) {
    const cVals = checkSheet.getRange(cf.rowIndex, 1, 1, cf.headers.length).getValues()[0];
    snapshot.checklist = rowToSnapshot_(cf.headers, cVals);
    checkSheet.deleteRow(cf.rowIndex);
  }
  projSheet.deleteRow(pf.rowIndex);


  const detail = 'Snapshot data sebelum dihapus: ' + clip_(JSON.stringify(snapshot), 45000);
  logActivity_(payload.user, 'Hapus', id, poNumber, projectName, detail);
  notifyDeletion_(payload.user, poNumber, projectName);
  invalidateProjectsCache_();


  return { deleted: true, id: id, poNumber: poNumber };
}


// ------------------------------------------------------------------
// Activity Log
// ------------------------------------------------------------------
function getOrCreateActivityLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_ACTIVITY_LOG);
  if (!sh) {
    sh = ss.insertSheet(SHEET_ACTIVITY_LOG);
    sh.appendRow(ACTIVITY_LOG_COLUMNS);
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 150);
    sh.setColumnWidth(6, 500);
  } else if (String(sh.getRange(1, 7).getValue()).trim() !== 'Project ID') {
    sh.getRange(1, 7).setValue('Project ID'); // log lama hanya punya 6 kolom
  }
  return sh;
}


function logActivity_(user, action, projectId, poNumber, projectName, detail) {
  try {
    const sh = getOrCreateActivityLogSheet_();
    sh.appendRow([
      new Date(),
      user || 'Tidak diketahui',
      action,
      poNumber || '',
      projectName || '',
      detail || '',
      projectId || ''
    ]);
  } catch (e) {
    // Kegagalan mencatat log tidak boleh menggagalkan aksi utamanya.
  }
}


function getActivityLog_() {
  const sh = getOrCreateActivityLogSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];


  // Hanya baca N baris terakhir supaya tetap cepat walau log sudah panjang.
  const start = Math.max(2, lastRow - ACTIVITY_LIMIT + 1);
  const data = sh.getRange(start, 1, lastRow - start + 1, 7).getValues();


  // Peta ID & PO project yang MASIH ada (untuk link; project yang sudah dihapus tidak dilink).
  // Pakai data yang sudah dicache (bukan baca ulang sheet Project Tracker dari nol).
  const projects = getProjectsCached_();
  const existingIds = {};
  const poToId = {};
  projects.forEach(function (p) {
    if (!p.id) return;
    existingIds[p.id] = true;
    const key = normalizePO_(p.poNumber);
    if (key && !poToId[key]) poToId[key] = p.id;
  });


  const rows = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    const storedId = cleanText_(row[6]);
    const projectId = storedId
      ? (existingIds[storedId] ? storedId : '')
      : (poToId[normalizePO_(row[3])] || ''); // log lama (belum punya ID): cocokkan lewat PO
    rows.push({
      timestamp: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
      user: row[1],
      action: row[2],
      poNumber: row[3],
      projectName: row[4],
      detail: row[5],
      projectId: projectId
    });
  }
  rows.reverse();
  return rows;
}


// ------------------------------------------------------------------
// Comments (komentar per project)
// ------------------------------------------------------------------
function getOrCreateCommentsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_COMMENTS);
  if (!sh) {
    sh = ss.insertSheet(SHEET_COMMENTS);
    sh.appendRow(['Timestamp', 'Project ID', 'User', 'Text']);
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 150);
    sh.setColumnWidth(4, 500);
  }
  return sh;
}


function getComments_(projectId) {
  const id = cleanText_(projectId);
  if (!id) throw new Error('Project ID wajib diisi.');
  const sh = getOrCreateCommentsSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const data = sh.getRange(2, 1, lastRow - 1, 4).getValues();
  const rows = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    if (cleanText_(row[1]) !== id) continue; // hanya komentar milik project ini
    rows.push({
      timestamp: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
      user: row[2],
      text: row[3]
    });
  }
  return rows; // sudah urut lama -> baru sesuai urutan ditulis
}


function addComment_(payload) {
  const id = cleanText_(payload.projectId);
  if (!id) throw new Error('Project ID wajib diisi.');
  const text = cleanText_(payload.text);
  if (!text) throw new Error('Komentar tidak boleh kosong.');
  if (text.length > COMMENT_MAX_LENGTH) throw new Error('Komentar maksimal ' + COMMENT_MAX_LENGTH + ' karakter.');


  // Pastikan project-nya masih ada, sekalian ambil nama/PO untuk Activity Log
  const projSheet = getSheet_(SHEET_PROJECTS);
  const pf = findRowById_(projSheet, id);
  if (!pf) throw new Error('Project tidak ditemukan. Mungkin sudah dihapus — muat ulang halaman.');
  const rowVals = projSheet.getRange(pf.rowIndex, 1, 1, pf.headers.length).getValues()[0];
  const poCol = pf.headers.indexOf('PO Number');
  const nameCol = pf.headers.indexOf('Project Name');
  const poNumber = poCol > -1 ? rowVals[poCol] : '';
  const projectName = nameCol > -1 ? rowVals[nameCol] : '';


  const sh = getOrCreateCommentsSheet_();
  const timestamp = new Date();
  const user = payload.user || 'Tidak diketahui';
  sh.appendRow([timestamp, id, user, text]);


  logActivity_(user, 'Komentar', id, poNumber, projectName, clip_(text, 200));


  return { timestamp: timestamp.toISOString(), user: user, text: text };
}


// ------------------------------------------------------------------
// Document Log (riwayat Commissioning Report / Handover Report yang di-generate)
// ------------------------------------------------------------------
function getOrCreateDocumentLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_DOCUMENTS);
  if (!sh) {
    sh = ss.insertSheet(SHEET_DOCUMENTS);
    sh.appendRow(DOCUMENT_LOG_COLUMNS);
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 150);
    sh.setColumnWidth(5, 260);
    sh.setColumnWidth(6, 260);
    sh.setColumnWidth(7, 420);
  }
  return sh;
}


// Dipanggil server Next.js (/api/docgen) setiap kali dokumen berhasil dibuat.
// Kalau dokumen terkait project yang tercatat (projectId), PO & nama project diambil dari
// sheet Project Tracker supaya konsisten; kalau tidak, dipakai isian dari form.
function logDocument_(payload) {
  const type = cleanText_(payload.docType);
  assertEnum_('Tipe dokumen', type, DOCUMENT_TYPES);
  const url = cleanText_(payload.documentUrl);
  if (!/^https?:\/\//i.test(url)) throw new Error('Link dokumen harus diawali http:// atau https://');


  let poNumber = cleanText_(payload.poNumber);
  let projectName = cleanText_(payload.projectName);
  const projectId = cleanText_(payload.projectId);


  if (projectId) {
    const projSheet = getSheet_(SHEET_PROJECTS);
    const pf = findRowById_(projSheet, projectId);
    if (pf) {
      const rowVals = projSheet.getRange(pf.rowIndex, 1, 1, pf.headers.length).getValues()[0];
      const poCol = pf.headers.indexOf('PO Number');
      const nameCol = pf.headers.indexOf('Project Name');
      if (poCol > -1 && cleanText_(rowVals[poCol])) poNumber = cleanText_(rowVals[poCol]);
      if (nameCol > -1 && cleanText_(rowVals[nameCol])) projectName = cleanText_(rowVals[nameCol]);
    }
  }


  const sh = getOrCreateDocumentLogSheet_();
  sh.appendRow([
    new Date(),
    sheetSafe_(payload.user || 'Tidak diketahui'),
    type,
    sheetSafe_(poNumber),
    sheetSafe_(projectName),
    sheetSafe_(clip_(cleanText_(payload.fileName), 300)),
    url,
    projectId
  ]);
  return { logged: true };
}


// projectId opsional: kalau diisi, hanya dokumen project itu. Urutan: terbaru di atas.
function getDocuments_(projectId) {
  const id = cleanText_(projectId);
  const sh = getOrCreateDocumentLogSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];


  // Tanpa filter: cukup N baris terakhir. Dengan filter: baca semua lalu saring.
  const start = id ? 2 : Math.max(2, lastRow - DOCUMENT_LIMIT + 1);
  const data = sh.getRange(start, 1, lastRow - start + 1, DOCUMENT_LOG_COLUMNS.length).getValues();


  const rows = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    const url = cleanText_(row[6]);
    if (!/^https?:\/\//i.test(url)) continue; // baris rusak / diisi manual tanpa link
    if (id && cleanText_(row[7]) !== id) continue;
    rows.push({
      timestamp: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
      user: row[1],
      type: cleanText_(row[2]),
      poNumber: row[3],
      projectName: row[4],
      fileName: row[5],
      documentUrl: url,
      projectId: cleanText_(row[7])
    });
  }
  rows.reverse();
  return id ? rows : rows.slice(0, DOCUMENT_LIMIT);
}


function notifyDeletion_(user, poNumber, projectName) {
  const emails = getProp_('ADMIN_NOTIFICATION_EMAILS').split(',').map(function (e) { return e.trim(); }).filter(Boolean);
  if (emails.length === 0) return;
  try {
    const subject = '[Bening Hub] Project dihapus: ' + (projectName || poNumber);
    const body = 'Project berikut telah dihapus dari Bening Hub:\n\n' +
      'PO Number: ' + poNumber + '\n' +
      'Nama Project: ' + (projectName || '-') + '\n' +
      'Dihapus oleh: ' + (user || 'Tidak diketahui') + '\n' +
      'Waktu: ' + new Date().toString() + '\n\n' +
      'Cek tab "Activity Log" di spreadsheet untuk detail lengkap data sebelum dihapus.';
    MailApp.sendEmail(emails.join(','), subject, body);
  } catch (e) {
    // Kegagalan kirim email tidak boleh menggagalkan proses hapus.
  }
}
