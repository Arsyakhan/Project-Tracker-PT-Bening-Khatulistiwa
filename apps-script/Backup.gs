/**
 * BENING HUB — BACKUP OTOMATIS SPREADSHEET
 * ---------------------------------------------------
 * FILE TAMBAHAN di project Apps Script Tracker yang SAMA dengan Code.gs
 * (di editor: klik "+" di samping "Files" > Script > beri nama "Backup").
 * Code.gs TIDAK perlu diubah, dan web app TIDAK perlu di-deploy ulang.
 *
 * Yang dilakukan: membuat salinan seluruh spreadsheet (semua tab, termasuk script-nya)
 * ke folder Drive, tiap Senin dini hari. Salinan lama dibuang otomatis, hanya BACKUP_KEEP terakhir disimpan.
 *
 * SETUP (sekali saja):
 *   1. Pilih fungsi `installBackupTrigger` di dropdown > Run > izinkan akses Drive.
 *      Fungsi ini membuat jadwal mingguan DAN langsung membuat 1 backup sebagai uji coba.
 *   2. Cek Execution log: ada nama file & link backup pertama. Buka linknya untuk memastikan isinya lengkap.
 *   3. Selesai. Hasil tiap backup juga tercatat di tab "Activity Log" (user: Sistem).
 *
 * LOKASI BACKUP: subfolder "Bening Hub - Backup Spreadsheet" di folder yang sama dengan spreadsheet
 * (atau di My Drive kalau spreadsheet ada di root). Kalau folder induknya dibagikan ke orang lain,
 * backup ikut terlihat oleh mereka. Mau lokasi lain? Buat folder, salin ID dari URL (setelah /folders/),
 * lalu Project Settings > Script Properties > tambah BACKUP_FOLDER_ID = <ID itu>.
 *
 * MEMULIHKAN: buka salah satu file backup, lalu File > Make a copy, atau salin tab yang dibutuhkan
 * ke spreadsheet utama. Jangan menimpa spreadsheet utama begitu saja.
 *
 * GAGAL? Kalau ADMIN_NOTIFICATION_EMAILS sudah diisi (dipakai juga untuk notifikasi hapus project),
 * email kegagalan dikirim ke alamat itu.
 */

var BACKUP_FOLDER_NAME = 'Bening Hub - Backup Spreadsheet';
var BACKUP_PREFIX = 'Backup - Project Tracker - ';
var BACKUP_KEEP = 8; // mingguan => sekitar 2 bulan terakhir

// Dipanggil otomatis oleh trigger (dan boleh dijalankan manual dari editor kapan saja).
function backupSpreadsheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var folder = getBackupFolder_(ss);
    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm');
    var copy = DriveApp.getFileById(ss.getId()).makeCopy(BACKUP_PREFIX + stamp, folder);
    var removed = pruneBackups_(folder);

    PropertiesService.getScriptProperties().setProperty('LAST_BACKUP_AT', new Date().toISOString());
    logActivity_('Sistem', 'Backup', '', '', 'Backup spreadsheet',
      'Salinan dibuat: ' + copy.getName() + (removed > 0 ? '; ' + removed + ' salinan lama dihapus' : ''));
    Logger.log('Backup berhasil: ' + copy.getName() + '\n' + copy.getUrl());
    return { name: copy.getName(), url: copy.getUrl(), removed: removed };
  } catch (err) {
    notifyBackupFailure_(err);
    throw err; // supaya kegagalan tampak di menu Executions
  }
}

// Folder tujuan: BACKUP_FOLDER_ID (kalau diisi & masih bisa dibuka), kalau tidak -> subfolder di samping spreadsheet.
function getBackupFolder_(ss) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('BACKUP_FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {
      Logger.log('BACKUP_FOLDER_ID tidak bisa dibuka, membuat folder baru. (' + e + ')');
    }
  }
  var file = DriveApp.getFileById(ss.getId());
  var parents = file.getParents();
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var existing = parent.getFoldersByName(BACKUP_FOLDER_NAME);
  var folder = existing.hasNext() ? existing.next() : parent.createFolder(BACKUP_FOLDER_NAME);
  props.setProperty('BACKUP_FOLDER_ID', folder.getId());
  return folder;
}

// Hapus (ke Trash) salinan di luar BACKUP_KEEP terbaru. Hanya menyentuh file berawalan BACKUP_PREFIX.
function pruneBackups_(folder) {
  var files = [];
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().indexOf(BACKUP_PREFIX) === 0) files.push(f);
  }
  files.sort(function (a, b) { return a.getName() < b.getName() ? 1 : -1; }); // nama memuat tanggal => terbaru di depan
  var removed = 0;
  for (var i = BACKUP_KEEP; i < files.length; i++) {
    files[i].setTrashed(true);
    removed++;
  }
  return removed;
}

function notifyBackupFailure_(err) {
  try {
    var emails = getProp_('ADMIN_NOTIFICATION_EMAILS').split(',').map(function (e) { return e.trim(); }).filter(Boolean);
    if (emails.length === 0) return;
    MailApp.sendEmail(
      emails.join(','),
      '[Bening Hub] Backup spreadsheet GAGAL',
      'Backup otomatis spreadsheet gagal dibuat.\n\nPesan error: ' + (err && err.message ? err.message : err) +
      '\nWaktu: ' + new Date().toString() +
      '\n\nBuka Apps Script > Executions untuk detailnya, lalu jalankan backupSpreadsheet secara manual setelah masalahnya diperbaiki.'
    );
  } catch (e) {
    // Gagal kirim email tidak boleh menutupi error aslinya.
  }
}

// Pasang jadwal mingguan (Senin sekitar pukul 02.00 sesuai zona waktu script) + jalankan 1 backup uji coba.
function installBackupTrigger() {
  removeBackupTrigger();
  ScriptApp.newTrigger('backupSpreadsheet')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(2)
    .create();
  Logger.log('Jadwal backup dipasang: tiap Senin sekitar pukul 02.00 (zona waktu: ' + Session.getScriptTimeZone() + ').');
  backupSpreadsheet();
}

function removeBackupTrigger() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'backupSpreadsheet') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  if (removed > 0) Logger.log(removed + ' jadwal backup lama dihapus.');
}
