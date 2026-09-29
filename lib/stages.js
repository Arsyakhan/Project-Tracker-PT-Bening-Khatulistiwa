// Daftar stage & bobot progress. HARUS sama dengan STAGE_WEIGHTS di apps-script/Code.gs
// (urutannya juga menentukan urutan kolom di Papan Kanban).
export const STAGE_WEIGHTS = {
  'PO': 5,
  'SOS': 10,
  'BOM, PID, EWD, GAD': 25,
  'Review & Approval': 30,
  'Procurement of Material': 45,
  'Collecting Material / Inspection': 55,
  'Fabrication': 70,
  'Delivery': 90,
  'Installation': 95,
  'Commissioning': 97,
  'Preparation Manual Book': 98,
  'Hand Over and Finished': 100,
};

export const STAGES = Object.keys(STAGE_WEIGHTS);
