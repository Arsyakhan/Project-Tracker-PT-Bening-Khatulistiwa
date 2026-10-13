// Seksi Spesifikasi Peralatan TAMBAHAN: satu seksi untuk tiap modul Teknologi yang tidak punya seksi sendiri di
// template Hand Over (Strainer, Aerator, Flokulator, Greensand, Degasifier, EDI, UV, dst.).
//
// Prinsipnya: apa yang dicentang di Teknologi muncul juga di Spesifikasi Peralatan, dengan kolom rinci satu per satu
// (Tipe, Kapasitas, Material, Ukuran, Qty, pompa, tangki, ...), dan teks "Detail Spesifikasi" di Teknologi dibaca ke
// kolom-kolom ini (pembacanya di lib/specParser.js, memakai definisi di file ini supaya kolom dan pembaca selalu sama).
//
// Template Google Docs Hand Over tidak berubah (tidak bisa diedit dari sini), jadi di dokumen seksi tambahan ini
// dicetak sebagai baris "Item Tambahan" di seksi induk (HOSTS). Lihat planExtras / applyExtraPlan.
//
// File ini hanya struktur + format teks (tanpa pembaca teks), supaya tidak ada impor melingkar dengan specParser.
import { FLOW_STEPS } from '../techflow';
import { HANDOVER_SECTIONS } from './schema';

const FLOW_INDEX = Object.fromEntries(FLOW_STEPS.map((s, i) => [s.key, i]));
export const flowIndex = (key) => FLOW_INDEX[key] ?? 999;

// ---------------------------------------------------------------------------------------------
// 1. Bentuk isian
// ---------------------------------------------------------------------------------------------
export const FLOW_UNITS = ['m3/hr', 'LPM', 'CMD'];
export const VOLUME_UNITS = ['Liters', 'm3'];
export const MEDIA_UNITS = ['Liters', 'Bag', 'kg'];
export const UNIT_OPTIONS = { flow: FLOW_UNITS, volume: VOLUME_UNITS, media: MEDIA_UNITS };
const UNIT_SAMPLE = { flow: 'm3/hr', volume: 'Liters', media: 'Liters' };

// Isian sebaris per jenis peralatan: [akhiran id, placeholder, flex, awalan teks dokumen, akhiran teks dokumen].
// Jenisnya sama dengan FIELD_KINDS di lib/specParser.js (yang membaca teks Detail ke akhiran id yang sama).
export const GROUP_KINDS = {
  pump: [['brand', 'Brand', 1], ['model', 'Model', 2], ['cap', 'm3/hr', 1, '', ' m3/hr'], ['kw', 'kW', 1, '', ' kW'], ['qty', 'Qty', 1, 'Qty ']],
  pumpkw: [['brand', 'Brand', 1], ['model', 'Model', 2], ['kw', 'kW', 1, '', ' kW'], ['qty', 'Qty', 1, 'Qty ']],
  dose: [['brand', 'Brand', 1], ['model', 'Model', 1], ['cap', 'Cap (LPH)', 1, '', ' LPH'], ['qty', 'Qty', 1, 'Qty ']],
  membrane: [['brand', 'Brand', 1], ['model', 'Model', 2], ['qty', 'Qty', 1, 'Qty ']],
  housing: [['mat', 'Mat (SS)', 1], ['model', 'Model', 2], ['qty', 'Qty', 1, 'Qty ']],
  cartridge: [['size', 'Size (ex: 40” length)', 3], ['qty', 'Qty', 1, 'Qty ']],
  tank: [['mat', 'Material (ex: PE)', 2], ['cap', 'Cap (Liters)', 1, '', ' Liters'], ['qty', 'Qty', 1, 'Qty ']],
  meter: [['model', 'Model', 3], ['qty', 'Qty', 1, 'Qty ']],
};

// Baris kerangka + contoh per jenis (label yang dikenal pembaca, lihat LABEL_KEYS di specParser.js).
const KIND_LINES = {
  pump: [['Brand/Model', 'CNP / CHL 4-30'], ['Capacity', '5 m3/hr'], ['Power', '0.75 kW'], ['Qty', '1']],
  pumpkw: [['Brand/Model', 'GRUNDFOS / CR 64-5-1'], ['Power', '30 kW'], ['Qty', '1']],
  dose: [['Brand/Model', 'Grundfos / DDA 7.5'], ['Capacity', '5 LPH'], ['Qty', '1']],
  membrane: [['Brand/Model', 'DuPont / BW30-400'], ['Qty', '6']],
  housing: [['Material', 'SS304'], ['Model', '5 round 40"'], ['Qty', '1']],
  cartridge: [['Size', '40" length'], ['Qty', '5']],
  tank: [['Material', 'PE'], ['Capacity', '200 Liters'], ['Qty', '1']],
  meter: [['Model', 'Digital RTP'], ['Qty', '1']],
};

// Label bahasa Inggris untuk teks di dokumen Hand Over (isi dokumen berbahasa Inggris).
const EN = {
  type: 'Type', model: 'Model', cap: 'Capacity', vol: 'Volume', mat: 'Material', size: 'Size', qty: 'Qty', kw: 'Power',
  media: 'Media', media_vol: 'Media volume', valve: 'Valve', resin_vol: 'Resin', cation_vol: 'Cation resin',
  anion_vol: 'Anion resin', regen: 'Regenerant', lamp: 'Lamp', dose: 'UV dose', output: 'Output',
};
// Label kerangka Detail yang dikenal pembaca.
const TL = {
  type: 'Type', model: 'Brand/Model', cap: 'Capacity', vol: 'Volume', mat: 'Material', size: 'Size', qty: 'Qty', kw: 'Power',
  media: 'Media', media_vol: 'Volume', valve: 'Valve', resin_vol: 'Resin',
};

// Pembangun definisi. o: read (nama pembaca), re (cocokkan label baris), tl (label kerangka), from (kunci label baku).
const T = (name, label, ph, o = {}) => ({ kind: 'text', name, label, ph, ...o });
const M = (name, label, ph, mkind, o = {}) => ({ kind: 'measure', name, label, ph, mkind, ...o });
const G = (name, label, gkind, o = {}) => ({ kind: 'group', name, label, gkind, ...o });

const FLOW = (ph = 'ex: 5') => M('cap', 'Kapasitas', ph, 'flow');
const QTY = (label = 'Qty') => T('qty', label, 'ex: 1');

// Bentuk filter (sama dengan Filter 1/2 di template).
const filterMain = (mediaPh) => [
  T('model', 'Model', 'ex: MMF-21M'),
  FLOW(),
  T('size', 'Ukuran Tank FRP', 'ex: 1465 / 2162'),
  M('media_vol', 'Volume Media', 'ex: 175', 'media', { from: 'volume' }),
  T('media', 'Jenis Media', mediaPh),
  T('valve', 'Valve Control', 'ex: Manual multiport'),
  QTY(),
];

// ---------------------------------------------------------------------------------------------
// 2. Definisi per modul
// ---------------------------------------------------------------------------------------------
// key = kunci modul Teknologi (juga awalan id: x_<key>_<nama>). hosts = seksi Hand Over tempat isinya dicetak
// (urut kesukaan). unlessSection = disembunyikan kalau seksi Hand Over itu sudah tampil (kolomnya sudah ada di sana,
// idnya sengaja sama). overflow = hanya tampil kalau filter itu tidak muat di 2 slot template (hanya Carbon).
const DEFS = [
  { key: 'strainer', title: 'Strainer / Bar Screen / Sand Trap', hosts: ['rw'], main: [
    T('type', 'Tipe', 'ex: Basket strainer / Bar screen / Sand trap'), FLOW('ex: 10'), T('mat', 'Material', 'ex: Stainless Steel 304'),
    T('size', 'Ukuran / Mesh', 'ex: 2" / 40 mesh'), QTY(),
  ] },
  { key: 'aerator', title: 'Aerator / Aeration Tower', hosts: ['rw'], main: [
    T('type', 'Tipe', 'ex: Tray aerator / Spray / Cascade'), FLOW('ex: 10'), T('mat', 'Material', 'ex: Stainless Steel / FRP'),
    T('size', 'Dimensi', 'ex: 1000 x 1000 x 2000'), QTY(),
  ], subs: [G('blower', 'Air Blower', 'pumpkw', { match: /blower|compressor|fan/i })] },
  { key: 'flocculator', title: 'Flash Mixer / Flocculator', ttitle: 'FLOCCULATOR', hosts: ['clarifier', 'rw'], main: [
    T('model', 'Model / Tipe', 'ex: 2 stage flocculator'), FLOW('ex: 10'), M('vol', 'Volume Tangki', 'ex: 500', 'volume'),
    T('mat', 'Material', 'ex: Carbon Steel with Epoxy'), QTY(),
  ], subs: [G('agitator', 'Mixer / Agitator', 'pumpkw', { match: /mixer|agitator|gearbox/i })] },
  { key: 'filter_pump', title: 'Filter Pump', hosts: ['f1', 'clarifier', 'rw'], main: [G('pump', 'Filter Pump', 'pump', { prefix: 'x_filter_pump' })] },
  { key: 'greensand', title: 'Greensand Filter', hosts: ['f1', 'f2', 'clarifier', 'rw'], main: filterMain('ex: Greensand') },
  { key: 'chlorination', title: 'Chlorination', hosts: ['f1', 'rw'], main: [
    T('type', 'Metode', 'ex: NaOCl dosing / Gas chlorine / Ca(OCl)2'), FLOW('ex: 10'),
  ], subs: [
    G('tank', 'Tangki Bahan Kimia', 'tank', { match: /tank|tangki/i }),
    G('pump', 'Pompa Dosing', 'dose', { match: /pump|dosing/i }),
  ] },
  // Template hanya punya 2 slot filter (Birm -> MMF -> Carbon). Kalau ketiganya dicentang, Carbon tidak muat dan
  // spesifikasinya tampil sebagai seksi tambahan ini.
  { key: 'acf', overflow: true, title: 'Activated Carbon Filter', hosts: ['f2', 'f1'], main: filterMain('ex: Activated Carbon') },
  { key: 'soft_tank', title: 'Soft Water Tank', hosts: ['soft', 'int'], main: [
    M('cap', 'Kapasitas', 'ex: 2000', 'volume'), T('mat', 'Material', 'ex: PE / FRP'), T('size', 'Ukuran / Dimensi', 'ex: Ø1200 x 2000'), QTY(),
  ] },
  // Bagian-bagian paket yang kolomnya sudah ada di seksi Hand Over (id sama); kartu ini hanya muncul kalau seksi itu tidak ada.
  { key: 'uf_pump', title: 'UF Feed Water Pump', unlessSection: 'uf', hosts: ['rw'], main: [G('pump', 'UF Feed Water Pump', 'pump', { prefix: 'uf_fwp' })] },
  { key: 'cartridge', title: 'Cartridge Filter', unlessSection: 'ro', hosts: ['rw'], subs: [
    G('housing', 'Cartridge Filter Housing', 'housing', { match: /housing/i, prefix: 'ro_cfh' }),
    G('cart', '5-Micron Cartridge Filter', 'cartridge', { match: /micron|cartridge/i, prefix: 'ro_cf' }),
  ] },
  { key: 'booster', title: 'Booster Feed Pump', unlessSection: 'ro', hosts: ['rw'], main: [G('pump', 'RO Booster Pump', 'pumpkw', { prefix: 'ro_bp' })] },
  { key: 'flush_pump', title: 'Cleaning / Flushing Pump', unlessSection: 'ro', hosts: ['rw'], main: [G('pump', 'Cleaning Pump Specs', 'pumpkw', { prefix: 'ro_cip_pump' })] },
  { key: 'flush_tank', title: 'Cleaning / Flushing Tank', unlessSection: 'ro', hosts: ['rw'], main: [G('tank', 'Chemical / Flushing Tank', 'tank', { prefix: 'ro_cip_tank' })] },
  { key: 'erd', title: 'Energy Recovery Device (ERD)', hosts: ['ro'], main: [
    T('model', 'Brand / Model', 'ex: Danfoss iSave / Energy Recovery PX'), T('type', 'Tipe', 'ex: Isobaric / Pelton / Turbocharger'), FLOW('ex: 40'), QTY(),
  ] },
  { key: 'ro2', title: 'RO Pass 2', hosts: ['ro'], main: [T('model', 'RO Unit Model', 'ex: BT20-20K-0420'), FLOW('ex: 20')], subs: [
    G('bp', 'RO Booster Pump', 'pumpkw', { match: /booster/i }),
    G('mem', 'Membrane Specs', 'membrane', { match: /membran|membrane/i }),
    G('vessel', 'Pressure Vessel Specs', 'membrane', { match: /vessel/i }),
    G('fwp', 'RO Feed Water Pump', 'pump', { match: /feed/i }),
  ] },
  { key: 'degasifier', title: 'Degasifier / Decarbonator', hosts: ['ro'], main: [
    T('type', 'Tipe', 'ex: Forced draft / Membrane degasifier'), FLOW('ex: 10'), T('mat', 'Material', 'ex: FRP / PP'), T('size', 'Dimensi', 'ex: Ø600 x 3000'), QTY(),
  ], subs: [G('blower', 'Air Blower', 'pumpkw', { match: /blower|fan/i })] },
  { key: 'ion_exchange', title: 'Cation / Anion Exchanger', ttitle: 'CATION ANION EXCHANGER', hosts: ['ro', 'soft'], main: [
    T('model', 'Model', 'ex: CE-30 / AE-30'), FLOW('ex: 5'), T('size', 'Ukuran Tank', 'ex: 1465'),
    M('cation_vol', 'Resin Cation', 'ex: 100', 'media', { re: /cation|kation/i, tl: 'Resin Cation' }),
    M('anion_vol', 'Resin Anion', 'ex: 100', 'media', { re: /anion/i, tl: 'Resin Anion' }),
    T('valve', 'Valve / Controller', 'ex: Autotrol 255 / Manual'), QTY(),
  ] },
  { key: 'edi', title: 'Electrodeionization (EDI)', hosts: ['ro'], main: [
    T('model', 'Brand / Model', 'ex: Evoqua E-Cell / Ionpure'), FLOW('ex: 2'), QTY('Jumlah Modul'), T('kw', 'Daya Rectifier (kW)', 'ex: 1.5'),
  ] },
  { key: 'mixedbed', title: 'Mixed Bed', hosts: ['ro'], main: [
    T('model', 'Model', 'ex: MB-20'), FLOW('ex: 2'), T('size', 'Ukuran Tank', 'ex: 1054'), M('resin_vol', 'Volume Resin', 'ex: 100', 'media', { from: 'resin' }),
    T('regen', 'Regenerant', 'ex: HCl & NaOH', { re: /regenera/i, tl: 'Regenerant' }), T('valve', 'Valve / Controller', 'ex: Manual'), QTY(),
  ] },
  { key: 'remineral', title: 'Remineralization', hosts: ['ro'], main: [
    T('type', 'Metode', 'ex: Calcite filter / Dosing Ca-Mg'), FLOW('ex: 2'), T('size', 'Ukuran Tank', 'ex: 1054'), T('media', 'Jenis Media', 'ex: Calcite'),
    M('media_vol', 'Volume Media', 'ex: 100', 'media', { from: 'volume' }), QTY(),
  ] },
  { key: 'product_tank', title: 'Product Water Tank', hosts: ['int', 'ro'], main: [
    M('cap', 'Kapasitas', 'ex: 5000', 'volume'), T('mat', 'Material', 'ex: SS304 / PE / FRP'), T('size', 'Dimensi', 'ex: Ø1500 x 2500'), QTY(),
  ] },
  { key: 'uv', title: 'UV Sterilizer', hosts: ['int', 'ro'], main: [
    T('model', 'Brand / Model', 'ex: Sterilight / Aquafine'), FLOW('ex: 5'), T('lamp', 'Lampu / Watt', 'ex: 2 x 40 W', { re: /lamp|lampu|watt/i, tl: 'Lamp' }),
    T('dose', 'UV Dose (mJ/cm²)', 'ex: 30', { re: /dose|dosis/i, tl: 'UV Dose' }), T('mat', 'Material Chamber', 'ex: SS316L'), QTY(),
  ] },
  { key: 'ozone', title: 'Ozone Generator', hosts: ['int', 'ro'], main: [
    T('model', 'Brand / Model', 'ex: Ozonia / Wedeco'), T('output', 'Output Ozon', 'ex: 5 g/h', { re: /output|production|produksi|ozone/i, tl: 'Output' }),
    FLOW('ex: 5'), T('kw', 'Daya (kW)', 'ex: 0.2'), QTY(),
  ] },
  { key: 'filter_02', title: '0.2 Micron Filter', hosts: ['int', 'ro'], main: [
    FLOW('ex: 5'), T('mat', 'Material Housing', 'ex: SS316L'), T('model', 'Model Housing', 'ex: 5 round 20"'), T('size', 'Ukuran Cartridge', 'ex: 20" / 40"'), QTY(),
  ] },
  { key: 'dist_pump', title: 'Transfer / Distribution Pump', hosts: ['int', 'ro'], main: [G('pump', 'Transfer / Distribution Pump', 'pump', { prefix: 'x_dist_pump' })] },
];

// Pompa dosing: satu kartu, satu baris pompa + tangki per bahan kimia yang dicentang (modulnya hanya "Ada", tanpa Detail).
const DOSING = [
  ['dosing_hypo', 'NaOCl'], ['dosing_pac', 'PAC'], ['dosing_soda', 'Soda Ash'], ['dosing_polimer', 'Polimer'],
  ['dosing_smbs', 'SMBS'], ['dosing_antiscalant', 'Antiscalant'], ['dosing_ph', 'Asam / NaOH (pH)'],
];

// ---------------------------------------------------------------------------------------------
// 3. Membangun seksi (bentuk sama dengan HANDOVER_SECTIONS: { key, title, fields })
// ---------------------------------------------------------------------------------------------
function fieldOf(idOf, spec, role, extra = {}) {
  const src = { ...spec, role };
  if (spec.kind === 'text') return { type: 'text', id: idOf(spec.name), label: spec.label, placeholder: spec.ph, src, ...extra };
  if (spec.kind === 'measure') {
    const id = idOf(spec.name);
    return { type: 'measure', id, unitId: `${id}_unit`, label: spec.label, placeholder: spec.ph, options: UNIT_OPTIONS[spec.mkind], src, ...extra };
  }
  const prefix = spec.prefix || idOf(spec.name);
  return {
    type: 'group', label: spec.label, prefix, gkind: spec.gkind, src, ...extra,
    items: GROUP_KINDS[spec.gkind].map(([suf, ph, flex, pre, post]) => ({ id: `${prefix}_${suf}`, placeholder: ph, flex, pre: pre || '', post: post || '' })),
  };
}

function buildSection(def) {
  const idOf = (name) => `x_${def.key}_${name}`;
  const fields = [
    ...(def.main || []).map((s) => fieldOf(idOf, s, 'main')),
    ...(def.subs || []).map((s) => fieldOf(idOf, s, 'sub')),
  ];
  return {
    key: `x_${def.key}`, extra: true, title: def.title, ttitle: def.ttitle, modules: [def.key], hosts: def.hosts || [],
    unlessSection: def.unlessSection || null, overflow: !!def.overflow, fields,
    order: flowIndex(def.key),
  };
}

function buildDosing() {
  const fields = [];
  DOSING.forEach(([mod, label]) => {
    const anti = mod === 'dosing_antiscalant';
    const unless = anti ? { unlessSection: 'ro' } : {};
    fields.push({
      type: 'group', label: `Pompa Dosing ${label}`, prefix: anti ? 'as_pump' : `x_${mod}_pump`, gkind: 'dose', module: mod, ...unless, src: { role: 'none' },
      items: GROUP_KINDS.dose.map(([suf, ph, flex, pre, post]) => ({ id: `${anti ? 'as_pump' : `x_${mod}_pump`}_${suf}`, placeholder: ph, flex, pre: pre || '', post: post || '' })),
    });
    fields.push({
      type: 'group', label: `Tangki Bahan Kimia ${label}`, prefix: anti ? 'as_tank' : `x_${mod}_tank`, gkind: 'tank', module: mod, ...unless, src: { role: 'none' },
      items: GROUP_KINDS.tank.map(([suf, ph, flex, pre, post]) => ({ id: `${anti ? 'as_tank' : `x_${mod}_tank`}_${suf}`, placeholder: ph, flex, pre: pre || '', post: post || '' })),
    });
  });
  return {
    key: 'x_dosing', extra: true, title: 'Pompa Dosing per Bahan Kimia', modules: DOSING.map(([m]) => m), hosts: ['cip'],
    unlessSection: null, overflow: false, fields, order: Math.min(...DOSING.map(([m]) => flowIndex(m))),
  };
}

export const EXTRA_SECTIONS = [...DEFS.map(buildSection), buildDosing()];
const EXTRA_BY_KEY = Object.fromEntries(EXTRA_SECTIONS.map((s) => [s.modules.length === 1 ? s.modules[0] : s.key, s]));
// Modul Teknologi yang punya definisi tambahan (pembaca Detail menyiapkan kolomnya).
export const EXTRA_MODULE_KEYS = new Set(EXTRA_SECTIONS.filter((s) => s.key !== 'x_dosing').map((s) => s.modules[0]));
export const extraSectionOf = (moduleKey) => EXTRA_BY_KEY[moduleKey] || null;

// Nilai awal semua kolom seksi tambahan (kosong; satuan = pilihan pertama).
export function extraEmpty() {
  const out = {};
  EXTRA_SECTIONS.forEach((sec) => {
    sec.fields.forEach((f) => {
      if (f.type === 'text') out[f.id] = '';
      else if (f.type === 'measure') { out[f.id] = ''; out[f.unitId] = f.options[0]; } else f.items.forEach((it) => { out[it.id] = ''; });
    });
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// 4. Seksi mana yang tampil
// ---------------------------------------------------------------------------------------------
// ctx = { mods: Set kunci modul Teknologi, hoKeys: Set kunci seksi Hand Over yang tampil, overflow: Set kunci filter
// yang tidak muat di 2 slot template }.
const HOST_TAIL = ['rw', 'clarifier', 'f1', 'f2', 'soft', 'uf', 'ro', 'cip', 'int', 'panel'];
export const HOSTS = {
  rw: { section: 'raw_water', toggle: 'has_raw_water', text: 'rw_additional_items' },
  clarifier: { section: 'clarifier', toggle: 'has_clarifier', text: 'clarifier_additional_items' },
  f1: { section: 'filter_1', toggle: 'has_filter_1', text: 'f1_additional_items' },
  f2: { section: 'filter_2', toggle: 'has_filter_2', text: 'f2_additional_items' },
  uf: { section: 'uf', toggle: 'has_uf', text: 'uf_additional_items' },
  int: { section: 'int_tank', toggle: 'has_int_tank', text: 'int_additional_items' },
  soft: { section: 'softener', toggle: 'has_softener', text: 'soft_additional_items' },
  ro: { section: 'ro', toggle: 'has_ro', text: 'ro_additional_items' },
  cip: { section: 'cip', toggle: 'has_cip', text: 'std_cip_additional_items' },
  panel: { section: 'panel', toggle: 'has_panel', text: 'panel_additional_items' },
};
export const hostTitle = (hostKey) => HANDOVER_SECTIONS.find((s) => s.key === HOSTS[hostKey].section)?.title || hostKey;

// Seksi induk dokumen untuk sebuah seksi tambahan: yang pertama aktif menurut urutan kesukaan; kalau tidak ada yang aktif,
// seksi kesukaan pertama (akan diaktifkan saat dokumen dibuat). isOn(hostKey) -> boolean.
export function pickHost(sec, isOn) {
  const chain = [...sec.hosts, ...HOST_TAIL.filter((h) => !sec.hosts.includes(h))];
  const found = chain.find((h) => isOn(h));
  return { host: found || chain[0], enable: !found };
}

// Seksi tambahan yang tampil, dengan kolom yang sesuai modul yang dicentang.
export function visibleExtras(ctx) {
  const out = [];
  EXTRA_SECTIONS.forEach((sec) => {
    if (sec.unlessSection && ctx.hoKeys.has(sec.unlessSection)) return;
    const on = (m) => (sec.overflow ? ctx.overflow.has(m) : ctx.mods.has(m));
    if (!sec.modules.some(on)) return;
    const fields = sec.fields.filter((f) => (!f.module || ctx.mods.has(f.module)) && !(f.unlessSection && ctx.hoKeys.has(f.unlessSection)));
    if (fields.length === 0) return;
    const { host } = pickHost(sec, (h) => ctx.hoKeys.has(HOSTS[h].section));
    out.push({
      ...sec, fields,
      hint: `Tidak punya seksi sendiri di template Hand Over; di dokumen dicetak sebagai Item Tambahan di seksi ${hostTitle(host)}.`,
    });
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// 5. Teks untuk dokumen Hand Over (Item Tambahan)
// ---------------------------------------------------------------------------------------------
const clean = (v) => String(v ?? '').trim();

function groupText(f, values) {
  const get = (suf) => clean(values?.[`${f.prefix}_${suf}`]);
  const names = [];
  const rest = [];
  f.items.forEach((it) => {
    const suf = it.id.slice(f.prefix.length + 1);
    const v = get(suf);
    if (!v) return;
    if (['brand', 'model', 'mat', 'size'].includes(suf)) names.push(v);
    else rest.push(`${it.pre || ''}${v}${it.post || ''}`);
  });
  return [names.join(' '), ...rest].filter(Boolean).join(', ');
}

// Baris dokumen untuk sebuah seksi tambahan: "Nama (Type X, Capacity 5 m3/hr, Material SS304, Qty 1)".
// Pompa dosing: satu baris per bahan kimia yang dicentang ("Dosing Pump PAC (Pump Grundfos DDA 7.5, 5 LPH, Qty 1, Tank PE, ...)").
export function describeLines(sec, values) {
  if (sec.key === 'x_dosing') {
    const byModule = {};
    sec.fields.forEach((f) => { (byModule[f.module] = byModule[f.module] || []).push(f); });
    return Object.keys(byModule).map((mod) => {
      const title = FLOW_STEPS.find((st) => st.key === mod)?.label || mod;
      const parts = byModule[mod].map((f) => {
        const text = groupText(f, values);
        return text ? `${f.gkind === 'tank' ? 'Tank' : 'Pump'} ${text}` : '';
      }).filter(Boolean);
      return parts.length ? `${title} (${parts.join(', ')})` : title;
    });
  }
  const parts = [];
  sec.fields.forEach((f) => {
    if (f.type === 'text') {
      const v = clean(values?.[f.id]);
      if (v) parts.push(`${EN[f.src?.name] || f.label} ${v}`);
    } else if (f.type === 'measure') {
      const v = clean(values?.[f.id]);
      if (v) parts.push(`${EN[f.src?.name] || f.label} ${v} ${clean(values?.[f.unitId]) || f.options[0]}`);
    } else {
      const text = groupText(f, values);
      if (text) parts.push(`${f.label} ${text}`);
    }
  });
  return [parts.length ? `${sec.title} (${parts.join(', ')})` : sec.title];
}

// Rencana mencetak seksi tambahan ke Item Tambahan seksi induk. isOn(hostKey) = apakah seksi induk aktif di form.
// Mengembalikan [{ host, title, toggle, textId, enable, lines: [..] }] (satu entri per seksi induk).
export function planExtras(values, ctx, isOn) {
  const forced = new Set();
  const byHost = {};
  const order = [];
  visibleExtras(ctx).forEach((sec) => {
    const { host, enable } = pickHost(sec, (h) => isOn(h) || forced.has(h));
    if (enable) forced.add(host);
    if (!byHost[host]) {
      byHost[host] = { host, title: hostTitle(host), toggle: HOSTS[host].toggle, textId: HOSTS[host].text, enable: false, lines: [] };
      order.push(host);
    }
    if (enable) byHost[host].enable = true;
    byHost[host].lines.push(...describeLines(sec, values));
  });
  return order.map((h) => byHost[h]);
}

// Salinan form dengan rencana di atas diterapkan: baris ditambahkan ke Item Tambahan (setelah isian yang sudah ada) dan
// seksi induk yang belum aktif dinyalakan. Hanya untuk payload dokumen; form dan data tersimpan tidak berubah.
export function applyExtraPlan(form, plan) {
  const out = { ...form };
  (plan || []).forEach((p) => {
    if (p.enable) out[p.toggle] = true;
    out[p.textId] = [clean(form?.[p.textId]), ...p.lines].filter(Boolean).join('\n');
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// 6. Kerangka & contoh penulisan Detail Spesifikasi (dibaca lib/specParser.js)
// ---------------------------------------------------------------------------------------------
const exOf = (ph) => String(ph || '').replace(/^ex:\s*/i, '');

function linesOf(sec, withValues) {
  const main = sec.fields.filter((f) => f.src?.role === 'main');
  const subs = sec.fields.filter((f) => f.src?.role === 'sub');
  const head = (sec.ttitle || sec.title).toUpperCase();
  const blocks = [];
  const kindLines = (kind) => KIND_LINES[kind].map(([label, sample]) => `${label} : ${withValues ? sample : ''}`.trimEnd() + (withValues ? '' : ' '));
  const mainText = main.filter((f) => f.type !== 'group');
  const mainGroups = main.filter((f) => f.type === 'group');
  if (mainText.length) {
    const lines = mainText.map((f) => {
      const label = f.src.tl || TL[f.src.name] || f.label;
      if (!withValues) return `${label} : `;
      return `${label} : ${f.type === 'measure' ? `${exOf(f.placeholder)} ${UNIT_SAMPLE[f.src.mkind]}` : exOf(f.placeholder)}${f.src.name === 'kw' ? ' kW' : ''}`;
    });
    blocks.push([head, ...lines].join('\n'));
  }
  mainGroups.forEach((f) => blocks.push([(mainText.length ? f.label : head).toUpperCase(), ...kindLines(f.gkind)].join('\n')));
  subs.forEach((f) => blocks.push([f.label.toUpperCase(), ...kindLines(f.gkind)].join('\n')));
  return blocks;
}

export const EXTRA_TEMPLATES = {};
export const EXTRA_EXAMPLES = {};
EXTRA_SECTIONS.filter((s) => s.key !== 'x_dosing').forEach((sec) => {
  const key = sec.modules[0];
  EXTRA_TEMPLATES[key] = linesOf(sec, false).join('\n\n');
  EXTRA_EXAMPLES[key] = linesOf(sec, true).slice(0, 2).join('\n\n');
});
// Contoh lengkap (semua bagian) untuk uji.
export const extraFullExample = (moduleKey) => {
  const sec = extraSectionOf(moduleKey);
  return sec ? linesOf(sec, true).join('\n\n') : '';
};
