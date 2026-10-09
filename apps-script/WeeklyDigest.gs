/**
 * BENING HUB — RINGKASAN MINGGUAN LEWAT EMAIL
 * ---------------------------------------------------
 * FILE TAMBAHAN di project Apps Script Tracker yang SAMA dengan Code.gs
 * (di editor: klik "+" di samping "Files" > Script > beri nama "WeeklyDigest").
 * Code.gs TIDAK perlu diubah, dan web app TIDAK perlu di-deploy ulang.
 * Syarat: fitur Notulensi (Code.gs v2.4) dan Pengadaan (file "Procurement") sudah terpasang.
 *
 * Tiap Senin pagi (sekitar 07.00) email berisi:
 *   - rapat berikutnya
 *   - project terlambat, deadline <= 14 hari, dan dokumen engineering yang kurang
 *   - tindak lanjut rapat yang masih terbuka (yang target-nya lewat di atas)
 *   - material yang belum datang (yang terlambat di atas)
 *   - teks siap tempel ke WhatsApp
 *
 * SETUP (sekali saja):
 *   1. Project Settings (ikon roda gigi) > Script Properties > tambah
 *        DIGEST_EMAILS = email1@x.com,email2@x.com     (penerima email mingguan)
 *      Kalau tidak diisi, dipakai ADMIN_NOTIFICATION_EMAILS.
 *      (Opsional) APP_URL = https://alamat-web-anda.vercel.app  -> email memuat tombol "Buka Bening Hub".
 *   2. Pilih fungsi `sendDigestPreviewToMe` > Run > izinkan akses. Email pratinjau hanya dikirim ke akun
 *      Anda sendiri. Cek tampilannya.
 *   3. Pilih fungsi `installDigestTrigger` > Run. Jadwal Senin ~07.00 terpasang.
 *
 * Mau berhenti? Jalankan `removeDigestTrigger`. Mau kirim sekarang ke semua penerima? Jalankan `sendWeeklyDigest`.
 * Email tetap dikirim walau semuanya aman (supaya Anda tahu sistemnya hidup). Ubah DIGEST_SKIP_IF_EMPTY
 * menjadi true kalau ingin email hanya dikirim saat ada yang perlu perhatian.
 */

var DIGEST_SKIP_IF_EMPTY = false;
var DIGEST_MAX_ROWS = 8;        // maksimal baris per bagian di email; sisanya ditulis "dan N lainnya"
var DIGEST_SOON_DAYS = 14;      // batas "deadline dekat" untuk project
var DIGEST_MAT_SOON_DAYS = 7;   // batas "segera tiba" untuk material

var DIGEST_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
var DIGEST_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
var DIGEST_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// ---------- Entry points ----------
// Dipanggil trigger tiap Senin.
function sendWeeklyDigest() {
  return sendDigest_(digestRecipients_(), '');
}

// Uji coba: kirim HANYA ke akun pemilik script.
function sendDigestPreviewToMe() {
  var me = Session.getEffectiveUser().getEmail();
  if (!me) throw new Error('Tidak bisa membaca email akun Anda. Kirim lewat sendWeeklyDigest setelah DIGEST_EMAILS diisi.');
  return sendDigest_([me], '[PRATINJAU] ');
}

function installDigestTrigger() {
  removeDigestTrigger();
  ScriptApp.newTrigger('sendWeeklyDigest')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(7)
    .create();
  Logger.log('Jadwal ringkasan mingguan dipasang: tiap Senin sekitar pukul 07.00 (zona waktu: ' + Session.getScriptTimeZone() + ').');
}

function removeDigestTrigger() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendWeeklyDigest') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  if (removed > 0) Logger.log(removed + ' jadwal ringkasan lama dihapus.');
}

function digestRecipients_() {
  var raw = getProp_('DIGEST_EMAILS') || getProp_('ADMIN_NOTIFICATION_EMAILS');
  var list = raw.split(',').map(function (e) { return e.trim(); }).filter(Boolean);
  if (list.length === 0) {
    throw new Error('Penerima belum diatur. Isi DIGEST_EMAILS di Project Settings > Script Properties.');
  }
  return list;
}

// ---------- Pengumpulan data ----------
function digestToday_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function digestParse_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function digestDaysFrom_(todayIso, iso) {
  var a = digestParse_(todayIso), b = digestParse_(iso);
  return a && b ? Math.round((b - a) / 86400000) : null;
}

function digestLong_(iso) {
  var d = digestParse_(iso);
  return d ? DIGEST_DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + DIGEST_MONTHS[d.getMonth()] + ' ' + d.getFullYear() : '-';
}

function digestShort_(iso) {
  var d = digestParse_(iso);
  return d ? d.getDate() + ' ' + DIGEST_MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear() : '-';
}

function digestCollect_() {
  var today = digestToday_();
  var projects = getProjects_();
  var meetings = getMeetings_();
  var procurement = getProcurement_();
  var nameById = {};
  projects.forEach(function (p) { nameById[p.id] = p.projectName; });

  // --- Project ---
  var isNum = function (v) { return typeof v === 'number' && !isNaN(v); };
  var late = projects.filter(function (p) { return p.deliveryDate && p.stageProgress < 90 && isNum(p.daysRemaining) && p.daysRemaining < 0; })
    .sort(function (a, b) { return a.daysRemaining - b.daysRemaining; });
  var soon = projects.filter(function (p) { return p.deliveryDate && p.stageProgress < 90 && isNum(p.daysRemaining) && p.daysRemaining >= 0 && p.daysRemaining <= DIGEST_SOON_DAYS; })
    .sort(function (a, b) { return a.daysRemaining - b.daysRemaining; });
  var docGap = projects.filter(function (p) { return p.stageProgress >= 90 && p.engineeringDocProgress < 100; })
    .sort(function (a, b) { return a.engineeringDocProgress - b.engineeringDocProgress; });

  // --- Tindak lanjut rapat yang masih terbuka (sama dengan aturan di web) ---
  var carried = {};
  meetings.forEach(function (m) { (m.items || []).forEach(function (it) { if (it.carriedFrom) carried[it.carriedFrom] = true; }); });
  var openItems = [];
  meetings.filter(function (m) { return m.status === 'Selesai'; }).forEach(function (m) {
    (m.items || []).forEach(function (it) {
      if (it.status === 'Open' && !carried[m.id + ':' + it.id]) openItems.push({ meeting: m, item: it });
    });
  });
  var itemRank = function (x) { return x.item.target ? (x.item.target < today ? 0 : 1) : 2; };
  openItems.sort(function (a, b) {
    return itemRank(a) - itemRank(b) || String(a.item.target || '9999').localeCompare(String(b.item.target || '9999'));
  });

  // --- Material ---
  var OPEN = ['Perlu dibeli', 'Sudah order', 'Dalam pengiriman', 'Tiba sebagian'];
  var mats = procurement.filter(function (i) { return OPEN.indexOf(i.status) > -1; }).map(function (i) {
    var days = i.eta ? digestDaysFrom_(today, i.eta) : null;
    var state = days === null ? 'none' : days < 0 ? 'late' : days <= DIGEST_MAT_SOON_DAYS ? 'soon' : 'ok';
    return { it: i, days: days, state: state };
  });
  var matRank = { late: 0, soon: 1, ok: 2, none: 3 };
  mats.sort(function (a, b) {
    return matRank[a.state] - matRank[b.state] || String(a.it.eta || '9999').localeCompare(String(b.it.eta || '9999'));
  });

  // --- Rapat berikutnya ---
  var next = meetings.filter(function (m) { return m.status === 'Terjadwal' && m.date >= today; })
    .sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0] || null;

  return { today: today, late: late, soon: soon, docGap: docGap, openItems: openItems, mats: mats, next: next, nameById: nameById };
}

// ---------- Penyusunan bagian ----------
function digestSections_(d) {
  var sections = [];
  function add(title, tone, rows) {
    if (rows.length === 0) return;
    sections.push({ title: title, tone: tone, total: rows.length, rows: rows.slice(0, DIGEST_MAX_ROWS), more: Math.max(0, rows.length - DIGEST_MAX_ROWS) });
  }

  add('Project terlambat', 'bad', d.late.map(function (p) {
    return { head: p.projectName, sub: 'Delivery ' + digestShort_(p.deliveryDate) + ' (terlewat ' + Math.abs(p.daysRemaining) + ' hari) · ' + p.currentStage };
  }));
  add('Deadline delivery <= ' + DIGEST_SOON_DAYS + ' hari', 'warn', d.soon.map(function (p) {
    return { head: p.projectName, sub: 'Delivery ' + digestShort_(p.deliveryDate) + ' (' + p.daysRemaining + ' hari lagi) · ' + p.currentStage };
  }));
  add('Material belum datang', d.mats.some(function (m) { return m.state === 'late'; }) ? 'bad' : 'warn', d.mats.map(function (m) {
    var i = m.it;
    var who = i.projectId && d.nameById[i.projectId] ? d.nameById[i.projectId] : (i.forLabel ? 'Untuk ' + i.forLabel : '');
    var eta = m.state === 'none' ? 'ETA belum ada' : m.state === 'late' ? 'ETA ' + digestShort_(i.eta) + ' (terlambat ' + Math.abs(m.days) + ' hari)' : 'ETA ' + digestShort_(i.eta);
    return { head: i.item + (i.qty ? ' (' + i.qty + ')' : ''), sub: [who, i.vendor, i.status, eta].filter(Boolean).join(' · ') };
  }));
  add('Tindak lanjut rapat yang masih terbuka', d.openItems.some(function (x) { return x.item.target && x.item.target < d.today; }) ? 'bad' : 'warn', d.openItems.map(function (x) {
    var it = x.item;
    var late = it.target && it.target < d.today;
    var sub = ['Rapat ' + digestShort_(x.meeting.date), it.pic, it.cta, it.target ? 'Target ' + digestShort_(it.target) + (late ? ' (lewat)' : '') : ''].filter(Boolean).join(' · ');
    return { head: it.topic || '(tanpa judul)', sub: sub };
  }));
  add('Dokumen engineering belum lengkap', 'warn', d.docGap.map(function (p) {
    return { head: p.projectName, sub: 'Dokumen ' + p.engineeringDocProgress + '% · ' + p.currentStage };
  }));
  return sections;
}

function digestEsc_(s) {
  return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Teks untuk WhatsApp (*tebal*, "> " = kutipan)
function digestWhatsApp_(d, sections) {
  var lines = ['*Ringkasan mingguan Bening Hub*', digestLong_(d.today)];
  if (d.next) lines.push('', '*Rapat berikutnya*', digestLong_(d.next.date) + (d.next.startTime ? ', ' + d.next.startTime.replace(':', '.') + ' WIB' : '') + (d.next.location ? ' - ' + d.next.location : ''));
  if (sections.length === 0) {
    lines.push('', 'Tidak ada yang perlu perhatian minggu ini.');
    return lines.join('\n');
  }
  sections.forEach(function (s) {
    lines.push('', '*' + s.title + ' (' + s.total + ')*');
    s.rows.forEach(function (r, i) { lines.push((i + 1) + '. ' + r.head, '   > ' + r.sub); });
    if (s.more > 0) lines.push('   dan ' + s.more + ' lainnya');
  });
  return lines.join('\n');
}

function digestHtml_(d, sections, wa, prefix) {
  var color = { bad: '#C0392B', warn: '#B7791F' };
  var appUrl = getProp_('APP_URL');
  var h = [];
  h.push('<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#0C2D48;line-height:1.45">');
  h.push('<h2 style="margin:0 0 4px;font-size:20px">' + digestEsc_(prefix) + 'Ringkasan mingguan Bening Hub</h2>');
  h.push('<p style="margin:0 0 16px;color:#5B7A91;font-size:13px">' + digestEsc_(digestLong_(d.today)) + '</p>');

  if (d.next) {
    h.push('<div style="border-left:4px solid #0077B6;background:#F2F8FB;padding:10px 14px;margin:0 0 18px;border-radius:4px">' +
      '<div style="font-size:12px;color:#5B7A91">Rapat berikutnya</div>' +
      '<div style="font-size:15px;font-weight:bold">' + digestEsc_(digestLong_(d.next.date)) + '</div>' +
      '<div style="font-size:13px;color:#5B7A91">' + digestEsc_([d.next.startTime ? d.next.startTime.replace(':', '.') + ' WIB' : '', d.next.location].filter(Boolean).join(' · ')) + '</div></div>');
  }

  if (sections.length === 0) {
    h.push('<p style="font-size:15px;color:#1E7F5C"><b>Semua aman.</b> Tidak ada project terlambat, material tertunda, atau tindak lanjut rapat yang terbuka.</p>');
  }
  sections.forEach(function (s) {
    h.push('<h3 style="margin:20px 0 8px;font-size:15px;color:' + color[s.tone] + '">' + digestEsc_(s.title) + ' (' + s.total + ')</h3>');
    h.push('<ul style="margin:0;padding:0;list-style:none">');
    s.rows.forEach(function (r) {
      h.push('<li style="padding:8px 0;border-bottom:1px solid #E3EAEC"><div style="font-size:14px;font-weight:bold">' + digestEsc_(r.head) +
        '</div><div style="font-size:12px;color:#5B7A91">' + digestEsc_(r.sub) + '</div></li>');
    });
    h.push('</ul>');
    if (s.more > 0) h.push('<p style="margin:6px 0 0;font-size:12px;color:#5B7A91">dan ' + s.more + ' lainnya di Bening Hub.</p>');
  });

  if (appUrl) {
    h.push('<p style="margin:24px 0 0"><a href="' + digestEsc_(appUrl) + '" style="background:#0077B6;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:bold">Buka Bening Hub</a></p>');
  }
  h.push('<h3 style="margin:28px 0 6px;font-size:13px;color:#5B7A91">Versi teks untuk WhatsApp (salin dan tempel)</h3>');
  h.push('<pre style="white-space:pre-wrap;word-break:break-word;background:#F5F7FA;border:1px solid #E3EAEC;border-radius:6px;padding:12px;font-size:12px;font-family:Consolas,Menlo,monospace">' + digestEsc_(wa) + '</pre>');
  h.push('<p style="margin:20px 0 0;font-size:11px;color:#8AA2B3">Email otomatis dari Bening Hub. Ubah penerima di Script Properties (DIGEST_EMAILS).</p>');
  h.push('</div>');
  return h.join('');
}

// ---------- Kirim ----------
function sendDigest_(recipients, prefix) {
  var d = digestCollect_();
  var sections = digestSections_(d);
  var needAttention = sections.reduce(function (n, s) { return n + s.total; }, 0);

  if (sections.length === 0 && DIGEST_SKIP_IF_EMPTY && !prefix) {
    Logger.log('Tidak ada yang perlu perhatian dan DIGEST_SKIP_IF_EMPTY = true, email tidak dikirim.');
    return { sent: 0, items: 0 };
  }

  var wa = digestWhatsApp_(d, sections);
  var subject = prefix + '[Bening Hub] Ringkasan mingguan - ' + digestLong_(d.today);
  MailApp.sendEmail({
    to: recipients.join(','),
    subject: subject,
    body: wa.replace(/\*/g, ''),               // versi teks polos untuk klien email tanpa HTML
    htmlBody: digestHtml_(d, sections, wa, prefix),
    name: 'Bening Hub'
  });

  if (!prefix) {
    logActivity_('Sistem', 'Ringkasan mingguan', '', '', 'Ringkasan mingguan',
      'Dikirim ke ' + recipients.length + ' penerima; ' + needAttention + ' butir perlu perhatian');
  }
  Logger.log('Email terkirim ke: ' + recipients.join(', ') + ' (' + needAttention + ' butir perlu perhatian).');
  return { sent: recipients.length, items: needAttention, subject: subject };
}
