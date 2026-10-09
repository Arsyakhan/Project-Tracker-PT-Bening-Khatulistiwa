/**
 * PT BENING KHATULISTIWA — GENERATOR NOTULENSI RAPAT (Minutes of Meeting)
 * ---------------------------------------------------
 * Script Apps Script TERPISAH (sama seperti generator Commissioning & Handover).
 * Membuat 1 Google Doc per rapat dengan struktur yang sama seperti template MoM:
 *   1. Informasi Umum  2. Daftar Kehadiran  3. Rincian Agenda & Progress  4. Catatan & Agenda Berikutnya
 * Dokumen dibuat dari kode (bukan menyalin template), jadi TIDAK butuh placeholder di template.
 *
 * SETUP (sekali saja):
 *   1. script.google.com > New project > paste seluruh file ini > Save.
 *   2. Folder hasil notulensi sudah diisi di OUTPUT_FOLDER_ID di bawah. Akun Google yang
 *      men-deploy script ini WAJIB punya akses Editor ke folder tersebut. (Mau ganti folder:
 *      buka foldernya, salin ID dari URL bagian setelah /folders/.)
 *   3. (Disarankan) Project Settings > Script Properties > tambah
 *        GENERATOR_SECRET = <teks acak panjang>
 *      Nilai yang sama dipasang di Vercel sebagai DOCGEN_MEETING_SECRET. Tanpa ini, siapa pun yang
 *      tahu URL script bisa membuat dokumen di Drive Anda.
 *   4. Pilih fungsi `authorizeOnce` > Run > izinkan akses (Drive & Docs).
 *   5. Deploy > New deployment > Web app
 *        Execute as: Me | Who has access: Anyone
 *      Salin URL-nya ke Vercel sebagai DOCGEN_MEETING_URL, lalu redeploy frontend.
 *
 * MENGUPDATE KODE: Deploy > Manage deployments > ikon pensil > Version: "New version" > Deploy.
 */

var OUTPUT_FOLDER_ID = '1IaQoI3Swl9LNvLu7PJoZW46DY2KSztDT';

var DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
var MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
var HEADER_BG = '#D9E2EC';

// Jalankan SEKALI dari editor supaya Google meminta izin akses Drive & Docs.
function authorizeOnce() {
  DriveApp.getRootFolder();
  DocumentApp.create('tes-otorisasi').saveAndClose();
  Logger.log('Izin sudah diberikan. Hapus dokumen "tes-otorisasi" dari Drive Anda.');
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Verifikasi secret bersama (DOCGEN_MEETING_SECRET di Vercel). Kalau GENERATOR_SECRET belum
    // diisi di Script Properties, pengecekan dilewati (perilaku lama).
    // CATATAN: bagian ini DITAMBAHKAN di repo; versi live sebelumnya belum memeriksa secret.
    var expected = PropertiesService.getScriptProperties().getProperty('GENERATOR_SECRET');
    if (expected && String(data.secret || '') !== expected) throw new Error('Unauthorized');

    var m = data.meeting;
    if (!m || !m.date) throw new Error('Data rapat tidak lengkap.');

    // Cek folder TERLEBIH DAHULU supaya tidak ada dokumen yatim kalau folder salah / tidak ada akses.
    var folder = null;
    if (OUTPUT_FOLDER_ID && OUTPUT_FOLDER_ID.indexOf('ISI_') !== 0) {
      try {
        folder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
      } catch (folderErr) {
        throw new Error('Folder Drive tidak ditemukan atau akun script tidak punya akses. Cek OUTPUT_FOLDER_ID.');
      }
    }

    var title = 'MoM - ' + shortDate_(m.date) + (m.kind ? ' - ' + m.kind : '');
    var doc = DocumentApp.create(title);
    buildDoc_(doc, m);
    doc.saveAndClose();

    var file = DriveApp.getFileById(doc.getId());
    if (folder) {
      try {
        file.moveTo(folder);
      } catch (moveErr) {
        file.setTrashed(true); // jangan tinggalkan dokumen di My Drive
        throw new Error('Tidak bisa menyimpan ke folder Drive. Pastikan akun pemilik script punya akses Editor ke folder tersebut.');
      }
    }

    return json_({ status: 'success', documentUrl: file.getUrl(), fileName: file.getName() });
  } catch (err) {
    return json_({ status: 'error', message: String(err && err.message ? err.message : err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---- Format tanggal (Indonesia) ----
function parseIso_(iso) {
  var p = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return p ? new Date(Number(p[1]), Number(p[2]) - 1, Number(p[3])) : null;
}
function longDate_(iso) {
  var d = parseIso_(iso);
  return d ? DAYS_ID[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS_ID[d.getMonth()] + ' ' + d.getFullYear() : '-';
}
function shortDate_(iso) {
  var d = parseIso_(iso);
  return d ? d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear() : '-';
}
function timeRange_(m) {
  if (!m.startTime) return '-';
  var s = m.startTime.replace(':', '.');
  return m.endTime ? s + ' - ' + m.endTime.replace(':', '.') + ' WIB' : s + ' WIB';
}

// ---- Isi dokumen ----
function buildDoc_(doc, m) {
  var body = doc.getBody();
  body.clear();

  // Lanskap supaya tabel agenda 7 kolom muat lega.
  body.setPageWidth(841.89);
  body.setPageHeight(595.28);
  body.setMarginTop(36).setMarginBottom(36).setMarginLeft(36).setMarginRight(36);

  var title = body.appendParagraph('MINUTES OF MEETING (MOM) & WEEKLY PROGRESS');
  title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  // 1. Informasi Umum
  heading_(body, '1. Informasi Umum');
  var info = body.appendTable([
    ['Hari / Tanggal', ': ' + longDate_(m.date), 'Waktu Rapat', ': ' + timeRange_(m)],
    ['Sifat Rapat', ': ' + (m.kind || '-'), 'Media / Lokasi', ': ' + (m.location || '-')],
    ['Agenda Bahasan', ': ' + (m.agenda || '-'), '', '']
  ]);
  boldColumn_(info, 0);
  boldColumn_(info, 2);

  // 2. Kehadiran
  heading_(body, '2. Daftar Kehadiran Koordinasi Lintas Divisi');
  var att = m.attendees || [];
  var attRows = [['Nama Staff / Pejabat', 'Divisi', 'Status Kehadiran']];
  if (att.length === 0) attRows.push(['-', '-', '-']);
  att.forEach(function (a) { attRows.push([a.name || '', a.division || '', a.status || 'Hadir']); });
  var attTable = body.appendTable(attRows);
  headerRow_(attTable);

  // 3. Agenda & progress
  heading_(body, '3. Rincian Agenda & Progress Proyek (Weekly Update)');
  var items = m.items || [];
  var itemRows = [['No', 'Topik Bahasan', 'Type', 'Isi Bahasan', 'CTA', 'PIC', 'Target']];
  if (items.length === 0) itemRows.push(['-', '-', '-', '-', '-', '-', '-']);
  items.forEach(function (it, i) {
    var topic = it.topic || '';
    if (it.status === 'Selesai') topic += ' [Selesai]';
    else if (it.status === 'Batal') topic += ' [Batal]';
    var content = it.content || '';
    if (it.prevNote) content += (content ? '\n' : '') + '(Sebelumnya - ' + it.prevNote + ')';
    itemRows.push([String(i + 1), topic, it.type || '', content, it.cta || '', it.pic || '', it.target ? shortDate_(it.target) : '']);
  });
  var itemTable = body.appendTable(itemRows);
  headerRow_(itemTable);
  var widths = [28, 120, 90, 230, 130, 100, 64];
  for (var c = 0; c < widths.length; c++) itemTable.setColumnWidth(c, widths[c]);

  // 4. Catatan
  heading_(body, '4. Catatan Tambahan & Agenda Rapat Berikutnya');
  var notes = body.appendTable([
    ['Kategori', 'Detail Catatan / Agenda'],
    ['Catatan Tambahan', m.notes || '-'],
    ['Agenda Rapat Berikutnya', m.nextAgenda || '-']
  ]);
  headerRow_(notes);
  boldColumn_(notes, 0);
  notes.setColumnWidth(0, 160);
  notes.setColumnWidth(1, 598);

  // Font seragam dulu, baru judul/header ditebalkan (urutan penting).
  body.editAsText().setFontFamily('Arial').setFontSize(10);
  title.editAsText().setBold(true).setFontSize(14);
  [info, attTable, itemTable, notes].forEach(function (t) { styleTable_(t); });
  boldColumn_(info, 0);
  boldColumn_(info, 2);
  boldColumn_(notes, 0);
  headerRow_(attTable);
  headerRow_(itemTable);
  headerRow_(notes);
  body.getParagraphs().forEach(function (p) {
    if (p.getHeading() === DocumentApp.ParagraphHeading.HEADING3) p.editAsText().setBold(true).setFontSize(11);
  });
}

function heading_(body, text) {
  var p = body.appendParagraph(text);
  p.setHeading(DocumentApp.ParagraphHeading.HEADING3);
  p.setSpacingBefore(12);
  return p;
}

function styleTable_(table) {
  table.setBorderWidth(0.75);
}

function headerRow_(table) {
  var row = table.getRow(0);
  for (var c = 0; c < row.getNumCells(); c++) {
    var cell = row.getCell(c);
    cell.setBackgroundColor(HEADER_BG);
    cell.editAsText().setBold(true);
  }
}

function boldColumn_(table, col) {
  for (var r = 0; r < table.getNumRows(); r++) {
    var row = table.getRow(r);
    if (col < row.getNumCells()) row.getCell(col).editAsText().setBold(true);
  }
}
