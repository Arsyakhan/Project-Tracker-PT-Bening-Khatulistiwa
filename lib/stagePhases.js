import { STAGES } from './stages';

// Pengelompokan 12 stage ke 4 fase, dipakai jalur tahapan di detail project (StagePipeline) dan Papan Kanban.
// Hanya ada di frontend (backend tidak mengenal fase). Tiap stage harus muncul tepat sekali dan urutannya
// sama dengan STAGES di lib/stages.js.
export const STAGE_PHASES = [
  { id: 'desain', label: 'Desain & approval', stages: ['PO', 'SOS', 'BOM, PID, EWD, GAD', 'Review & Approval'] },
  { id: 'pengadaan', label: 'Pengadaan & fabrikasi', stages: ['Procurement of Material', 'Collecting Material / Inspection', 'Fabrication'] },
  { id: 'pengiriman', label: 'Pengiriman & pemasangan', stages: ['Delivery', 'Installation', 'Commissioning'] },
  { id: 'serah-terima', label: 'Serah terima', stages: ['Preparation Manual Book', 'Hand Over and Finished'] },
];

// Penjaga: kalau daftar stage berubah tapi fase lupa diperbarui, kasih tahu saat pengembangan.
if (process.env.NODE_ENV !== 'production' && STAGE_PHASES.flatMap((p) => p.stages).join('|') !== STAGES.join('|')) {
  console.warn('[stagePhases] STAGE_PHASES tidak sama dengan STAGES di lib/stages.js. Samakan keduanya.');
}
