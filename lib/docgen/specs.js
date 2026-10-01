// Spesifikasi peralatan per project. Kunci data = id field form Hand Over (mis. ro_mem_brand),
// jadi data di project bisa langsung dipakai mengisi form Hand Over tanpa pemetaan tambahan.
import { HANDOVER_SECTIONS, buildHandoverEmpty } from './schema';
import { effectiveSystems, toHandoverModules } from '../systems';

// Semua id field yang boleh disimpan sebagai spesifikasi, plus pasangan satuan (unit) -> field ukurnya.
export const SPEC_FIELD_IDS = [];
const UNIT_TO_MEASURE = {};
HANDOVER_SECTIONS.forEach((sec) => {
  sec.fields.forEach((f) => {
    if (f.type === 'text' || f.type === 'textarea') SPEC_FIELD_IDS.push(f.id);
    else if (f.type === 'measure') {
      SPEC_FIELD_IDS.push(f.id, f.unitId);
      UNIT_TO_MEASURE[f.unitId] = f.id;
    } else if (f.type === 'group') f.items.forEach((it) => SPEC_FIELD_IDS.push(it.id));
  });
});
const SPEC_ID_SET = new Set(SPEC_FIELD_IDS);

// Nilai form -> objek ringkas yang disimpan (hanya yang terisi; satuan hanya kalau angkanya terisi).
export function packSpecs(values) {
  const out = {};
  SPEC_FIELD_IDS.forEach((id) => {
    const v = String(values?.[id] ?? '').trim();
    if (!v) return;
    const measureId = UNIT_TO_MEASURE[id];
    if (measureId && !String(values?.[measureId] ?? '').trim()) return;
    out[id] = v;
  });
  return out;
}

// Data dari server -> hanya id yang dikenal.
export function unpackSpecs(specs) {
  const out = {};
  Object.keys(specs || {}).forEach((id) => {
    if (SPEC_ID_SET.has(id)) out[id] = String(specs[id]);
  });
  return out;
}

// Seksi Hand Over yang relevan untuk sistem terpasang sebuah project.
export function visibleSections(project) {
  const { values } = toHandoverModules(effectiveSystems(project).keys);
  return HANDOVER_SECTIONS.filter((sec) => values[sec.toggleId]);
}

// Nilai awal editor: bawaan form (satuan default) + tipe filter dari sistem + data tersimpan.
export function buildSpecValues(project, savedSpecs) {
  const { values } = toHandoverModules(effectiveSystems(project).keys);
  const defaults = {};
  if (values.f1_type) defaults.f1_type = values.f1_type;
  if (values.f2_type) defaults.f2_type = values.f2_type;
  const base = buildHandoverEmpty();
  const out = {};
  SPEC_FIELD_IDS.forEach((id) => { out[id] = base[id]; });
  return { ...out, ...defaults, ...unpackSpecs(savedSpecs) };
}

// Kolom yang dihitung untuk kelengkapan: teks, ukuran, dan isian group. Item tambahan (opsional) tidak dihitung.
function countedIds(section) {
  const ids = [];
  section.fields.forEach((f) => {
    if (f.type === 'text' || f.type === 'measure') ids.push(f.id);
    else if (f.type === 'group') f.items.forEach((it) => ids.push(it.id));
  });
  return ids;
}

export function sectionProgress(section, values) {
  const ids = countedIds(section);
  const filled = ids.filter((id) => String(values?.[id] ?? '').trim() !== '').length;
  return { filled, total: ids.length };
}

export function overallProgress(sections, values) {
  let filled = 0;
  let total = 0;
  sections.forEach((sec) => {
    const p = sectionProgress(sec, values);
    filled += p.filled;
    total += p.total;
  });
  return { filled, total, percent: total > 0 ? Math.round((filled / total) * 100) : 0 };
}
