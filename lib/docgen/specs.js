// Spesifikasi peralatan per project. Kunci data = id field form Hand Over (mis. ro_mem_brand),
// jadi data di project bisa langsung dipakai mengisi form Hand Over tanpa pemetaan tambahan.
import { HANDOVER_SECTIONS, buildHandoverEmpty } from './schema';
import { projectSystems, toHandoverModules } from '../systems';
import { TECH_SPEC_IDS } from '../techflow';
import { specsFromTech } from '../specParser';
import { EXTRA_SECTIONS, extraEmpty } from './specExtra';
import { moduleSpecContext, specSectionsFor } from './specModules';

// Semua id field yang boleh disimpan sebagai spesifikasi, plus pasangan satuan (unit) -> field ukurnya.
// Termasuk kolom seksi tambahan (lib/docgen/specExtra.js); sebagian idnya sengaja sama dengan kolom Hand Over.
export const SPEC_FIELD_IDS = [];
const UNIT_TO_MEASURE = {};
export const MEASURE_UNIT = {}; // id angka -> id satuannya
const SEEN_IDS = new Set();
const addId = (id) => { if (!SEEN_IDS.has(id)) { SEEN_IDS.add(id); SPEC_FIELD_IDS.push(id); } };
[...HANDOVER_SECTIONS, ...EXTRA_SECTIONS].forEach((sec) => {
  sec.fields.forEach((f) => {
    if (f.type === 'text' || f.type === 'textarea') addId(f.id);
    else if (f.type === 'measure') {
      addId(f.id);
      addId(f.unitId);
      UNIT_TO_MEASURE[f.unitId] = f.id;
      MEASURE_UNIT[f.id] = f.unitId;
    } else if (f.type === 'group') f.items.forEach((it) => addId(it.id));
  });
});
// Teknologi project (alur modul, sama dengan arsip) disimpan di tempat yang sama dengan spesifikasi.
TECH_SPEC_IDS.forEach(addId);
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

// --- Selisih antara koreksi manual (Spesifikasi) dan nilai otomatis dari Teknologi ---
// Teknologi adalah sumber tunggal; koreksi di Spesifikasi hanya tersimpan sebagai override. Supaya dua angka tidak
// diam-diam berbeda, kolom yang dikoreksi dan isinya lain dari nilai Teknologi diberi penanda + tombol kembali otomatis.
const normText = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const asNumber = (s) => {
  const t = String(s ?? '').trim().replace(',', '.');
  return t !== '' && Number.isFinite(Number(t)) ? Number(t) : null;
};
const hasText = (v) => String(v ?? '').trim() !== '';
// "40" = "40.0" = "40,0"; teks dibandingkan tanpa beda huruf besar/kecil dan spasi ganda (supaya tidak berisik).
export function sameValue(a, b) {
  const na = asNumber(a);
  const nb = asNumber(b);
  if (na !== null && nb !== null) return na === nb;
  return normText(a) === normText(b);
}
const oneLine = (s, max = 90) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};
// Kunci satu baris field di tampilan (grup tidak punya id sendiri).
export function fieldKey(f) {
  return f.type === 'group' ? `g:${f.items[0].id}` : f.id;
}

// sections = seksi yang tampil; values = isian MANUAL (bukan yang sudah digabung nilai otomatis); derived = derivedSpecs.
// Hasil: { byField: { [fieldKey]: { text, set } }, bySection: { [sectionKey]: jumlah }, total }
//   text = nilai Teknologi untuk ditampilkan; set = perubahan nilai yang mengembalikan kolom itu ke otomatis.
export function specDiffs(sections, values, derived) {
  const byField = {};
  const bySection = {};
  let total = 0;
  (sections || []).forEach((sec) => {
    (sec.fields || []).forEach((f) => {
      let diff = null;
      if (f.type === 'text' || f.type === 'textarea') {
        const d = derived?.[f.id];
        if (hasText(d) && hasText(values?.[f.id]) && !sameValue(values[f.id], d)) diff = { text: oneLine(d), set: { [f.id]: '' } };
      } else if (f.type === 'measure') {
        const d = derived?.[f.id];
        const du = derived?.[f.unitId];
        if (hasText(d) && hasText(values?.[f.id])) {
          const capDiff = !sameValue(values[f.id], d);
          const unitDiff = hasText(du) && !sameValue(values?.[f.unitId], du);
          if (capDiff || unitDiff) {
            // Angka dikosongkan (kembali otomatis); satuannya disamakan dengan Teknologi supaya tampilan konsisten.
            diff = { text: `${d} ${du || ''}`.trim(), set: { [f.id]: '', ...(hasText(du) ? { [f.unitId]: du } : {}) } };
          }
        }
      } else if (f.type === 'group') {
        const changed = f.items.filter((it) => hasText(derived?.[it.id]) && hasText(values?.[it.id]) && !sameValue(values[it.id], derived[it.id]));
        if (changed.length) {
          const set = {};
          changed.forEach((it) => { set[it.id] = ''; });
          // Tampilkan seluruh baris dari Teknologi (Brand / Model / kapasitas / kW / Qty), bukan hanya bagian yang beda.
          const text = oneLine(f.items.filter((it) => hasText(derived?.[it.id])).map((it) => derived[it.id]).join(' / '));
          diff = { text, set };
        }
      }
      if (diff) {
        byField[fieldKey(f)] = diff;
        bySection[sec.key] = (bySection[sec.key] || 0) + 1;
        total += 1;
      }
    });
  });
  return { byField, bySection, total };
}

// Data dari server -> hanya id yang dikenal.
export function unpackSpecs(specs) {
  const out = {};
  Object.keys(specs || {}).forEach((id) => {
    if (SPEC_ID_SET.has(id)) out[id] = String(specs[id]);
  });
  return out;
}

// Nilai awal semua kolom (Hand Over + seksi tambahan): kosong, satuan = pilihan pertama.
export function buildSpecEmpty() {
  return { ...buildHandoverEmpty(), ...extraEmpty() };
}

// Konteks seksi DOKUMEN Hand Over (bukan tab Spesifikasi): seksi template yang aktif menurut sistem turunan Teknologi.
// Dipakai form Hand Over untuk memilih seksi induk "Item Tambahan" (planExtras). `techModules` (opsional) = teknologi yang
// sedang dibuka di halaman; kalau tidak ada dipakai teknologi dari daftar project (project.tech).
export function specContext(project, techModules) {
  const mods = Array.isArray(techModules) ? techModules : (project?.tech || []);
  const { keys } = projectSystems(project, techModules);
  const ho = toHandoverModules(keys);
  const hoSections = HANDOVER_SECTIONS.filter((sec) => ho.values[sec.toggleId]);
  return {
    mods: new Set(mods.map((m) => m.key)),
    hoKeys: new Set(hoSections.map((sec) => sec.key)),
    overflow: new Set(ho.overflowKeys),
    hoSections,
  };
}

// Seksi tab Spesifikasi Peralatan untuk sebuah project: SATU modul Teknologi = SATU seksi, urut mengikuti alur Teknologi
// (air baku -> produk). Tidak mengikuti pengelompokan template Hand Over; lihat lib/docgen/specModules.js.
export function visibleSections(project, techModules) {
  return specSectionsFor(moduleSpecContext(project, techModules));
}

// Nilai awal editor (tanpa nilai otomatis): bawaan form (satuan default) < tipe filter dari teknologi < isian
// tersimpan. Nilai otomatis dari Teknologi ditambahkan saat ditampilkan (withDerived).
export function buildSpecValues(project, savedSpecs, techModules) {
  const { values } = toHandoverModules(projectSystems(project, techModules).keys);
  const defaults = {};
  if (values.f1_type) defaults.f1_type = values.f1_type;
  if (values.f2_type) defaults.f2_type = values.f2_type;
  const base = buildSpecEmpty();
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
