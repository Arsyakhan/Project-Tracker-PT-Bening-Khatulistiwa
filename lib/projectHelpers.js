// Helper bersama untuk halaman Semua Project, filter, tabel, dan detail project.
// Aturan di sini SAMA dengan yang dipakai AttentionPanel & dashboard.

export function isNum(v) {
  return typeof v === 'number' && !Number.isNaN(v);
}

export const SOON_DAYS = 14;

// ---- Fase (sama dengan pembagian di dashboard) ----
export const PHASES = ['Pre-Delivery', 'Delivered', 'Completed'];

export function phaseOf(p) {
  const sp = p.stageProgress;
  if (sp >= 100) return 'Completed';
  if (sp >= 90) return 'Delivered';
  return 'Pre-Delivery';
}

// ---- Kondisi khusus (dipakai sebagai filter "Kondisi") ----
export const FLAG = {
  OVERDUE: 'Terlambat',
  SOON: `Deadline ≤ ${SOON_DAYS} hari`,
  DOCGAP: 'Dokumen belum 100%',
  NODATE: 'Belum ada Delivery Date',
};

export function isOverdue(p) {
  return !!p.deliveryDate && p.stageProgress < 90 && isNum(p.daysRemaining) && p.daysRemaining < 0;
}

export function isDueSoon(p) {
  return !!p.deliveryDate && p.stageProgress < 90 && isNum(p.daysRemaining) && p.daysRemaining >= 0 && p.daysRemaining <= SOON_DAYS;
}

export function hasDocGap(p) {
  return p.stageProgress >= 90 && p.engineeringDocProgress < 100;
}

export function flagsOf(p) {
  const out = [];
  if (isOverdue(p)) out.push(FLAG.OVERDUE);
  if (isDueSoon(p)) out.push(FLAG.SOON);
  if (hasDocGap(p)) out.push(FLAG.DOCGAP);
  if (!p.deliveryDate && p.stageProgress < 90) out.push(FLAG.NODATE);
  return out;
}

// ---- Jenis teknologi (dideteksi otomatis dari nama project & kolom Technology) ----
const TECH_RULES = [
  ['RO', /\bro(?![a-z])|reverse osmosis/i],
  ['UF', /\buf(?![a-z])|ultra ?filtration/i],
  ['Mixed Bed', /mix(ed)? ?bed/i],
  ['MMF / ACF / Birm', /\bmmf(?![a-z])|multi ?media|\bacf(?![a-z])|carbon|birm/i],
  ['Softener', /softener/i],
  ['WTP / Clarifier', /\bwtp(?![a-z])|clarifier/i],
  ['Tank / FRP', /\btank\b|\bfrp\b/i],
  ['Chlorination', /chlorin/i],
  ['Kontrol / Panel', /control|panel|plc/i],
];

export function techTypes(p) {
  const text = `${p.projectName || ''} ${p.technology || ''}`;
  const found = TECH_RULES.filter(([, re]) => re.test(text)).map(([name]) => name);
  return found.length ? found : ['Lainnya'];
}

// ---- Tahun PO ----
export function yearOf(p) {
  const m = /^(\d{4})/.exec(p.tanggalPO || '');
  return m ? m[1] : 'Tanpa tanggal';
}

// ---- Tanggal ----
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// 'yyyy-mm-dd' -> '20 Okt 2026' (tanpa konversi zona waktu, supaya tanggal tidak geser)
export function fmtDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!m) return '-';
  return `${Number(m[3])} ${MONTHS_ID[Number(m[2]) - 1]} ${m[1]}`;
}

export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Petunjuk pengiriman: { text, tone } atau null
export function deliveryHint(p) {
  if (p.stageProgress >= 100) return { text: 'Selesai', tone: 'teal' };
  if (p.stageProgress >= 90) return { text: 'Terkirim', tone: 'blueprint' };
  if (!p.deliveryDate || !isNum(p.daysRemaining)) return null;
  const d = p.daysRemaining;
  if (d < 0) return { text: `Terlewat ${Math.abs(d)} hari`, tone: 'rust' };
  if (d === 0) return { text: 'Hari ini', tone: 'amber' };
  if (d <= SOON_DAYS) return { text: `${d} hari lagi`, tone: 'amber' };
  return { text: `${d} hari lagi`, tone: 'neutral' };
}

export function initialOf(str) {
  const s = String(str || '').trim();
  return s ? s.substring(0, 1).toUpperCase() : '-';
}

// 'budi.santoso@gmail.com' -> 'budi.santoso'
export function nameFromEmail(email) {
  const s = String(email || '');
  return s.includes('@') ? s.split('@')[0] : s || 'Tidak diketahui';
}

export function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, Date.now() - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'baru saja';
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
