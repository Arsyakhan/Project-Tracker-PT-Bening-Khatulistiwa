// Daftar peralatan dokumen Hand Over: SATU seksi Spesifikasi Peralatan = SATU butir di dokumen.
//
// Alurnya: modul dicentang di Teknologi -> kolomnya muncul di Spesifikasi Peralatan (lib/docgen/specModules.js) -> diisi
// (otomatis dari Teknologi atau koreksi manual) -> di sini diubah menjadi teks butir dokumen berbahasa Inggris:
//
//   Clarifier System : Capacity 10 m3/hr, Material Carbon Steel
//   Reverse Osmosis (RO) Unit : Model BT40-40K-0840, Capacity 40 m3/hr, consist of:
//     - Membrane, Brand: DuPont, Model: BW30-400, Qty: 6 units
//     - Pressure Vessel, Brand: Codeline, Model: 80E, Qty: 4 units
//   (pompa booster, cartridge filter, antiscalant, dan cleaning/flushing adalah butir sendiri, bukan baris RO)
//
// Fungsi di sini murni (tanpa React, tanpa jaringan). Hasilnya dikirim ke apps-script/docgen/handover.gs sebagai
// `equipment` ([{ key, title, head, rows }]); script itu hanya menuliskannya ke dokumen, jadi seluruh aturan teks ada
// di file ini dan bisa diuji di Node.
import { EN } from './specExtra';

const DOTS = '.......'; // sama dengan isian kosong di generator lama
const clean = (v) => String(v ?? '').trim();
const orDots = (v) => clean(v) || DOTS;

// Nama butir di dokumen untuk tiap modul Teknologi (kunci = ARCHIVE_MODULE_KEYS / FLOW_STEPS).
export const DOC_TITLE = {
  strainer: 'Strainer / Bar Screen / Sand Trap',
  feed_pump: 'Raw Water Feed Pump',
  raw_tank: 'Raw Water Storage Tank',
  aerator: 'Aerator / Aeration Tower',
  dosing_hypo: 'Sodium Hypochlorite (NaOCl) Dosing System',
  dosing_pac: 'PAC Dosing System',
  dosing_soda: 'Soda Ash Dosing System',
  dosing_polimer: 'Polymer Dosing System',
  flocculator: 'Flash Mixer / Flocculator',
  clarifier: 'Clarifier System',
  filter_pump: 'Filter Feed Pump',
  mmf: 'Multi Media Filter (MMF)',
  birm: 'Birm Iron Removal Filter',
  greensand: 'Greensand Filter',
  chlorination: 'Chlorination System',
  acf: 'Activated Carbon Filter (ACF)',
  softener: 'Softener System',
  soft_tank: 'Soft Water Tank',
  uf_pump: 'UF Feed Water Pump',
  uf: 'Ultra Filtration (UF) System',
  dosing_smbs: 'SMBS Dosing System',
  dosing_antiscalant: 'Anti Scalant Dosing System',
  dosing_ph: 'pH Adjustment (Acid / NaOH) Dosing System',
  dosing_biocide: 'Biocide Dosing System',
  cartridge: 'Cartridge Filter',
  booster: 'RO Booster Pump',
  flush_pump: 'Chemical Cleaning / Flushing Pump',
  ro: 'Reverse Osmosis (RO) Unit',
  erd: 'Energy Recovery Device (ERD)',
  ro2: 'Reverse Osmosis (RO) Pass 2',
  flush_tank: 'Chemical Cleaning / Flushing Tank',
  ro_reject: 'RO Reject Water Tank / Pump',
  degasifier: 'Degasifier / Decarbonator',
  ion_exchange: 'Cation / Anion Exchanger',
  edi: 'Electrodeionization (EDI)',
  mixedbed: 'Mixed Bed',
  neutralization: 'Neutralization System',
  carbon_cartridge: 'Carbon Cartridge Filter',
  remineral: 'Remineralization',
  product_tank: 'Product Water Tank',
  uv: 'UV Sterilizer',
  ozone: 'Ozone Generator',
  filter_02: '0.2 Micron Filter',
  dist_pump: 'Transfer / Distribution Pump',
  bottle_filling: 'Bottle Filling & Flushing System',
};
// Opsi dokumen (bukan modul Teknologi), kunci = kunci seksi di specModules.js.
export const OPTION_TITLE = {
  int_tank: 'Intermediate Product Tank',
  cip: 'Chemical Dosing System',
  panel: 'Electrical Control Panel',
};

// Kolom yang tidak dicetak: nama filter diambil dari modulnya (Birm / MMF / ACF), bukan dari isian slot.
const SKIP_IDS = new Set(['f1_type', 'f2_type']);

// Label bahasa Inggris untuk kolom teks / ukuran. Urutan: id khusus, nama kolom seksi tambahan, akhiran id.
const ID_LABEL = {
  f1_tank_size: 'FRP tank size', f2_tank_size: 'FRP tank size', soft_tank_size: 'FRP tank size',
  soft_resin_vol: 'Resin Cation', soft_brine_cap: 'Brine Tank', panel_size: 'Control panel box size',
};
const ID_UNIT = { panel_size: 'mm' };
const SUFFIX_LABEL = [
  [/_media_vol$/, 'Media volume'], [/_media_type$/, 'Media'], [/_resin_vol$/, 'Resin'], [/_tank_size$/, 'Tank size'],
  [/_cap$/, 'Capacity'], [/_mat$/, 'Material'], [/_qty$/, 'Qty'], [/_model$/, 'Model'], [/_type$/, 'Type'],
  [/_size$/, 'Size'], [/_kw$/, 'Power'], [/_valve$/, 'Valve'], [/_controller$/, 'Controller'],
];
// Kolom yang isinya hanya jumlah suatu komponen kecil: dicetak sebagai "Flowmeter, Qty: 1 unit".
const QTY_ONLY = { uf_fm_qty: 'Flowmeter', uf_sv_qty: 'Solenoid Valve', uf_ps_qty: 'Pressure Switch', uf_pg_qty: 'Pressure Gauge' };
// Beberapa kolom lepas yang di template satu baris (tangki cleaning UF, tangki bahan kimia dosing terpisah).
const CLUSTERS = [
  { title: 'UF Chemical Cleaning Tank', ids: ['uf_cip_tank_mat', 'uf_cip_tank_cap'] },
  { title: 'Chemical Tank', ids: ['std_cip_tank_mat', 'std_cip_tank_cap', 'std_cip_tank_qty'] },
];

const fieldLabel = (f) => {
  if (ID_LABEL[f.id]) return ID_LABEL[f.id];
  if (f.src?.name && EN[f.src.name]) return EN[f.src.name];
  const hit = SUFFIX_LABEL.find(([re]) => re.test(f.id));
  return hit ? hit[1] : f.label;
};
const isQtyId = (id) => /_qty$/.test(id);

// "1" -> "1 unit", "6" -> "6 units" (jumlah lebih dari 1 memakai bentuk jamak), kosong -> "....... unit".
function qtyText(v, word = 'unit') {
  const t = clean(v);
  const n = Number(t.replace(',', '.'));
  return `${t || DOTS} ${t && Number.isFinite(n) && n > 1 ? `${word}s` : word}`;
}

// Teks nilai sebuah kolom teks / ukuran (dengan satuannya).
function plainValue(f, values) {
  const v = clean(values?.[f.id]);
  if (isQtyId(f.id)) return qtyText(v);
  if (f.type === 'measure') return `${orDots(v)} ${clean(values?.[f.unitId]) || f.options[0]}`;
  const unit = ID_UNIT[f.id] || (f.src?.name === 'kw' ? 'kW' : '');
  return `${orDots(v)}${unit ? ` ${unit}` : ''}`;
}

// ---- kolom sebaris (group) ----
const SUFFIX_NAME = { brand: 'Brand', model: 'Model', cap: 'Capacity', kw: 'Power', qty: 'Qty', mat: 'Material', size: 'Size', valve: 'Valve Control' };
const groupName = (label) => {
  if (/^Pompa Dosing/.test(label)) return 'Dosing Pump';
  if (/^Tangki Bahan Kimia/.test(label)) return 'Chemical Tank';
  return label.replace(/ Specs$/, '');
};
// Satuan sebuah isian group: dari akhiran kolom ('kw' -> kW), dari `post` seksi tambahan, atau dari placeholder (m3/hr, LPH, Liters).
function itemUnit(it, suf) {
  if (suf === 'kw') return 'kW';
  if (suf !== 'cap') return '';
  if (it.post && clean(it.post)) return clean(it.post);
  const m = String(it.placeholder || '').match(/m3\/hr|LPH|Liters/);
  return m ? m[0] : '';
}
const groupEmpty = (f, values) => f.items.every((it) => !clean(values?.[it.id]));
// Peralatan pendamping yang boleh tidak ada (blower, mixer): dilewati kalau kosong. Sub-peralatan lain (booster RO pass 2,
// membran, rumah cartridge, ...) bagian inti modulnya, jadi selalu dicetak.
const isOptionalSub = (f) => f.src?.role === 'sub' && /^(blower|agitator)$/.test(f.src?.name || '');

// "Brand: CNP, Model: CHL 4-30, Capacity: 5 m3/hr, Power: 0.75 kW, Qty: 1 unit"
function groupDetail(f, values) {
  if (f.label === 'Valve Control & Qty') {
    const valve = f.items.find((it) => /_valve$/.test(it.id));
    const qty = f.items.find((it) => isQtyId(it.id));
    return `Valve Control: ${orDots(values?.[valve?.id])}, Qty: ${qtyText(values?.[qty?.id], 'set')}`;
  }
  return f.items.map((it) => {
    const suf = it.id.split('_').pop();
    const name = SUFFIX_NAME[suf] || suf;
    if (suf === 'qty') return `${name}: ${qtyText(values?.[it.id])}`;
    const unit = itemUnit(it, suf);
    return `${name}: ${orDots(values?.[it.id])}${unit ? ` ${unit}` : ''}`;
  }).join(', ');
}

// Item Tambahan (teks bebas, satu butir per baris): buang tanda "-" / "*" / "•" di awal baris.
const noteLines = (text) => String(text ?? '').split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*•]\s*)+/, '').trim()).filter(Boolean);

export function sectionTitle(sec) {
  if (sec.modules && sec.modules.length === 1 && DOC_TITLE[sec.modules[0]]) return DOC_TITLE[sec.modules[0]];
  if (OPTION_TITLE[sec.key]) return OPTION_TITLE[sec.key];
  return sec.title;
}

// Satu seksi Spesifikasi Peralatan -> satu butir dokumen { key, title, head, rows }.
//  - kolom teks/ukuran di depan (sebelum kolom sebaris pertama) masuk ke kalimat judul butir;
//  - kolom sebaris (pompa, membran, tangki, ...) menjadi baris tersendiri; peralatan pendamping (blower, mixer) dilewati kalau kosong;
//  - kolom teks/ukuran sesudahnya menjadi baris tersendiri, Item Tambahan satu baris per barisnya;
//  - kolom yang kosong dicetak "......." supaya bisa dilengkapi tangan, sama dengan generator lama.
export function buildEquipmentItem(sec, values) {
  const title = sectionTitle(sec);
  const fields = (sec.fields || []).filter((f) => f.type !== 'subheading' && !SKIP_IDS.has(f.id));
  const headParts = [];
  const rows = [];
  const notes = [];
  const used = new Set();
  let seenGroup = false;

  fields.forEach((f) => {
    if (used.has(f.id)) return;
    if (f.type === 'textarea') { notes.push(...noteLines(values?.[f.id])); return; }
    if (f.type === 'group') {
      seenGroup = true;
      if (isOptionalSub(f) && groupEmpty(f, values)) return; // peralatan pendamping yang tidak ada
      rows.push({ name: groupName(f.label), detail: groupDetail(f, values), group: true, bare: f.label === 'Valve Control & Qty' });
      return;
    }
    if (!seenGroup) { headParts.push(`${fieldLabel(f)} ${plainValue(f, values)}`); return; }
    const cluster = CLUSTERS.find((c) => c.ids.includes(f.id));
    if (cluster) {
      const members = cluster.ids.map((id) => fields.find((x) => x.id === id)).filter(Boolean);
      members.forEach((m) => used.add(m.id));
      rows.push({ name: cluster.title, detail: members.map((m) => `${fieldLabel(m)}: ${plainValue(m, values)}`).join(', ') });
      return;
    }
    if (QTY_ONLY[f.id]) { rows.push({ name: QTY_ONLY[f.id], detail: `Qty: ${qtyText(values?.[f.id])}` }); return; }
    rows.push({ name: fieldLabel(f), detail: plainValue(f, values), plain: true });
  });

  // Satu kolom sebaris saja tanpa kalimat judul dan tanpa Item Tambahan (mis. pompa): jadikan satu kalimat.
  if (headParts.length === 0 && rows.length === 1 && rows[0].group && notes.length === 0) {
    return { key: sec.key, title, head: `${title}, ${rows[0].detail}`, rows: [], collapsed: true };
  }

  const lines = [
    ...rows.map((r) => (r.bare ? r.detail : r.plain ? `${r.name}: ${r.detail}` : `${r.name}, ${r.detail}`)),
    ...notes,
  ];
  const lead = headParts.length ? `${title} : ${headParts.join(', ')}` : title;
  return { key: sec.key, title, head: lines.length ? `${lead}, consist of:` : lead, rows: lines };
}

// sections = seksi yang dicetak (urut alur Teknologi), values = isian form (sudah digabung nilai otomatis).
export function buildEquipmentItems(sections, values) {
  return (sections || []).map((sec) => buildEquipmentItem(sec, values));
}

// Teks polos satu butir (pratinjau di form dan uji).
export function itemText(item) {
  return [item.head, ...item.rows.map((r) => `  - ${r}`)].join('\n');
}
