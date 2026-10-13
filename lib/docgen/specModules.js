// Seksi tab "Spesifikasi Peralatan": SATU modul Teknologi = SATU seksi.
//
// Seksi di tab ini sengaja tidak mengikuti pengelompokan template dokumen Hand Over (13 Okt 2026). Di template, satu seksi
// bisa memuat beberapa peralatan (mis. "Reverse Osmosis Package" = RO + booster + cartridge + anti scalant + CIP). Di sini
// tiap peralatan yang punya modul sendiri di Teknologi (booster, cartridge, dosing antiscalant, pompa dan tangki
// cleaning/flushing, pompa feed UF, pompa dan tangki air baku) punya seksi sendiri, dan seksi RO hanya berisi RO.
//
// Id kolom TIDAK berubah (sama dengan form Hand Over di lib/docgen/schema.js dan seksi tambahan di specExtra.js), jadi
// data yang sudah tersimpan di Project Specs dan prefill form Hand Over tetap jalan. File ini hanya mengatur kolom mana
// tampil di seksi mana. Form Hand Over, planExtras, dan template Google Docs tidak disentuh.
import { HANDOVER_SECTIONS } from './schema';
import { EXTRA_SECTIONS, flowIndex } from './specExtra';
import { stepInfo } from '../techflow';
import { projectSystems, documentExtras, hasDosingModule } from '../systems';

const HO = Object.fromEntries(HANDOVER_SECTIONS.map((s) => [s.key, s]));
// Kunci satu baris field (sama dengan fieldKey di specs.js; didefinisikan lagi di sini supaya tidak ada impor melingkar).
const keyOf = (f) => (f.type === 'group' ? `g:${f.items[0].id}` : f.id);
const fieldOf = (secKey, key) => HO[secKey].fields.find((f) => keyOf(f) === key);
const fieldsOf = (secKey, keys) => keys.map((k) => fieldOf(secKey, k)).filter(Boolean);
// Semua kolom seksi Hand Over kecuali yang disebut (dan kecuali subjudul A/B/C yang hanya pemisah di template).
const without = (secKey, drop) => HO[secKey].fields.filter((f) => f.type !== 'subheading' && !drop.includes(keyOf(f)));
const label = (moduleKey) => stepInfo(moduleKey)?.label || moduleKey;

// Seksi bawaan template yang kolomnya dipakai ulang di sini, satu per modul Teknologi. `fields` = kolom milik modul itu.
// Bagian paket yang punya modul sendiri (booster, cartridge, antiscalant, cleaning/flushing, pompa feed UF) TIDAK di sini:
// kolomnya sudah ada di seksi tambahan modul itu (specExtra.js, id sama).
const OWN = [
  { module: 'feed_pump', fields: fieldsOf('raw_water', ['g:rw_pump_brand']) },
  { module: 'raw_tank', fields: fieldsOf('raw_water', ['rw_tank_cap', 'rw_tank_mat', 'rw_tank_qty']) },
  { module: 'clarifier', fields: HO.clarifier.fields },
  { module: 'softener', fields: HO.softener.fields },
  { module: 'uf', fields: without('uf', ['g:uf_fwp_brand']) },
  {
    module: 'ro',
    fields: without('ro', [
      'g:ro_bp_brand',                    // Booster Feed Pump (modul booster)
      'g:ro_cfh_mat', 'g:ro_cf_size',     // Cartridge Filter (modul cartridge)
      'g:as_tank_mat', 'g:as_pump_brand', 'as_additional_items', // Dosing Antiscalant (modul dosing_antiscalant)
      'g:ro_cip_pump_brand', 'g:ro_cip_tank_mat', 'ro_cip_additional_items', // Cleaning / Flushing (modul flush_pump, flush_tank)
    ]),
  },
];

// "Item Tambahan" yang di template dipakai bersama beberapa peralatan: dipasang di seksi pertama (urut) yang tampil.
const SHARED_NOTES = [
  { field: fieldOf('raw_water', 'rw_additional_items'), owners: ['raw_tank', 'feed_pump'] },
  { field: fieldOf('ro', 'as_additional_items'), owners: ['dosing_antiscalant'] },
  { field: fieldOf('ro', 'ro_cip_additional_items'), owners: ['flush_pump', 'flush_tank'] },
];

// Filter: template hanya punya 2 slot (Birm -> MMF -> Carbon), id kolom mengikuti slot (f1_* / f2_*). Yang ketiga memakai
// seksi tambahan (x_acf, id sendiri).
const FILTER_ORDER = ['birm', 'mmf', 'acf'];

// Opsi dokumen yang bukan modul Teknologi (tab Teknologi > Opsi dokumen) tetapi punya kolom spesifikasi sendiri.
const DOC_OPTION_HINT = 'Dari "Opsi dokumen" di tab Teknologi (bukan modul Teknologi).';

// Sistem lama (kolom "Sistem Terpasang" / deteksi dari nama) -> modul, hanya untuk project yang teknologinya belum dicatat.
const SYSTEM_MODULES = {
  raw_water: ['raw_tank', 'feed_pump'], clarifier: ['clarifier'], birm: ['birm'], mmf: ['mmf'], acf: ['acf'],
  softener: ['softener'], uf: ['uf'], ro: ['ro'], mixedbed: ['mixedbed'],
};
const DOC_OPTION_KEYS = ['dosing', 'int_tank', 'panel'];

// Konteks seksi: modul Teknologi yang aktif + opsi dokumen yang menyalakan seksi tambahan.
//  - teknologi terisi: modulnya langsung; opsi dokumen dari kolom lama (dosing tidak dihitung kalau sudah ada pompa dosing,
//    karena tiap pompa dosing punya seksi sendiri);
//  - teknologi kosong: cadangan lama (sistem terpasang atau terdeteksi dari nama) dipetakan ke modulnya.
export function moduleSpecContext(project, techModules) {
  const { keys, fromTech } = projectSystems(project, techModules);
  const mods = new Set();
  const docOpts = new Set();
  if (fromTech) {
    const list = Array.isArray(techModules) ? techModules : (project?.tech || []);
    list.forEach((m) => { if (m && m.key) mods.add(m.key); });
    documentExtras(project).filter((k) => DOC_OPTION_KEYS.includes(k)).forEach((k) => docOpts.add(k));
    if (hasDosingModule(list)) docOpts.delete('dosing');
  } else {
    keys.forEach((k) => (SYSTEM_MODULES[k] || []).forEach((m) => mods.add(m)));
    keys.filter((k) => DOC_OPTION_KEYS.includes(k)).forEach((k) => docOpts.add(k));
  }
  return { mods, docOpts };
}

const DOSING = EXTRA_SECTIONS.find((s) => s.key === 'x_dosing');

// Semua seksi yang tampil untuk konteks di atas, urut mengikuti alur Teknologi.
export function specSectionsFor(ctx) {
  const { mods, docOpts } = ctx;
  const out = [];

  // 1) Seksi bawaan template yang dipecah per modul.
  OWN.forEach((o) => {
    if (!mods.has(o.module)) return;
    out.push({ key: o.module, title: label(o.module), modules: [o.module], fields: o.fields, order: flowIndex(o.module) });
  });

  // 2) Filter: slot 1 dan 2 memakai kolom Filter 1/2 template, judulnya nama modul yang menempati slot.
  const filters = FILTER_ORDER.filter((k) => mods.has(k));
  filters.slice(0, 2).forEach((k, i) => {
    out.push({ key: k, title: label(k), modules: [k], fields: HO[i === 0 ? 'filter_1' : 'filter_2'].fields, order: flowIndex(k) });
  });
  const overflow = new Set(filters.slice(2));

  // 3) Modul yang kolomnya didefinisikan di specExtra.js (satu seksi per modul). Tanpa penyembunyian `unlessSection`:
  //    booster, cartridge, pompa feed UF, pompa/tangki cleaning-flushing selalu punya seksi sendiri kalau modulnya dicentang.
  EXTRA_SECTIONS.forEach((sec) => {
    if (sec.key === 'x_dosing') return;
    const m = sec.modules[0];
    if (!(sec.overflow ? overflow.has(m) : mods.has(m))) return;
    out.push({ ...sec, unlessSection: null, hint: undefined, order: flowIndex(m) });
  });

  // 4) Pompa dosing: satu seksi per bahan kimia yang dicentang (pompa + tangki bahan kimia).
  DOSING.modules.forEach((m) => {
    if (!mods.has(m)) return;
    const fields = DOSING.fields.filter((f) => f.module === m).map((f) => ({ ...f, unlessSection: undefined }));
    out.push({ key: `x_${m}`, extra: true, title: label(m), modules: [m], fields, order: flowIndex(m) });
  });

  // 5) Opsi dokumen: tangki antara, dosing/CIP terpisah, panel (bukan modul Teknologi).
  if (docOpts.has('int_tank')) out.push({ ...HO.int_tank, modules: [], hint: DOC_OPTION_HINT, order: flowIndex('int_tank') });
  if (docOpts.has('dosing')) out.push({ ...HO.cip, modules: [], hint: DOC_OPTION_HINT, order: flowIndex('dosing') });
  if (docOpts.has('panel')) out.push({ ...HO.panel, modules: [], hint: DOC_OPTION_HINT, order: 999 });

  // 6) "Item Tambahan" bersama: pasang di seksi pertama yang tampil.
  SHARED_NOTES.forEach(({ field, owners }) => {
    if (!field) return;
    const host = owners.map((m) => out.find((s) => s.modules[0] === m)).find(Boolean);
    if (host) host.fields = [...host.fields, field];
  });

  return out.sort((a, b) => a.order - b.order);
}
