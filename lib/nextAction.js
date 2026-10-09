// Ringkasan "langkah berikutnya" satu project untuk tabel, kartu HP, dan papan kanban.
// Semua fungsi di sini MURNI (tanpa React) supaya mudah diuji. Aturan jatuh tempo sama dengan lib/today.js.
import { daysBetween, todayIso } from './meetings';

export const NEXT_SOON_DAYS = 7;

// Mengembalikan null kalau tidak perlu ditampilkan: project sudah selesai, atau backend belum v2.6
// (kolom belum ada, jadi jangan menagih).
export function nextActionInfo(p, today = todayIso()) {
  if (!p || p.status === 'Completed' || p.stageProgress >= 100) return null;
  if (p.nextAction === undefined) return null;
  const blocked = !!p.blocker;
  const blockedDays = blocked && p.blockedSince ? Math.max(daysBetween(p.blockedSince, today) ?? 0, 0) : null;
  const dueDays = p.nextActionDue ? daysBetween(today, p.nextActionDue) : null;
  return {
    blocked,
    blocker: p.blocker || '',
    blockedDays,
    action: p.nextAction || '',
    owner: p.nextActionOwner || '',
    due: p.nextActionDue || '',
    dueDays,
    tone: dueDays === null ? 'neutral' : dueDays < 0 ? 'rust' : dueDays <= NEXT_SOON_DAYS ? 'amber' : 'neutral',
    empty: !blocked && !p.nextAction,
  };
}

export function dueText(dueDays) {
  if (dueDays === null || dueDays === undefined) return '';
  if (dueDays < 0) return `Lewat ${Math.abs(dueDays)} hari`;
  if (dueDays === 0) return 'Hari ini';
  return `${dueDays} hari lagi`;
}

// Kunci urut kolom "Langkah berikutnya": yang terhambat dulu (paling lama menunggu di atas),
// lalu tanggal paling dekat, lalu yang tanpa tanggal. Yang kosong (null) selalu di bawah.
// Awalan HURUF (bukan angka) sengaja: tabel mengurutkan dengan localeCompare numeric, yang akan
// membaca "0..." dan "1..." sebagai bilangan dan mengacaukan urutan.
export function nextActionSortKey(p, today = todayIso()) {
  const info = nextActionInfo(p, today);
  if (!info || info.empty) return null;
  if (info.blocked) return `a${p.blockedSince || '9999-12-31'}`;
  if (info.due) return `b${info.due}`;
  return 'c';
}
