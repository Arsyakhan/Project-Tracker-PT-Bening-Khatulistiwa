/**
 * BENING HUB — IMPOR DATA AWAL NOTULENSI (sekali jalan)
 * ---------------------------------------------------
 * FILE TAMBAHAN di project Apps Script Tracker yang SAMA dengan Code.gs
 * (di editor: klik "+" di samping "Files" > Script > beri nama "Seed-Meetings").
 * Code.gs TIDAK perlu diubah. Syarat: Code.gs v2.4 (fitur Meetings) sudah terpasang.
 *
 * Memasukkan 2 rapat dari MoM WhatsApp:
 *   - 21 Agustus 2026 (13 agenda)  -> status agenda semuanya "Selesai" (riwayat; tindak lanjutnya sudah masuk 11 Sep)
 *   - 11 September 2026 (15 agenda) -> status agenda "Open" (jadi daftar tindak lanjut terbuka)
 * Agenda 11 Sep yang merupakan lanjutan agenda 21 Agu otomatis tertaut ("Sebelumnya: ...").
 *
 * CARA PAKAI: pilih fungsi `importHistoricalMeetings` > Run. Aman dijalankan ulang:
 * rapat yang tanggalnya sudah ada di sheet "Meetings" dilewati, tidak dobel.
 *
 * SETELAH DIIMPOR, mohon dicek di web (Dokumen > Notulensi Rapat):
 *   - Jam rapat 21 Agu dan daftar peserta 21 Agu dikosongkan karena tidak ada di MoM.
 *   - Beberapa agenda 11 Sep mungkin sudah selesai sekarang -> klik "Tandai selesai" di daftar tindak lanjut.
 *   - PIC diisi hanya kalau namanya disebut jelas di MoM; sisanya kosong.
 */

function importHistoricalMeetings() {
  return withLock_(function () {
    var existing = getMeetings_();
    var hasDate = function (d) { return existing.some(function (m) { return m.date === d; }); };
    var log = [];

    // ---------- 21 Agustus 2026 ----------
    var aug = null;
    if (hasDate('2026-08-21')) {
      aug = existing.filter(function (m) { return m.date === '2026-08-21'; })[0];
      log.push('21 Agu 2026: sudah ada, dilewati.');
    } else {
      aug = saveMeeting_({
        user: 'Import data awal',
        date: '2026-08-21', startTime: '', endTime: '', status: 'Selesai',
        kind: 'Rapat Mingguan', location: 'Ruang Rapat Utama',
        agenda: 'Rapat Koordinasi Mingguan & Evaluasi Progress Proyek',
        notes: '', nextAgenda: '',
        attendees: [],
        items: augItems_()
      });
      log.push('21 Agu 2026: dibuat (' + aug.items.length + ' agenda).');
    }

    // ---------- 11 September 2026 ----------
    if (hasDate('2026-09-11')) {
      log.push('11 Sep 2026: sudah ada, dilewati.');
    } else {
      var sep = saveMeeting_({
        user: 'Import data awal',
        date: '2026-09-11', startTime: '17:00', endTime: '18:00', status: 'Selesai',
        kind: 'Rapat Mingguan', location: 'Ruang Rapat Utama',
        agenda: 'Rapat Koordinasi Mingguan & Evaluasi Progress Proyek',
        notes: '- Seluruh PIC wajib memperbarui progress pada sistem sebelum rapat berikutnya.',
        nextAgenda: '- Peninjauan hasil pengadaan barang dan update jadwal pelaksanaan lapangan.',
        attendees: [
          { name: 'Lindawati', division: 'Director, Marketing & Commercial', status: 'Hadir' },
          { name: 'Diana Santoso, S.T.', division: 'Engineering', status: 'Hadir' },
          { name: 'Syafiq Khanafi Arifin, S.T.', division: 'Engineering', status: 'Hadir' },
          { name: 'Mas Adi', division: 'Warehouse & Purchasing', status: 'Hadir' },
          { name: 'Mbak Ira', division: 'Warehouse & Purchasing', status: 'Hadir' }
        ],
        items: sepItems_(aug)
      });
      log.push('11 Sep 2026: dibuat (' + sep.items.length + ' agenda).');
    }

    Logger.log(log.join('\n'));
    return log;
  });
}

// Tautan "lanjutan": agenda 11 Sep -> agenda 21 Agu (id agenda 21 Agu = aug_xx di bawah).
function carry_(aug, augItemId) {
  if (!aug || !aug.id) return {};
  var src = aug.items.filter(function (i) { return i.id === augItemId; })[0];
  if (!src) return {};
  var prev = [src.content, src.cta ? '-> ' + src.cta : ''].filter(Boolean).join(' ');
  return { carriedFrom: aug.id + ':' + augItemId, prevNote: ('Rapat 21 Agu 2026: ' + prev).substring(0, 950) };
}

function mk_(id, topic, type, content, cta, pic, target, status, extra) {
  var o = { id: id, topic: topic, type: type, content: content, cta: cta, pic: pic, target: target, status: status };
  if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
  return o;
}

var PU = 'Project Updates', PR = 'Procurement', MO = 'Maintenance & Operations', GC = 'General Coordination';

function augItems_() {
  var S = 'Selesai';
  return [
    mk_('aug_01', 'Unilever Savory - CIP Job', PU, 'BOQ untuk CIP Job sudah diemail oleh Diana.', '', 'Diana', '', S),
    mk_('aug_02', 'Uni Skin', PU, 'Outstanding sticker. Masalah electrical akan disampaikan Mba Linda ke Pa Supri. Skin akan order media RO 1 dan 2, dan FRP tank.', 'Senin: Adi follow up sticker', 'Mas Adi, Mba Linda', '', S),
    mk_('aug_03', 'ISA', PU, 'Gasket sudah ada. Victaulic coupling akan di H/C.', '', '', '', S),
    mk_('aug_04', 'GAL', PU, 'Harus diputuskan metode pengiriman (shipment) UF, supaya Excel tidak menunggu terlalu lama.', 'Putuskan shipment method UF', '', '', S),
    mk_('aug_05', 'PO TKE RO 35 dan 40 TPH', PR, 'SS fittings dan panel sudah ready. ROPP sudah order Jumat 21 Agu 2026, estimasi tiba 25 Sep 2026. Fitting sudah didiskusikan, tinggal diputuskan beli di mana. Komponen listrik harus sudah dibeli.', 'Senin: ingatkan Adi follow up skid CAP dan Tanimas', 'Mas Adi', '', S),
    mk_('aug_06', 'PO Excel MMF dan UF membrane', PU, 'Diana mengatur teknisi tanggal 26 Agu untuk hydro test tank (BJ). Kunjungan berikutnya pasang nozzle (estimasi 31 Agu 2026). Diatur pengiriman frontal piping.', 'Hydro test tank 26 Agu; pasang nozzle ~31 Agu', 'Diana', '2026-08-31', S, { projectId: 'prj_9ffbf262674c' }),
    mk_('aug_07', 'Statomer UF replacement dan modification', PU, 'Costing upgrade DI Plant dari 15 ke 20 TPH jangan sampai terlambat dibuat.', 'Buat costing upgrade DI Plant 15 -> 20 TPH', '', '', S, { projectId: 'prj_5b6b3663cb6f' }),
    mk_('aug_08', 'Mesin pemanas', PR, 'Pending dulu.', '', '', '', S),
    mk_('aug_09', 'Monitoring pembelian procon pump, membrane Keensen, dll', PR, 'Pembelian yang diminta Adi dimonitor lewat reminder ke Mr. Chia via email setiap minggu.', 'Reminder Mr. Chia via email tiap minggu', 'Mas Adi', '', S),
    mk_('aug_10', 'Pump CIP untuk Sago', PR, 'Mempertimbangkan merk Grundfos.', '', '', '', S),
    mk_('aug_11', 'Sumitomo Cleaning', MO, 'Diana menjadwalkan 26-28 Agu 2026 (Tatak dan Kris).', '', 'Diana', '2026-08-28', S),
    mk_('aug_12', 'Pa Herman', MO, 'Segera cleaning UF ex Pa Herman untuk Eterhard.', 'Cleaning UF ex Pa Herman', '', '', S),
    mk_('aug_13', 'Aquamatic outstanding order', PR, 'Outstanding order Aquamatic.', 'Bikin list ke Mr. Chia', '', '', S)
  ];
}

function sepItems_(aug) {
  var O = 'Open';
  return [
    mk_('sep_01', 'Unilever Savory - CIP room', PU,
      'Survei Selasa 15/09/26 (Diana, Syafiq, Tatak). Scope berubah menjadi all SS 316; ukuran tank dihitung hari Selasa, pastikan volume air yang dibutuhkan, chlorine level, dan pompa yang dibutuhkan. Ada penalty. Target delivery Januari/Februari 2027, selesai commissioning April 2027.',
      'Survei, hitung tank; bawa chlorine test kit', 'Diana, Syafiq, Tatak', '2026-09-15', O, carry_(aug, 'aug_01')),
    mk_('sep_02', 'Uni Skin', PU,
      'Sticker baru payment; akan dikirim sekalian dengan check valve, dan bawa pulang ball valve.',
      'Kirim sticker + check valve; bawa pulang ball valve', '', '', O, carry_(aug, 'aug_02')),
    mk_('sep_03', 'GAL', PU,
      'PO GAL masih belum turun. Kemungkinan ada PO juga untuk ganti UF untuk LNK Tanjung Keliling dan KIU. Masih ada outstanding 2 unit UF ke Excel.',
      'Pantau turunnya PO GAL', '', '', O, carry_(aug, 'aug_04')),
    mk_('sep_04', 'TKE remaining order (CAP, MUS, BMM, Tanimas)', PR,
      'Perkiraan tanggal pickup: CAP RO 30 TPH 10 Okt (kalau mereka OK ganti CNP, 90% kemungkinan pakai CNP). MUS RO 40 TPH sekitar 20 Okt (skid sudah jadi). BMM RO 35 TPH November/Desember (skid sudah jadi). Tanimas RO 20 TPH Desember. ROPP untuk MUS dan BMM sudah ready tetapi biaya freight sangat tinggi.',
      'Tunggu freight cost dari ROPP untuk dibandingkan', 'Mba Linda', '2026-10-10', O, carry_(aug, 'aug_05')),
    mk_('sep_05', 'PO Excel MMF dan UF membrane', PU,
      'MMF target selesai hari Senin 14/9/26.',
      'Selesaikan MMF', 'Diana', '2026-09-14', O, (function () { var c = carry_(aug, 'aug_06'); c.projectId = 'prj_9ffbf262674c'; return c; })()),
    mk_('sep_06', 'Statomer UF replacement dan modification', PU,
      'Setelah DHL datang, Diana harus menyiapkan man power.',
      'Siapkan man power setelah DHL tiba', 'Diana', '', O, (function () { var c = carry_(aug, 'aug_07'); c.projectId = 'prj_5b6b3663cb6f'; return c; })()),
    mk_('sep_07', 'PGI Pontianak', PU,
      'Jhonson dan Isnawan berangkat Selasa 15/9/26 untuk instalasi.',
      'Instalasi di PGI Pontianak', 'Jhonson, Isnawan', '2026-09-15', O),
    mk_('sep_08', 'Mesin pemanas', PR,
      'Sudah harus dibeli.',
      'Beli mesin pemanas', '', '', O, carry_(aug, 'aug_08')),
    mk_('sep_09', 'Monitoring pembelian procon pump, membrane Keensen, dll', PR,
      'Mr. Chia sudah mau sea shipment. Membrane Keensen sudah ready, tetapi Jenny akan memberi Mba Linda dokumen import untuk diperiksa. Estimasi akhir September sudah bisa diterima.',
      'Periksa dokumen import dari Jenny', 'Mba Linda', '2026-09-30', O, carry_(aug, 'aug_09')),
    mk_('sep_10', 'Pump CIP untuk Sago', PR,
      'Sudah DP.',
      '', '', '', O, carry_(aug, 'aug_10')),
    mk_('sep_11', 'Pa Herman', GC,
      'Sudah tidak di Unilever, tetapi untuk sementara kita masih akan support Pa Herman.',
      '', '', '', O, carry_(aug, 'aug_12')),
    mk_('sep_12', 'Aquamatic outstanding order', PR,
      'Order Excel sudah dimasukkan oleh Adi; untuk HPCL harus di-include juga.',
      'Masukkan order HPCL', 'Mas Adi', '', O, carry_(aug, 'aug_13')),
    mk_('sep_13', 'DHA (Dumai Hijau Abadi)', PR,
      'Ada outstanding flowmeter yang harus dikirim. Adi cek merk Pilemon yang harganya masuk.',
      'Cek merk Pilemon yang harganya masuk', 'Mas Adi', '', O),
    mk_('sep_14', 'Summary UF membrane', PR,
      'Adi harus memberi summary UF membrane dari beberapa maker dan input mana yang equivalent.',
      'Buat summary UF membrane + equivalent', 'Mas Adi', '', O),
    mk_('sep_15', 'Unilever HPCL', MO,
      'Penggantian resin demin dan mixed bed, filter nozzle, Sabtu dan Minggu ini, dengan catatan PO belum ada sampai hari ini. Scope kita supply dan supervisi saja. Kalau jadi, saat ke sana bawa spare filter nozzle di luar qty yang diorder.',
      'Pastikan PO; bawa spare filter nozzle', '', '', O)
  ];
}
