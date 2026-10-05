// Pengadaan material: status, tenggat (ETA), pengelompokan per project, dan teks WhatsApp.
import { todayIso, daysBetween, fmtShort, fmtLong } from './meetings';

export const PROC_STATUSES = ['Perlu dibeli', 'Sudah order', 'Dalam pengiriman', 'Tiba sebagian', 'Diterima', 'Batal'];
// Barang yang masih ditunggu / belum selesai ditangani
export const OPEN_STATUSES = ['Perlu dibeli', 'Sudah order', 'Dalam pengiriman', 'Tiba sebagian'];
export const SHIPMENT_OPTIONS = ['Lokal', 'Kurir / DHL', 'Sea freight', 'Air freight', 'Diambil sendiri'];
export const SOON_DAYS = 7;

export const isOpen = (it) => OPEN_STATUSES.includes(it.status);

// { state: 'late' | 'soon' | 'ok' | 'none', days }  days = selisih hari ETA dari hari ini (negatif = lewat)
export function etaState(it, today = todayIso()) {
  if (!it.eta) return { state: 'none', days: null };
  const days = daysBetween(today, it.eta);
  if (days === null) return { state: 'none', days: null };
  if (isOpen(it) && days < 0) return { state: 'late', days };
  if (isOpen(it) && days <= SOON_DAYS) return { state: 'soon', days };
  return { state: 'ok', days };
}

export function etaText(it, today = todayIso()) {
  const { state, days } = etaState(it, today);
  if (state === 'none') return '';
  if (!isOpen(it)) return fmtShort(it.eta);
  if (state === 'late') return `Terlambat ${Math.abs(days)} hari`;
  if (days === 0) return 'Hari ini';
  if (days === 1) return 'Besok';
  return `${days} hari lagi`;
}

export function statusTone(status) {
  if (status === 'Diterima') return 'teal';
  if (status === 'Batal') return 'neutral';
  if (status === 'Dalam pengiriman' || status === 'Tiba sebagian') return 'blueprint';
  if (status === 'Sudah order') return 'blueprint';
  return 'amber'; // Perlu dibeli
}

// Urutan "paling mendesak dulu": terlambat (paling lama dulu), lalu ETA terdekat, lalu tanpa ETA.
export function urgencySort(a, b) {
  const rank = (it) => { const s = etaState(it).state; return s === 'late' ? 0 : s === 'soon' ? 1 : s === 'ok' ? 2 : 3; };
  return rank(a) - rank(b) || String(a.eta || '9999').localeCompare(String(b.eta || '9999')) || String(a.item).localeCompare(String(b.item));
}

export function emptyItem(projectId = '') {
  return {
    id: '', projectId, forLabel: '', item: '', qty: '', vendor: '', status: 'Perlu dibeli',
    orderDate: '', eta: '', receivedDate: '', shipment: '', poRef: '', notes: '', version: 0,
  };
}

export function itemPayload(it) {
  return {
    projectId: it.projectId || '',
    forLabel: it.forLabel || '',
    item: it.item,
    qty: it.qty || '',
    vendor: it.vendor || '',
    status: it.status,
    orderDate: it.orderDate || '',
    eta: it.eta || '',
    receivedDate: it.receivedDate || '',
    shipment: it.shipment || '',
    poRef: it.poRef || '',
    notes: it.notes || '',
  };
}

// Kelompokkan per project (atau "Untuk: ..." / "Tanpa project"); kelompok yang punya barang terlambat di depan.
export function groupItems(items, projectsById) {
  const map = new Map();
  items.forEach((it) => {
    const project = it.projectId ? projectsById[it.projectId] : null;
    const key = it.projectId || `for:${it.forLabel || ''}`;
    const title = project ? project.projectName : it.projectId ? '(project tidak ditemukan)' : it.forLabel ? `Untuk: ${it.forLabel}` : 'Tanpa project';
    if (!map.has(key)) map.set(key, { key, title, projectId: project ? it.projectId : '', items: [] });
    map.get(key).items.push(it);
  });
  const groups = Array.from(map.values());
  groups.forEach((g) => g.items.sort(urgencySort));
  const lateCount = (g) => g.items.filter((i) => etaState(i).state === 'late').length;
  groups.sort((a, b) => lateCount(b) - lateCount(a) || a.title.localeCompare(b.title, 'id'));
  return groups;
}

// Rekap barang yang belum datang, siap tempel ke WhatsApp.
export function buildProcurementText(items, projectsById) {
  const open = items.filter(isOpen);
  if (open.length === 0) return '*Pengadaan material*\nTidak ada barang yang sedang ditunggu.';
  const lines = [`*Material yang belum datang (${open.length})*`, `Per ${fmtLong(todayIso())}`];
  groupItems(open, projectsById).forEach((g) => {
    lines.push('', `*${g.title}*`);
    g.items.forEach((it, i) => {
      const eta = it.eta ? `ETA ${fmtShort(it.eta)}${etaState(it).state === 'late' ? ` (${etaText(it)})` : ''}` : 'ETA belum ada';
      const head = `${i + 1}. ${it.item}${it.qty ? ` (${it.qty})` : ''}`;
      const meta = [it.vendor, it.status, eta].filter(Boolean).join(' | ');
      lines.push(head, `   > ${meta}`);
      if (it.notes) lines.push(`   ${String(it.notes).split('\n')[0]}`);
    });
  });
  return lines.join('\n');
}
