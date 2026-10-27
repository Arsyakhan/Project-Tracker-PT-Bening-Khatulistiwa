// Aturan yang menyambungkan Stage, Status, dan Prioritas sebuah project, supaya PM tidak perlu mengisi
// ketiganya satu per satu. Semua fungsi MURNI (tanpa React, tanpa jaringan) sehingga mudah diuji, dan dipakai
// bersama oleh detail project (kartu "Info umum") dan Papan Kanban.
//
// Prinsipnya:
//  - Stage adalah acuan utama (posisi project di alur). Status dan Prioritas diturunkan darinya.
//  - Prioritas juga mengikuti tenggat dan hambatan (kolom Blocker).
//  - Nilai yang sedang diatur manual TIDAK pernah ditimpa diam-diam. Sebuah kolom dianggap "mengikuti aturan"
//    kalau isinya sama dengan hasil aturan (lihat `followsRules`); selain itu dianggap manual dan hanya diberi saran.
//  - Stage hanya maju otomatis (dari checklist) atau diselaraskan dengan Status Completed; tidak pernah mundur sendiri,
//    kecuali saat PM sendiri membuka lagi project yang sudah selesai.
//  - Tidak ada perubahan di Apps Script: ini hanya mengisi kolom yang memang sudah ada (Status, Prioritas, Stage).
import { STAGE_WEIGHTS, STAGES } from './stages';
import { daysBetween, todayIso } from './meetings';
import { SOON_DAYS } from './projectHelpers';

export const FINAL_STAGE = 'Hand Over and Finished';
// Stage tempat project berhenti kalau PM membuka lagi project yang sudah selesai (stage terakhir sebelum Hand Over).
export const REOPEN_STAGE = 'Preparation Manual Book';

// Prioritas menurut sisa waktu: <= PRIORITY_HIGH_DAYS (termasuk terlewat) = High, <= PRIORITY_MEDIUM_DAYS = Medium,
// lebih jauh = Low. 14 hari sama dengan "segera" di Hari Ini dan filter Semua Project (SOON_DAYS).
export const PRIORITY_HIGH_DAYS = SOON_DAYS;
export const PRIORITY_MEDIUM_DAYS = 45;

// Nama item gambar di checklist engineering. HARUS sama dengan CHECKLIST_ITEMS di apps-script/Code.gs.
// Dokumen akhir (Commissioning Report, Handover Report, Manual Book) SENGAJA tidak dipakai untuk memajukan stage:
// di data asli (13 Okt 2026) 15 dari 17 project aktif sudah berstatus Completed di Commissioning Report dan
// Handover Report (lengkap dengan tautan) padahal masih di Procurement sampai Installation, jadi status itu bukan
// bukti project sudah sampai stage tersebut.
export const DRAWING_ITEMS = ['BOM (Bill of Materials)', 'P&ID (Drawings)', 'EWD (Electrical Wiring)', 'GAD (General Arrangement)'];

const stageRank = (stage) => STAGES.indexOf(stage);
const clean = (v) => String(v ?? '').trim();

export const isFinalStage = (stage) => stage === FINAL_STAGE;

// Bobot progress stage; stage yang tidak dikenal (data lama) memakai progress yang tersimpan.
function progressOf(p) {
  const w = STAGE_WEIGHTS[p?.currentStage];
  if (typeof w === 'number') return w;
  return typeof p?.stageProgress === 'number' ? p.stageProgress : null;
}

// Project dianggap selesai kalau stage-nya terakhir atau statusnya Completed (data lama bisa tidak sinkron).
export function isDone(p) {
  return isFinalStage(p?.currentStage) || p?.status === 'Completed';
}

export const isBlocked = (p) => !!clean(p?.blocker);

// Tenggat yang relevan untuk stage sekarang: sebelum terkirim (progress < 90) = Tanggal kirim, sesudah terkirim
// sampai sebelum selesai = Target selesai. Mengembalikan { date, label } atau null kalau tanggalnya belum diisi.
export function deadlineOf(p) {
  const progress = progressOf(p);
  if (progress === null || progress >= 100) return null;
  if (progress < 90) return clean(p.deliveryDate) ? { date: clean(p.deliveryDate), label: 'Tanggal kirim' } : null;
  return clean(p.targetFinishDate) ? { date: clean(p.targetFinishDate), label: 'Target selesai' } : null;
}

// Status dari Stage dan hambatan. null kalau stage tidak dikenal (data lama): tidak ada saran.
export function deriveStatus(p) {
  if (!p || stageRank(p.currentStage) < 0) return null;
  if (isFinalStage(p.currentStage)) return { value: 'Completed', reason: `Stage ${FINAL_STAGE}` };
  if (isBlocked(p)) return { value: 'On Hold', reason: 'Ada hambatan (kolom Hambatan terisi)' };
  return { value: 'In Progress', reason: `Sudah berjalan (stage ${p.currentStage})` };
}

// Prioritas dari status selesai, hambatan, dan tenggat. Kalau tenggatnya belum diisi dipakai Medium sebagai standar
// (di data asli banyak project belum punya tanggal), dan alasannya menyebut tanggal mana yang perlu diisi.
// value null hanya untuk project yang tidak ada.
export function derivePriority(p, today = todayIso()) {
  if (!p) return { value: null, reason: '' };
  if (isDone(p)) return { value: 'Low', reason: 'Project sudah selesai' };
  if (isBlocked(p)) return { value: 'High', reason: 'Ada hambatan yang perlu segera ditangani' };
  const dl = deadlineOf(p);
  const d = dl ? daysBetween(today, dl.date) : null;
  if (!dl || d === null) {
    const need = (progressOf(p) ?? 0) >= 90 ? 'Target selesai' : 'Tanggal kirim';
    return { value: 'Medium', reason: `${need} belum diisi (tab Jadwal); prioritas standar Medium` };
  }
  const when = d < 0 ? `terlewat ${Math.abs(d)} hari` : d === 0 ? 'hari ini' : `${d} hari lagi`;
  const text = `${dl.label} ${when}`;
  if (d <= PRIORITY_HIGH_DAYS) return { value: 'High', reason: text };
  if (d <= PRIORITY_MEDIUM_DAYS) return { value: 'Medium', reason: text };
  return { value: 'Low', reason: text };
}

// Kolom mana yang sekarang mengikuti aturan: isinya sama dengan hasil aturan.
export function followsRules(p, today = todayIso()) {
  const s = deriveStatus(p);
  const r = derivePriority(p, today);
  return { status: !!s && s.value === p?.status, priority: r.value !== null && r.value === p?.priority };
}

// PM mengubah Status sendiri: Completed menyelaraskan stage ke stage terakhir; membuka lagi project yang
// stage-nya sudah terakhir memundurkannya satu langkah. Mengembalikan { stage, reason } atau null.
export function stageForStatus(status, stage) {
  if (status === 'Completed' && !isFinalStage(stage)) return { stage: FINAL_STAGE, reason: 'Status Completed' };
  if (status !== 'Completed' && isFinalStage(stage)) return { stage: REOPEN_STAGE, reason: `Status ${status}: project dibuka kembali` };
  return null;
}

// Stage minimal yang tersirat dari checklist engineering: kalau BOM, P&ID, EWD, dan GAD semuanya Completed (N/A
// tidak dihitung, minimal satu Completed), gambar sudah selesai sehingga project minimal sudah di Review & Approval.
// Mengembalikan { stage, reason } atau null.
export function stageFloorFromChecklist(items) {
  const st = (name) => (items && items[name]) || 'Not Started';
  const applicable = DRAWING_ITEMS.filter((n) => st(n) !== 'N/A');
  if (applicable.length > 0 && applicable.every((n) => st(n) === 'Completed')) {
    return { stage: 'Review & Approval', reason: 'BOM, P&ID, EWD, dan GAD sudah Completed' };
  }
  return null;
}

// Saran maju: hanya kalau stage minimal dari checklist LEBIH JAUH daripada stage sekarang. Tidak pernah mundur.
export function stageAdvance(stage, items) {
  const floor = stageFloorFromChecklist(items);
  if (!floor || stageRank(stage) < 0 || stageRank(floor.stage) <= stageRank(stage)) return null;
  return floor;
}

// Perubahan yang ikut terjadi saat stage dipindah (dipakai Papan Kanban, yang menyimpan langsung tanpa form):
// hanya kolom yang SEDANG mengikuti aturan yang ikut berubah; yang manual dibiarkan.
export function stageChangePatch(p, nextStage, today = todayIso()) {
  const patch = { currentStage: nextStage };
  const follow = followsRules(p, today);
  const next = { ...p, currentStage: nextStage };
  if (follow.status) {
    const s = deriveStatus(next);
    if (s && s.value !== p.status) patch.status = s.value;
  }
  if (follow.priority) {
    const r = derivePriority(next, today);
    if (r.value && r.value !== p.priority) patch.priority = r.value;
  }
  return patch;
}

// Ringkasan aturan dalam bahasa sehari-hari untuk ditampilkan di halaman (dibangkitkan dari konstanta di atas,
// supaya angkanya selalu sama dengan yang dipakai kode).
export const RULE_SUMMARY = [
  { title: 'Status', lines: [
    `Completed jika stage sudah ${FINAL_STAGE}.`,
    'On Hold jika kolom Hambatan pada Langkah berikutnya terisi.',
    'In Progress untuk kondisi lainnya. Not Started hanya diatur manual.',
  ] },
  { title: 'Prioritas', lines: [
    'Low untuk project selesai, High untuk project yang memiliki hambatan.',
    `Selain itu mengikuti sisa waktu ke tenggat (Tanggal kirim, atau Target selesai setelah terkirim): High jika terlewat atau tinggal ${PRIORITY_HIGH_DAYS} hari atau kurang, Medium hingga ${PRIORITY_MEDIUM_DAYS} hari, Low jika lebih lama.`,
    'Medium sebagai standar jika tenggat belum diisi. Isi tanggal di tab Jadwal agar prioritas akurat.',
  ] },
  { title: 'Stage', lines: [
    `Status Completed memindahkan stage ke ${FINAL_STAGE}; membuka kembali project selesai memindahkannya ke ${REOPEN_STAGE}.`,
    'Jika BOM, P&ID, EWD, dan GAD sudah Completed, stage minimal Review & Approval.',
    'Stage hanya maju otomatis dari checklist dan tidak pernah mundur dengan sendirinya.',
  ] },
];
