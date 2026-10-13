// Muatan (payload) form Hand Over: dari apa yang dicentang di Teknologi dan diisi di Spesifikasi Peralatan menjadi
//   1) `equipment`: daftar butir dokumen, SATU seksi Spesifikasi = SATU butir (lib/docgen/handoverItems.js). Ini yang
//      dibaca apps-script/docgen/handover.gs terbaru untuk menyusun daftar "Items Handed Over".
//   2) bentuk lama (has_* + isian + Item Tambahan): dibaca handover.gs versi lama yang masih berjalan di Apps Script
//      sebelum pemilik menempel versi baru. Jadi urutan deploy Vercel dan Apps Script tidak masalah.
import { HANDOVER_SECTIONS } from './schema';
import { specSectionsFor } from './specModules';
import { buildEquipmentItems } from './handoverItems';
import { HOSTS, planExtras, applyExtraPlan } from './specExtra';
import { deriveSystemKeys, toHandoverModules } from '../systems';

// Opsi dokumen -> kunci seksi di specModules.js (bukan modul Teknologi).
export const DOC_OPTIONS = [
  { key: 'int_tank', section: 'int_tank', label: 'Tangki antara (Intermediate Tank)' },
  { key: 'dosing', section: 'cip', label: 'Dosing / CIP terpisah' },
  { key: 'panel', section: 'panel', label: 'Panel kontrol' },
];

// ctx = { mods: Set kunci modul, docOpts: Set opsi dokumen }; excluded = Set kunci seksi yang tidak dicetak.
export function handoverPlan(ctx, excluded) {
  const out = excluded || new Set();
  const all = specSectionsFor(ctx);
  const sections = all.filter((s) => !out.has(s.key));
  const mods = new Set(sections.flatMap((s) => s.modules));
  const opts = DOC_OPTIONS.filter((o) => sections.some((s) => s.key === o.section)).map((o) => o.key);
  const keys = deriveSystemKeys([...mods].map((key) => ({ key })), opts);
  return { all, sections, mods, opts, ho: toHandoverModules(keys) };
}

// Butir dokumen untuk pratinjau dan pengiriman.
export function handoverItems(ctx, excluded, values) {
  return buildEquipmentItems(handoverPlan(ctx, excluded).sections, values);
}

// Payload yang dikirim ke /api/docgen. `form` = isian form (administrasi + semua kolom spesifikasi).
export function buildHandoverPayload(form, ctx, excluded) {
  const plan = handoverPlan(ctx, excluded);
  const equipment = buildEquipmentItems(plan.sections, form);

  // Bentuk lama: centang seksi template diturunkan dari modul yang dicetak (bukan lagi dicentang tangan).
  const legacy = { ...form };
  HANDOVER_SECTIONS.forEach((sec) => { legacy[sec.toggleId] = !!plan.ho.values[sec.toggleId]; });
  if (plan.ho.values.f1_type) legacy.f1_type = plan.ho.values.f1_type;
  if (plan.ho.values.f2_type) legacy.f2_type = plan.ho.values.f2_type;
  const hoKeys = new Set(HANDOVER_SECTIONS.filter((sec) => legacy[sec.toggleId]).map((sec) => sec.key));
  const extra = planExtras(legacy, { mods: plan.mods, hoKeys, overflow: new Set(plan.ho.overflowKeys) }, (h) => !!legacy[HOSTS[h].toggle]);

  return {
    payload: { ...applyExtraPlan(legacy, extra), equipment, equipment_version: 2 },
    equipment,
    sections: plan.sections,
  };
}
