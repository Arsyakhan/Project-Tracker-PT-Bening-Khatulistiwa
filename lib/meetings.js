// Notulensi rapat: konstanta, tanggal, tindak lanjut antar-rapat, dan pembuat teks WhatsApp / kalender.

export const MEETING_KIND = 'Rapat Mingguan';
export const DEFAULT_LOCATION = 'Ruang Rapat Utama';
export const DEFAULT_AGENDA = 'Rapat Koordinasi Mingguan & Evaluasi Progress Proyek';
export const DEFAULT_NOTES = '- Seluruh PIC wajib memperbarui progress pada sistem sebelum rapat berikutnya.';
export const DEFAULT_START = '17:00';
export const DEFAULT_END = '18:00';
export const MEETING_INTERVAL_DAYS = 14; // rapat biasanya 2 minggu sekali

export const ITEM_TYPES = ['Project Updates', 'Procurement', 'Maintenance & Operations', 'General Coordination'];
export const ATTENDANCE_STATUSES = ['Hadir', 'Izin', 'Sakit', 'Tidak Hadir'];
export const ITEM_STATUSES = ['Open', 'Selesai', 'Batal'];
export const MEETING_STATUSES = ['Terjadwal', 'Selesai'];

export const DIVISIONS = ['Director, Marketing & Commercial', 'Engineering', 'Warehouse & Purchasing'];

// Peserta tetap (sesuai template). Bisa diubah per rapat; rapat baru memakai daftar rapat sebelumnya.
export const DEFAULT_ATTENDEES = [
  { name: 'Lindawati', division: 'Director, Marketing & Commercial' },
  { name: 'Diana Santoso, S.T.', division: 'Engineering' },
  { name: 'Syafiq Khanafi Arifin, S.T.', division: 'Engineering' },
  { name: 'Mas Adi', division: 'Warehouse & Purchasing' },
  { name: 'Mbak Ira', division: 'Warehouse & Purchasing' },
];

// ---------- Tanggal (tanpa konversi zona waktu, supaya tanggal tidak bergeser) ----------
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function parseIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function toIso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayIso() {
  return toIso(new Date());
}

export function addDays(iso, n) {
  const d = parseIso(iso);
  if (!d) return '';
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function daysBetween(fromIso, toIsoStr) {
  const a = parseIso(fromIso);
  const b = parseIso(toIsoStr);
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
}

export function fmtLong(iso) {
  const d = parseIso(iso);
  return d ? `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '-';
}

export function fmtShort(iso) {
  const d = parseIso(iso);
  return d ? `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}` : '-';
}

export function fmtTimeRange(m) {
  if (!m.startTime) return '';
  const s = m.startTime.replace(':', '.');
  return m.endTime ? `${s}-${m.endTime.replace(':', '.')}` : s;
}

// ---------- Objek baru ----------
export function newId(prefix = 'it') {
  const rnd = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `${prefix}_${rnd}`;
}

export function newItem(over = {}) {
  return {
    id: newId('it'),
    topic: '',
    type: ITEM_TYPES[0],
    content: '',
    cta: '',
    pic: '',
    target: '',
    status: 'Open',
    projectId: '',
    carriedFrom: '',
    prevNote: '',
    ...over,
  };
}

// Tanggal rapat berikutnya: 14 hari setelah rapat terakhir (hari & jam yang sama), minimal hari ini.
export function suggestNextDate(meetings) {
  const last = (meetings || []).filter((m) => m.date).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!last) return todayIso();
  let next = addDays(last.date, MEETING_INTERVAL_DAYS);
  while (next < todayIso()) next = addDays(next, MEETING_INTERVAL_DAYS);
  return next;
}

// Peserta awal: daftar dari rapat terakhir (semua "Hadir"), kalau belum ada pakai peserta tetap.
export function initialAttendees(meetings) {
  const last = (meetings || []).filter((m) => (m.attendees || []).length > 0).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const base = last ? last.attendees : DEFAULT_ATTENDEES;
  return base.map((a) => ({ name: a.name, division: a.division || '', status: 'Hadir' }));
}

export function emptyMeeting(meetings, { schedule = false } = {}) {
  return {
    id: '',
    date: suggestNextDate(meetings),
    startTime: DEFAULT_START,
    endTime: DEFAULT_END,
    status: schedule ? 'Terjadwal' : 'Selesai',
    kind: MEETING_KIND,
    location: DEFAULT_LOCATION,
    agenda: DEFAULT_AGENDA,
    notes: DEFAULT_NOTES,
    nextAgenda: '',
    attendees: initialAttendees(meetings),
    items: [],
    docUrl: '',
    version: 0,
  };
}

// ---------- Tindak lanjut antar-rapat ----------
export function itemKey(meetingId, itemId) {
  return `${meetingId}:${itemId}`;
}

// Agenda yang masih "Open" dan belum dibawa ke rapat yang lebih baru.
export function computeOpenItems(meetings, excludeMeetingId) {
  const carried = new Set();
  (meetings || []).forEach((m) => (m.items || []).forEach((it) => { if (it.carriedFrom) carried.add(it.carriedFrom); }));
  const out = [];
  (meetings || [])
    .filter((m) => m.status === 'Selesai' && m.id !== excludeMeetingId)
    .forEach((m) => {
      (m.items || []).forEach((it) => {
        if (it.status === 'Open' && !carried.has(itemKey(m.id, it.id))) out.push({ meeting: m, item: it });
      });
    });
  return out.sort((a, b) => (a.meeting.date < b.meeting.date ? 1 : -1));
}

// Salin agenda lama ke rapat yang sedang dibuat (isi bahasan baru dikosongkan, isi lama jadi catatan "Sebelumnya").
export function carryItem(meeting, item) {
  const prev = [item.content, item.cta ? `-> ${item.cta}` : ''].filter(Boolean).join(' ');
  return newItem({
    topic: item.topic,
    type: item.type || ITEM_TYPES[0],
    cta: item.cta,
    pic: item.pic,
    projectId: item.projectId || '',
    carriedFrom: itemKey(meeting.id, item.id),
    prevNote: `Rapat ${fmtShort(meeting.date)}: ${prev}`.trim(),
  });
}

// ---------- Teks untuk WhatsApp ----------
function attendanceLines(attendees) {
  const by = (st) => attendees.filter((a) => a.status === st).map((a) => a.name);
  const lines = [];
  const hadir = by('Hadir');
  if (hadir.length) lines.push(`Hadir: ${hadir.join(', ')}`);
  ['Izin', 'Sakit', 'Tidak Hadir'].forEach((st) => {
    const n = by(st);
    if (n.length) lines.push(`${st}: ${n.join(', ')}`);
  });
  return lines;
}

function multiline(text, indent = '') {
  return String(text || '')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== '')
    .map((l) => indent + l)
    .join('\n');
}

// Format: *tebal* untuk WhatsApp. Satu rapat -> satu pesan siap tempel.
export function buildWhatsAppText(m, { includePrev = true, includeAttendance = true } = {}) {
  const lines = [];
  lines.push(`*Minutes of Meeting - ${fmtLong(m.date)}*`);
  const when = [m.kind, fmtTimeRange(m) ? `${fmtTimeRange(m)} WIB` : ''].filter(Boolean).join(' | ');
  if (when) lines.push(when);
  if (m.location) lines.push(`Lokasi: ${m.location}`);
  if (m.agenda) lines.push(`Agenda: ${m.agenda}`);

  if (includeAttendance && (m.attendees || []).length > 0) {
    lines.push('', '*Kehadiran*', ...attendanceLines(m.attendees));
  }

  const items = m.items || [];
  if (items.length > 0) {
    lines.push('', '*Pembahasan*');
    items.forEach((it, i) => {
      const flag = it.status === 'Selesai' ? ' (Selesai)' : it.status === 'Batal' ? ' (Dibatalkan)' : '';
      const head = `${i + 1}. *${it.topic || '(tanpa judul)'}*${it.type ? ` [${it.type}]` : ''}${flag}`;
      lines.push(head);
      if (includePrev && it.prevNote) lines.push(`   _Sebelumnya - ${it.prevNote}_`);
      if (it.content) lines.push(multiline(it.content, '   '));
      const meta = [it.cta ? `Tindak lanjut: ${it.cta}` : '', it.pic ? `PIC: ${it.pic}` : '', it.target ? `Target: ${fmtShort(it.target)}` : '']
        .filter(Boolean)
        .join(' | ');
      if (meta) lines.push(`   > ${meta}`);
    });
  }

  if (String(m.notes || '').trim()) lines.push('', '*Catatan*', multiline(m.notes));
  if (String(m.nextAgenda || '').trim()) lines.push('', '*Agenda rapat berikutnya*', multiline(m.nextAgenda));
  return lines.join('\n');
}

// Rekap semua tindak lanjut yang masih terbuka (untuk dikirim sebagai pengingat).
export function buildOpenItemsText(openItems) {
  if (openItems.length === 0) return '*Tindak lanjut rapat*\nSemua tindak lanjut sudah selesai.';
  const lines = [`*Tindak lanjut yang masih terbuka (${openItems.length})*`, `Per ${fmtLong(todayIso())}`, ''];
  openItems.forEach(({ meeting, item }, i) => {
    lines.push(`${i + 1}. *${item.topic || '(tanpa judul)'}* - rapat ${fmtShort(meeting.date)}`);
    const detail = [item.cta ? `Tindak lanjut: ${item.cta}` : '', item.pic ? `PIC: ${item.pic}` : '', item.target ? `Target: ${fmtShort(item.target)}` : '']
      .filter(Boolean)
      .join(' | ');
    if (detail) lines.push(`   > ${detail}`);
  });
  return lines.join('\n');
}

// ---------- Kalender (.ics) ----------
function icsStamp(iso, time, offsetHours) {
  const d = parseIso(iso);
  const [h, mi] = String(time || '00:00').split(':').map(Number);
  d.setHours(h - offsetHours, mi || 0, 0, 0); // WIB (UTC+7) -> UTC
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00Z`;
}

export function buildIcs(m) {
  const end = m.endTime || addHour(m.startTime || DEFAULT_START);
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bening Hub//Notulensi//ID',
    'BEGIN:VEVENT',
    `UID:${m.id || newId('mtg')}@bening-hub`,
    `DTSTAMP:${icsStamp(todayIso(), '00:00', 0)}`,
    `DTSTART:${icsStamp(m.date, m.startTime || DEFAULT_START, 7)}`,
    `DTEND:${icsStamp(m.date, end, 7)}`,
    `SUMMARY:${esc(`${m.kind || 'Rapat'} - Bening Hub`)}`,
    `LOCATION:${esc(m.location)}`,
    `DESCRIPTION:${esc(m.agenda)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function addHour(time) {
  const [h, mi] = String(time).split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(mi || 0).padStart(2, '0')}`;
}

// ---------- Unduh & salin ----------
export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob(['\ufeff', text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function whatsappLink(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function meetingFileBase(m) {
  return `MoM-${m.date || 'rapat'}`;
}

// Berapa hari lagi / yang lalu, dalam kata.
export function relativeDay(iso) {
  const d = daysBetween(todayIso(), iso);
  if (d === null) return '';
  if (d === 0) return 'hari ini';
  if (d === 1) return 'besok';
  if (d === -1) return 'kemarin';
  return d > 0 ? `${d} hari lagi` : `${Math.abs(d)} hari lalu`;
}

// Field rapat yang dikirim ke backend (tanpa id/versi/link dokumen; itu diurus terpisah).
export function meetingPayload(m) {
  return {
    date: m.date,
    startTime: m.startTime || '',
    endTime: m.endTime || '',
    status: m.status,
    kind: m.kind || '',
    location: m.location || '',
    agenda: m.agenda || '',
    notes: m.notes || '',
    nextAgenda: m.nextAgenda || '',
    attendees: (m.attendees || []).map((a) => ({ name: a.name, division: a.division || '', status: a.status || 'Hadir' })),
    items: (m.items || []).map((it) => ({ ...it })),
  };
}
