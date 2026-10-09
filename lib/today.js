// Halaman "Hari Ini": kumpulkan semua hal yang perlu ditindak dari project, pengadaan, rapat, dan dokumen,
// lalu urutkan dari yang paling mendesak. Semua fungsi di sini MURNI (tanpa React) supaya mudah diuji.
import { daysBetween, todayIso } from './meetings';
import { etaState, etaText, isOpen as isProcOpen } from './procurement';

export const DIVISIONS = ['Marketing & Direksi', 'Engineering', 'Warehouse & Purchasing', 'Technician'];

// Siapa yang memegang "bola" untuk tiap stage (mengikuti swimlane alur project PT Bening).
// Ubah di sini kalau pembagian kerjanya berbeda.
export const STAGE_OWNER = {
  'PO': 'Marketing & Direksi',
  'SOS': 'Marketing & Direksi',
  'BOM, PID, EWD, GAD': 'Engineering',
  'Review & Approval': 'Engineering',
  'Procurement of Material': 'Warehouse & Purchasing',
  'Collecting Material / Inspection': 'Warehouse & Purchasing',
  'Fabrication': 'Technician',
  'Delivery': 'Warehouse & Purchasing',
  'Installation': 'Technician',
  'Commissioning': 'Technician',
  'Preparation Manual Book': 'Engineering',
  'Hand Over and Finished': 'Engineering',
};

export const SEVERITY = {
  0: { key: 'late', title: 'Terlambat', hint: 'Sudah lewat tenggat, tindak dulu' },
  1: { key: 'soon', title: 'Segera jatuh tempo', hint: 'Tenggat dalam waktu dekat' },
  2: { key: 'todo', title: 'Perlu dilengkapi', hint: 'Belum mendesak, tapi masih menggantung' },
};

export const PROJECT_SOON_DAYS = 14;
export const MEETING_SOON_DAYS = 7;

const isNum = (v) => typeof v === 'number' && !Number.isNaN(v);
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

export function stageOwner(stage) {
  return STAGE_OWNER[stage] || '';
}

// Kata kunci divisi / nama peserta tetap -> divisi (untuk PIC di tindak lanjut rapat yang berupa teks bebas).
const PIC_KEYWORDS = {
  lindawati: 'Marketing & Direksi', direksi: 'Marketing & Direksi', marketing: 'Marketing & Direksi', commercial: 'Marketing & Direksi',
  diana: 'Engineering', syafiq: 'Engineering', engineering: 'Engineering', engineer: 'Engineering',
  adi: 'Warehouse & Purchasing', ira: 'Warehouse & Purchasing', warehouse: 'Warehouse & Purchasing', purchasing: 'Warehouse & Purchasing', gudang: 'Warehouse & Purchasing',
  technician: 'Technician', teknisi: 'Technician',
};

export function divisionFromPic(pic) {
  const tokens = String(pic || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  for (const t of tokens) if (PIC_KEYWORDS[t]) return PIC_KEYWORDS[t];
  return '';
}

function plural(n, unit) {
  return `${Math.abs(n)} ${unit}`;
}

function projectItems(projects) {
  const out = [];
  (projects || []).forEach((p) => {
    if (p.status === 'Completed' || p.stageProgress >= 100) return;
    const division = stageOwner(p.currentStage);
    const href = `/projects/${encodeURIComponent(p.id)}`;
    const base = { kind: 'project', division, href, priority: p.priority, title: p.projectName, detail: [p.currentStage, p.client].filter(Boolean).join(' · ') };
    const days = p.daysRemaining;
    if (p.deliveryDate && p.stageProgress < 90 && isNum(days)) {
      if (days < 0) out.push({ ...base, id: `proj-late-${p.id}`, sev: 0, days, badge: `Terlewat ${plural(days, 'hari')}` });
      else if (days <= PROJECT_SOON_DAYS) out.push({ ...base, id: `proj-soon-${p.id}`, sev: 1, days, badge: days === 0 ? 'Kirim hari ini' : `Kirim ${days} hari lagi` });
    }
    if (p.stageProgress >= 90 && isNum(p.engineeringDocProgress) && p.engineeringDocProgress < 100) {
      // Tidak punya tenggat sendiri: baru "segera" kalau project sudah hampir Hand Over tapi dokumennya belum lengkap.
      const nearHandOver = p.stageProgress >= 97;
      out.push({
        ...base, id: `proj-doc-${p.id}`, kind: 'doc', division: 'Engineering', sev: nearHandOver ? 1 : 2, days: p.engineeringDocProgress,
        title: p.projectName, detail: `Dokumen engineering belum lengkap · ${p.currentStage}`, badge: `Dok ${p.engineeringDocProgress}%`,
      });
    }
  });
  return out;
}

function procurementItems(items, projectsById, today) {
  const out = [];
  (items || []).forEach((it) => {
    if (!isProcOpen(it)) return;
    const project = it.projectId ? projectsById[it.projectId] : null;
    const forWhom = project ? project.projectName : it.forLabel ? `Untuk: ${it.forLabel}` : 'Tanpa project';
    const base = {
      kind: 'proc', division: 'Warehouse & Purchasing', href: it.projectId ? `/procurement?project=${encodeURIComponent(it.projectId)}` : '/procurement',
      priority: project?.priority, title: `${it.item}${it.qty ? ` · ${it.qty}` : ''}`,
      detail: [forWhom, it.vendor, it.status].filter(Boolean).join(' · '),
    };
    const { state, days } = etaState(it, today);
    if (state === 'late') out.push({ ...base, id: `proc-${it.id}`, sev: 0, days, badge: etaText(it, today) });
    else if (state === 'soon') out.push({ ...base, id: `proc-${it.id}`, sev: 1, days, badge: etaText(it, today) });
    else if (it.status === 'Perlu dibeli') out.push({ ...base, id: `proc-${it.id}`, sev: 2, days: 9999, badge: 'Belum dibeli' });
    else if (state === 'none') out.push({ ...base, id: `proc-${it.id}`, sev: 2, days: 9999, badge: 'ETA belum ada' });
  });
  return out;
}

// openItems = hasil computeOpenItems(meetings) -> [{ meeting, item }]
function meetingItems(openItems, today) {
  const out = [];
  (openItems || []).forEach(({ meeting, item }) => {
    if (!item.target) return;
    const days = daysBetween(today, item.target);
    if (days === null || days > MEETING_SOON_DAYS) return;
    out.push({
      id: `mtg-${meeting.id}-${item.id}`, kind: 'meeting', sev: days < 0 ? 0 : 1, days,
      division: divisionFromPic(item.pic), href: `/documents/meetings/${meeting.id}`,
      title: item.topic || '(tanpa judul)',
      detail: [item.cta, item.pic && `PIC ${item.pic}`].filter(Boolean).join(' · ') || 'Tindak lanjut rapat',
      badge: days < 0 ? `Target lewat ${plural(days, 'hari')}` : days === 0 ? 'Target hari ini' : `Target ${days} hari lagi`,
    });
  });
  return out;
}

function sortItems(a, b) {
  return a.sev - b.sev
    || a.days - b.days
    || (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3)
    || String(a.title).localeCompare(String(b.title), 'id');
}

// Semua hal yang perlu ditindak, urut paling mendesak dulu.
export function buildActionItems({ projects, procurement, openMeetingItems, today = todayIso() }) {
  const projectsById = Object.fromEntries((projects || []).map((p) => [p.id, p]));
  return [
    ...projectItems(projects),
    ...procurementItems(procurement, projectsById, today),
    ...meetingItems(openMeetingItems, today),
  ].sort(sortItems);
}

// Filter per divisi. Item tanpa divisi yang jelas hanya muncul di "Semua".
export function filterByDivision(items, division) {
  return division ? items.filter((it) => it.division === division) : items;
}

export function groupBySeverity(items) {
  return [0, 1, 2].map((sev) => ({ sev, ...SEVERITY[sev], items: items.filter((i) => i.sev === sev) })).filter((g) => g.items.length > 0);
}

// Berapa item terlambat / segera per divisi (untuk lencana di filter).
export function countsByDivision(items) {
  const out = { '': { late: 0, soon: 0, total: items.length } };
  DIVISIONS.forEach((d) => { out[d] = { late: 0, soon: 0, total: 0 }; });
  items.forEach((it) => {
    out[''].late += it.sev === 0 ? 1 : 0;
    out[''].soon += it.sev === 1 ? 1 : 0;
    if (out[it.division]) {
      out[it.division].total += 1;
      out[it.division].late += it.sev === 0 ? 1 : 0;
      out[it.division].soon += it.sev === 1 ? 1 : 0;
    }
  });
  return out;
}

// "Bola di siapa": project yang masih berjalan dikelompokkan menurut pemegang stage saat ini.
export function workloadByDivision(projects) {
  const map = {};
  DIVISIONS.forEach((d) => { map[d] = []; });
  (projects || []).forEach((p) => {
    if (p.status === 'Completed' || p.stageProgress >= 100) return;
    const d = stageOwner(p.currentStage);
    if (map[d]) map[d].push(p);
  });
  Object.values(map).forEach((list) => list.sort((a, b) => (a.stageProgress - b.stageProgress) || String(a.projectName).localeCompare(String(b.projectName), 'id')));
  return map;
}

// Kalimat ringkas di atas halaman.
export function summaryText(items) {
  const late = items.filter((i) => i.sev === 0).length;
  const soon = items.filter((i) => i.sev === 1).length;
  if (late === 0 && soon === 0) return 'Tidak ada yang terlambat atau mendesak. Aman.';
  const parts = [];
  if (late) parts.push(`${late} hal terlambat`);
  if (soon) parts.push(`${soon} hal segera jatuh tempo`);
  return `Ada ${parts.join(' dan ')}.`;
}
