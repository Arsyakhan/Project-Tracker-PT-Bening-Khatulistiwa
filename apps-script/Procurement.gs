/**
 * BENING HUB — PENGADAAN MATERIAL (Procurement)
 * ---------------------------------------------------
 * FILE TAMBAHAN di project Apps Script Tracker yang SAMA dengan Code.gs
 * (di editor: klik "+" di samping "Files" > Script > beri nama "Procurement").
 *
 * Satu baris di tab "Procurement" = satu barang yang dibeli/ditunggu (mis. membran ROPP, pompa CNP,
 * pressure vessel). Barang boleh terkait satu project di Tracker, atau berdiri sendiri (kolom "For":
 * mis. "Sago", "HPCL", "Stok gudang"). Tab dibuat OTOMATIS saat pertama dipakai.
 *
 * AGAR TERPAKAI: doGet/doPost di Code.gs harus mengenali 3 aksi baru
 * (procurement, saveProcurementItem, deleteProcurementItem). Lihat petunjuk penggantian
 * fungsi doGet & doPost yang menyertai file ini. Setelah itu: Deploy > Manage deployments >
 * ikon pensil > Version: New version > Deploy.
 */

const SHEET_PROCUREMENT = 'Procurement';
const PROC_COLUMNS = [
  'Item ID', 'Project ID', 'For', 'Item', 'Qty', 'Vendor', 'Status', 'Order Date', 'ETA',
  'Received Date', 'Shipment', 'PO Ref', 'Notes', 'Version', 'Created At', 'Created By', 'Updated At', 'Updated By'
];
const PROC_STATUSES = ['Perlu dibeli', 'Sudah order', 'Dalam pengiriman', 'Tiba sebagian', 'Diterima', 'Batal'];
const PROC_LIMIT = 1000;

function getOrCreateProcurementSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_PROCUREMENT);
  if (!sh) {
    sh = ss.insertSheet(SHEET_PROCUREMENT);
    sh.appendRow(PROC_COLUMNS);
    sh.setFrozenRows(1);
    // Tanggal disimpan sebagai TEKS supaya Google Sheets tidak mengubahnya jadi tipe tanggal.
    sh.getRange(1, 8, 2000, 3).setNumberFormat('@');
    sh.setColumnWidth(1, 120);
    sh.setColumnWidth(4, 260);
    sh.setColumnWidth(13, 300);
  }
  return sh;
}

function procItemFromRow_(r) {
  const iso = function (v) { return v instanceof Date ? v.toISOString() : cleanText_(v); };
  return {
    id: cleanText_(r[0]),
    projectId: cleanText_(r[1]),
    forLabel: cleanText_(r[2]),
    item: cleanText_(r[3]),
    qty: cleanText_(r[4]),
    vendor: cleanText_(r[5]),
    status: cleanText_(r[6]) || 'Perlu dibeli',
    orderDate: meetingDateStr_(r[7]),
    eta: meetingDateStr_(r[8]),
    receivedDate: meetingDateStr_(r[9]),
    shipment: cleanText_(r[10]),
    poRef: cleanText_(r[11]),
    notes: cleanText_(r[12]),
    version: Number(r[13]) || 1,
    createdAt: iso(r[14]),
    createdBy: cleanText_(r[15]),
    updatedAt: iso(r[16]),
    updatedBy: cleanText_(r[17])
  };
}

function findProcRow_(sh, id) {
  const target = cleanText_(id);
  if (!target) return null;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  const data = sh.getRange(2, 1, lastRow - 1, PROC_COLUMNS.length).getValues();
  for (let i = 0; i < data.length; i++) {
    if (cleanText_(data[i][0]) === target) return { rowIndex: i + 2, values: data[i] };
  }
  return null;
}

// Semua barang (urutan sheet = lama ke baru). Pengurutan & filter dilakukan di web.
function getProcurement_() {
  const sh = getOrCreateProcurementSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const data = sh.getRange(2, 1, lastRow - 1, PROC_COLUMNS.length).getValues();
  const rows = [];
  data.forEach(function (r) { if (cleanText_(r[0])) rows.push(procItemFromRow_(r)); });
  return rows.slice(-PROC_LIMIT);
}

// Nomor PO & nama project untuk Activity Log (kosong kalau barang tidak terkait project).
function procProjectInfo_(projectId) {
  const id = cleanText_(projectId);
  if (!id) return { po: '', name: '' };
  const sheet = getSheet_(SHEET_PROJECTS);
  const pf = findRowById_(sheet, id);
  if (!pf) return null;
  const vals = sheet.getRange(pf.rowIndex, 1, 1, pf.headers.length).getValues()[0];
  const poCol = pf.headers.indexOf('PO Number');
  const nameCol = pf.headers.indexOf('Project Name');
  return { po: poCol > -1 ? cleanText_(vals[poCol]) : '', name: nameCol > -1 ? cleanText_(vals[nameCol]) : '' };
}

function sanitizeProcItem_(p) {
  const item = clip_(cleanText_(p.item), 200);
  if (!item) throw new Error('Nama barang wajib diisi.');

  const status = cleanText_(p.status) || 'Perlu dibeli';
  assertEnum_('Status pengadaan', status, PROC_STATUSES);

  function date(label, v) {
    const d = cleanText_(v);
    if (!d) return '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Tanggal ' + label + ' tidak valid.');
    return d;
  }

  const orderDate = date('order', p.orderDate);
  const eta = date('ETA', p.eta);
  let receivedDate = date('diterima', p.receivedDate);
  // Tanggal diterima hanya relevan kalau barang sudah (sebagian) datang; kalau "Diterima" dan kosong -> hari ini.
  if (status === 'Diterima' && !receivedDate) receivedDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (status !== 'Diterima' && status !== 'Tiba sebagian') receivedDate = '';

  return {
    projectId: clip_(cleanText_(p.projectId), 40),
    forLabel: clip_(cleanText_(p.forLabel), 100),
    item: item,
    qty: clip_(cleanText_(p.qty), 60),
    vendor: clip_(cleanText_(p.vendor), 150),
    status: status,
    orderDate: orderDate,
    eta: eta,
    receivedDate: receivedDate,
    shipment: clip_(cleanText_(p.shipment), 60),
    poRef: clip_(cleanText_(p.poRef), 80),
    notes: clip_(cleanText_(p.notes), 2000)
  };
}

function saveProcurementItem_(payload) {
  const m = sanitizeProcItem_(payload);
  const user = payload.user || 'Tidak diketahui';

  // Barang boleh tidak terkait project; kalau terkait, project-nya harus masih ada.
  const info = procProjectInfo_(m.projectId);
  if (!info) throw new Error('Project tidak ditemukan. Mungkin sudah dihapus — muat ulang halaman.');

  const sh = getOrCreateProcurementSheet_();
  const now = new Date();
  const id = cleanText_(payload.id);
  const logName = info.name || (m.forLabel ? 'Untuk ' + m.forLabel : 'Pengadaan');

  if (id) {
    const found = findProcRow_(sh, id);
    if (!found) throw new Error('Barang tidak ditemukan. Mungkin sudah dihapus — muat ulang halaman.');
    const cur = procItemFromRow_(found.values);
    if ((Number(payload.baseVersion) || 0) !== cur.version) {
      throw new Error('Data barang ini sudah diubah oleh ' + (cur.updatedBy || 'pengguna lain') +
        '. Muat ulang halaman untuk melihat versi terbaru, lalu ulangi perubahan Anda.');
    }
    const version = cur.version + 1;
    const row = [
      id, m.projectId, sheetSafe_(m.forLabel), sheetSafe_(m.item), sheetSafe_(m.qty), sheetSafe_(m.vendor), m.status,
      m.orderDate, m.eta, m.receivedDate, sheetSafe_(m.shipment), sheetSafe_(m.poRef), sheetSafe_(m.notes), version,
      found.values[14], found.values[15], now, sheetSafe_(user)
    ];
    sh.getRange(found.rowIndex, 1, 1, PROC_COLUMNS.length).setValues([row]);

    const changes = [];
    if (cur.status !== m.status) changes.push('Status: ' + cur.status + ' -> ' + m.status);
    if (cur.eta !== m.eta) changes.push('ETA: ' + (cur.eta || '-') + ' -> ' + (m.eta || '-'));
    if (cur.vendor !== m.vendor) changes.push('Vendor: ' + (cur.vendor || '-') + ' -> ' + (m.vendor || '-'));
    if (cur.qty !== m.qty) changes.push('Qty: ' + (cur.qty || '-') + ' -> ' + (m.qty || '-'));
    logActivity_(user, 'Update Pengadaan', m.projectId, info.po, logName,
      m.item + (changes.length ? ' | ' + changes.join('; ') : ' | detail diubah'));
    return procItemFromRow_(sh.getRange(found.rowIndex, 1, 1, PROC_COLUMNS.length).getValues()[0]);
  }

  const newId = 'prc_' + Utilities.getUuid().replace(/-/g, '').substring(0, 12);
  const row = [
    newId, m.projectId, sheetSafe_(m.forLabel), sheetSafe_(m.item), sheetSafe_(m.qty), sheetSafe_(m.vendor), m.status,
    m.orderDate, m.eta, m.receivedDate, sheetSafe_(m.shipment), sheetSafe_(m.poRef), sheetSafe_(m.notes), 1,
    now, sheetSafe_(user), now, sheetSafe_(user)
  ];
  sh.appendRow(row);
  logActivity_(user, 'Tambah Pengadaan', m.projectId, info.po, logName, m.item + ' | ' + m.status + (m.eta ? ' | ETA ' + m.eta : ''));
  return procItemFromRow_(sh.getRange(sh.getLastRow(), 1, 1, PROC_COLUMNS.length).getValues()[0]);
}

function deleteProcurementItem_(payload) {
  const id = cleanText_(payload.id);
  if (!id) throw new Error('ID barang wajib diisi.');
  const sh = getOrCreateProcurementSheet_();
  const found = findProcRow_(sh, id);
  if (!found) throw new Error('Barang tidak ditemukan atau sudah dihapus.');
  const cur = procItemFromRow_(found.values);
  const info = procProjectInfo_(cur.projectId) || { po: '', name: '' };
  sh.deleteRow(found.rowIndex);
  logActivity_(payload.user, 'Hapus Pengadaan', cur.projectId, info.po, info.name || (cur.forLabel ? 'Untuk ' + cur.forLabel : 'Pengadaan'),
    'Snapshot data sebelum dihapus: ' + clip_(JSON.stringify(cur), 45000));
  return { deleted: true, id: id };
}
