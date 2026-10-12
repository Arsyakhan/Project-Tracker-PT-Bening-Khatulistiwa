// Spesifikasi peralatan per project. Kunci data = id field form Hand Over (mis. ro_mem_brand),
// jadi data di project bisa langsung dipakai mengisi form Hand Over tanpa pemetaan tambahan.
import { HANDOVER_SECTIONS, buildHandoverEmpty } from './schema';
import { projectSystems, toHandoverModules } from '../systems';
import { TECH_SPEC_IDS } from '../techflow';
import { specsFromTech } from '../specParser';

// Semua id field yang boleh disimpan sebagai spesifikasi, plus pasangan satuan (unit) -> field ukurnya.
export const SPEC_FIELD_IDS = [];
const UNIT_TO_MEASURE = {};
export const MEASURE_UNIT = {}; // id angka -> id satuannya
HANDOVER_SECTIONS.forEach((sec) => {
  sec.fields.forEach((f) => {
    if (f.type === 'text' || f.type === 'textarea') SPEC_FIELD_IDS.push(f.id);
    else if (f.type === 'measure') {
      SPEC_FIELD_IDS.push(f.id, f.unitId);
      UNIT_TO_MEASURE[f.unitId] = f.id;
      MEASURE_UNIT[f.id] = f.unitId;
    } else if (f.type === 'group') f.items.forEach((it) => SPEC_FIELD_IDS.push(it.id));
  });
});
// Teknologi project (alur modul, sama dengan arsip) disimpan di tempat yang sama dengan spesifikasi.
SPEC_FIELD_IDS.push(...TECH_SPEC_IDS);
const SPEC_ID_SET = new Set(SPEC_FIELD_IDS);

// Nilai form -> objek ringkas yang disimpan (hanya yang terisi; satuan hanya kalau angkanya terisi).
// `derived` (opsional) = nilai otomatis dari Teknologi (derivedSpecs). Yang isinya SAMA dengan nilai otomatis tidak
// disimpan: hanya koreksi manual (override) yang tersimpan, jadi kolom otomatis tetap mengikuti Teknologi kalau
// Teknologinya berubah. Pasangan angka + satuan diperlakukan satu paket.
export function packSpecs(values, derived) {
  const out = {};
  const same = (id) => !!derived && derived[id] !== undefined && String(derived[id]).trim() === String(values?.[id] ?? '').trim();
  const pairSame = (capId) => same(capId) && same(MEASURE_UNIT[capId]);
  SPEC_FIELD_IDS.forEach((id) => {
    const v = String(values?.[id] ?? '').trim();
    if (!v) return;
    const measureId = UNIT_TO_MEASURE[id];
    if (measureId) {
      if (!String(values?.[measureId] ?? '').trim()) return;
      if (pairSame(measureId)) return;
    } else if (MEASURE_UNIT[id]) {
      if (pairSame(id)) return;
    } else if (same(id)) return;
    out[id] = v;
  });
  return out;
}

// Nilai Spesifikasi Peralatan yang diturunkan dari Teknologi project (kapasitas + teks Detail Spesifikasi).
// Hanya id field yang dikenal (bukan kunci tech_*). Lihat lib/specParser.js.
export function derivedSpecs(techModules) {
  const { values } = specsFromTech(techModules);
  const out = {};
  Object.keys(values).forEach((id) => { if (SPEC_ID_SET.has(id)) out[id] = values[id]; });
  return out;
}

// Nilai yang ditampilkan: isian tersimpan/diketik (override) menang; kolom yang kosong diisi nilai otomatis dari
// Teknologi. Angka dan satuannya selalu ikut sebagai satu paket.
export function withDerived(values, derived) {
  if (!derived) return values;
  const out = { ...(values || {}) };
  Object.keys(derived).forEach((id) => {
    if (UNIT_TO_MEASURE[id]) return; // satuan mengikuti angkanya
    if (String(values?.[id] ?? '').trim()) return;
    out[id] = derived[id];
    const unitId = MEASURE_UNIT[id];
    if (unitId && derived[unitId]) out[unitId] = derived[unitId];
  });
  return out;
}

// Id kolom yang saat ini masih berisi nilai otomatis (belum dikoreksi manual); untuk penanda "otomatis".
export function autoSpecIds(values, derived) {
  const ids = new Set();
  Object.keys(derived || {}).forEach((id) => {
    if (UNIT_TO_MEASURE[id]) return;
    if (!String(values?.[id] ?? '').trim()) ids.add(id);
  });
  return ids;
}

// Data dari server -> hanya id yang dikenal.
export function unpackSpecs(specs) {
  const out = {};
  Object.keys(specs || {}).forEach((id) => {
    if (SPEC_ID_SET.has(id)) out[id] = String(specs[id]);
  });
  return out;
}

// Seksi Hand Over yang relevan untuk teknologi sebuah project. `techModules` (opsional) = teknologi yang sedang dibuka
// di halaman; kalau tidak ada dipakai teknologi dari daftar project.
export function visibleSections(project, techModules) {
  const { values } = toHandoverModules(projectSystems(project, techModules).keys);
  return HANDOVER_SECTIONS.filter((sec) => values[sec.toggleId]);
}

// Nilai awal editor (tanpa nilai otomatis): bawaan form (satuan default) < tipe filter dari teknologi < isian
// tersimpan. Nilai otomatis dari Teknologi ditambahkan saat ditampilkan (withDerived).
export function buildSpecValues(project, savedSpecs, techModules) {
  const { values } = toHandoverModules(projectSystems(project, techModules).keys);
  const defaults = {};
  if (values.f1_type) defaults.f1_type = values.f1_type;
  if (values.f2_type) defaults.f2_type = values.f2_type;
  const base = buildHandoverEmpty();
  const out = {};
  SPEC_FIELD_IDS.forEach((id) => { out[id] = base[id] ?? ''; });
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
