// Definisi field & logika murni untuk kedua form Generator Dokumen.
// Semua nama field di sini HARUS sama persis dengan yang dibaca `data.xxx` di
// Apps Script doPost masing-masing (Commissioning & Hand Over) — jangan diubah
// tanpa mengubah juga kedua script itu.

// Field yang idnya berakhiran ini otomatis jadi <input type="number">,
// meniru perilaku asli di index.html (querySelectorAll pola /_(qty|kw|cap|vol)$/i).
export function isNumericField(id) {
  return /_(qty|kw|cap|vol)$/i.test(id);
}

// 2 dari 7 item Checklist Engineering ini punya generator otomatis. Dipakai di
// pages/projects/[id].js (tab Checklist) dan pages/engineering-docs.js (tabel lintas-project).
export const DOC_GENERATOR_ROUTE = {
  'Commissioning Report': 'commissioning',
  'Handover Report': 'handover',
};

// ------------------------------------------------------------------
// COMMISSIONING REPORT
// ------------------------------------------------------------------

export const COMMISSIONING_MODULES = [
  { id: 'has_clarifier', label: 'Clarifier' },
  { id: 'has_dosing', label: 'Dosing Pump' },
  { id: 'has_birm', label: 'Birm Filter' },
  { id: 'has_mmf', label: 'Multi Media Filter' },
  { id: 'has_acf', label: 'Activated Carbon' },
  { id: 'has_softener', label: 'Softener' },
  { id: 'has_uf', label: 'Ultra Filtration' },
  { id: 'has_ro', label: 'Reverse Osmosis' },
  { id: 'has_mixedbed', label: 'Mixed Bed' },
];

// Cuma tampil & relevan kalau has_ro dicentang.
export const COMMISSIONING_RO_SUBTOGGLES = [
  { id: 'is_ro_large', label: '+ Backpressure (RO Besar)' },
  { id: 'has_recycle', label: '+ Flow Recycle' },
];

// { moduleId yang mensyaratkan section ini tampil: [ {id, label} ] }
export const COMMISSIONING_TAG_FIELDS = {
  has_softener: [
    { id: 'tag_pi_soft_in', label: 'PI Inlet' },
    { id: 'tag_pi_soft_out', label: 'PI Outlet' },
  ],
  has_uf: [
    { id: 'tag_ps_uf_feed', label: 'PS Feed Pump' },
    { id: 'tag_ps_uf_bw', label: 'PS Backwash' },
    { id: 'tag_pi_uf_in', label: 'PI Inlet UF' },
    { id: 'tag_pi_uf_out', label: 'PI Outlet UF' },
    { id: 'tag_fi_uf', label: 'FI Product' },
  ],
  has_ro: [
    { id: 'tag_pi_01', label: 'PI Inlet Cartridge (PI-01)' },
    { id: 'tag_pi_02', label: 'PI Outlet Cartridge (PI-02)' },
    { id: 'tag_pi_03', label: 'PI Outlet Booster (PI-03)' },
    { id: 'tag_pi_04', label: 'PI Inlet Stage 2 (PI-04)' },
    { id: 'tag_pi_05', label: 'PI Reject (PI-05)' },
    { id: 'tag_pi_06', label: 'PI Backpressure (PI-06)', onlyIf: 'is_ro_large' },
    { id: 'tag_fi_01', label: 'FI Product Water (FI-01)' },
    { id: 'tag_fi_02', label: 'FI Reject Water (FI-02)' },
    { id: 'tag_fi_03', label: 'FI Recycle (FI-03)', onlyIf: 'has_recycle' },
  ],
};

// Sama persis dengan updatePIDNumbering() di tool lama: penomoran berurut
// Softener -> UF -> RO, dihitung ulang tiap toggle berubah. Field tetap bisa
// diedit manual sesudahnya (ini cuma nilai AWAL/default).
export function computePidTags(modules) {
  let piCount = 1, fiCount = 1, psCount = 1;
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const tags = {};

  if (modules.has_softener) {
    tags.tag_pi_soft_in = 'PI-' + pad(piCount++);
    tags.tag_pi_soft_out = 'PI-' + pad(piCount++);
  } else {
    tags.tag_pi_soft_in = '';
    tags.tag_pi_soft_out = '';
  }

  if (modules.has_uf) {
    tags.tag_ps_uf_feed = 'PS-' + pad(psCount++);
    tags.tag_ps_uf_bw = 'PS-' + pad(psCount++);
    tags.tag_pi_uf_in = 'PI-' + pad(piCount++);
    tags.tag_pi_uf_out = 'PI-' + pad(piCount++);
    tags.tag_fi_uf = 'FI-' + pad(fiCount++);
  } else {
    tags.tag_ps_uf_feed = ''; tags.tag_ps_uf_bw = '';
    tags.tag_pi_uf_in = ''; tags.tag_pi_uf_out = ''; tags.tag_fi_uf = '';
  }

  if (modules.has_ro) {
    tags.tag_pi_01 = 'PI-' + pad(piCount++);
    tags.tag_pi_02 = 'PI-' + pad(piCount++);
    tags.tag_pi_03 = 'PI-' + pad(piCount++);
    tags.tag_pi_04 = 'PI-' + pad(piCount++);
    tags.tag_pi_05 = 'PI-' + pad(piCount++);
    tags.tag_pi_06 = modules.is_ro_large ? 'PI-' + pad(piCount++) : '';
    tags.tag_fi_01 = 'FI-' + pad(fiCount++);
    tags.tag_fi_02 = 'FI-' + pad(fiCount++);
    tags.tag_fi_03 = modules.has_recycle ? 'FI-' + pad(fiCount++) : '';
  } else {
    tags.tag_pi_01 = ''; tags.tag_pi_02 = ''; tags.tag_pi_03 = '';
    tags.tag_pi_04 = ''; tags.tag_pi_05 = ''; tags.tag_pi_06 = '';
    tags.tag_fi_01 = ''; tags.tag_fi_02 = ''; tags.tag_fi_03 = '';
  }
  return tags;
}

// Sama persis dengan getCommChecklist() di tool lama.
export function buildCommChecklistText(modules) {
  const list = ['( ) Power supply properly joined to electrical Control panel.'];
  if (modules.has_clarifier) {
    list.push('( ) Inlet Transfer pump properly joined to Outlet Settlement Tank / Raw Water Line.');
  }
  if (modules.has_dosing) {
    list.push('( ) Chemical Dosing line properly joined to main pipe.');
    list.push('( ) Dosing pump properly joined to Chemical Tank.');
  }
  if (modules.has_birm) {
    list.push('( ) Inlet Birm Filter properly joined to feed line.');
    list.push('( ) Outlet Birm Filter properly joined to the next treatment stage.');
  }
  if (modules.has_mmf) {
    list.push('( ) Inlet MMF properly joined to feed line.');
    list.push('( ) Outlet MMF properly joined to the next treatment stage.');
  }
  if (modules.has_acf) {
    list.push('( ) Inlet ACF properly joined to feed line.');
    list.push('( ) Outlet ACF properly joined to the next treatment stage.');
  }
  if (modules.has_softener) {
    list.push('( ) Softener brine line properly joined to Brine Tank.');
  }
  if (modules.has_uf) {
    list.push('( ) Inlet UF Feed Water Pump properly joined to Feed Water Tank.');
    list.push('( ) Outlet UF properly joined to UF Permeate Tank.');
    list.push('( ) Outlet cleaning line UF properly joined to UF Cleaning Tank.');
    list.push('( ) Inlet UF Backwash pump properly joined to UF Product Tank.');
  }
  if (modules.has_ro) {
    list.push('( ) Inlet raw water line properly joined to Inlet RO.');
    list.push('( ) Outlet product line RO properly joined to Product water storage tank and Cleaning/Flushing tank');
    list.push('( ) Outlet reject line RO properly joined to water drain line');
    list.push('( ) Outlet cleaning line RO properly joined to Cleaning/Flushing tank');
    list.push('( ) Outlet of Cleaning/Flushing tank properly joined to inlet of Cleaning/Flushing pump');
    list.push('( ) Outlet Cleaning/Flushing Pump properly joined to Inlet of Cartridge filter');
  }
  if (modules.has_mixedbed) {
    list.push('( ) HCl and NaOH chemicals already prepared necessarily.');
    list.push('( ) Chemical drain nozzle properly joined to chemical drain line.');
  }
  return list.join('\n');
}

export const COMMISSIONING_EMPTY = {
  project_name: '', system_title: '', company_name: '', po_number: '', location: '', alamat: '',
  has_clarifier: false, has_dosing: false, has_birm: false, has_mmf: false, has_acf: false,
  has_softener: false, has_uf: false, has_ro: false, has_mixedbed: false,
  is_ro_large: false, has_recycle: false,
  tag_pi_soft_in: '', tag_pi_soft_out: '',
  tag_ps_uf_feed: '', tag_ps_uf_bw: '', tag_pi_uf_in: '', tag_pi_uf_out: '', tag_fi_uf: '',
  tag_pi_01: '', tag_pi_02: '', tag_pi_03: '', tag_pi_04: '', tag_pi_05: '', tag_pi_06: '',
  tag_fi_01: '', tag_fi_02: '', tag_fi_03: '',
  owner_company: '', owner_name: '', contractor_name: '',
};

// ------------------------------------------------------------------
// HAND OVER (HO) DOCUMENT
// ------------------------------------------------------------------
// row types: 'text' | 'measure' (angka + dropdown satuan) | 'group' (beberapa
// input sebaris, mis. brand/model/kW/qty) | 'textarea' (Additional Items) |
// 'subheading' (pemisah visual, khusus dipakai di dalam section RO yang besar)

export const HANDOVER_SECTIONS = [
  {
    key: 'raw_water', toggleId: 'has_raw_water', title: 'Raw Water System',
    fields: [
      { type: 'measure', id: 'rw_tank_cap', unitId: 'rw_tank_unit', label: 'Kapasitas Tangki', placeholder: 'ex: 5000', options: ['Liters', 'm3'] },
      { type: 'text', id: 'rw_tank_mat', label: 'Material Tangki', placeholder: 'ex: PE / FRP / Carbon Steel' },
      { type: 'text', id: 'rw_tank_qty', label: 'Qty Tangki', placeholder: 'ex: 1' },
      { type: 'group', label: 'Feed Water Pump', items: [
        { id: 'rw_pump_brand', placeholder: 'Brand (CNP)', flex: 1 },
        { id: 'rw_pump_model', placeholder: 'Model (CHL 4-30)', flex: 2 },
        { id: 'rw_pump_cap', placeholder: 'm3/hr', flex: 1 },
        { id: 'rw_pump_kw', placeholder: 'kW', flex: 1 },
        { id: 'rw_pump_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'textarea', id: 'rw_additional_items', label: 'Item Tambahan', placeholder: 'ex:\n- 1 Lot PVC Piping\n- 1 Unit Float Switch' },
    ],
  },
  {
    key: 'clarifier', toggleId: 'has_clarifier', title: 'Clarifier System',
    fields: [
      { type: 'measure', id: 'clarifier_cap', unitId: 'clarifier_unit', label: 'Kapasitas', placeholder: 'ex: 10', options: ['m3/hr', 'LPM', 'CMD'] },
      { type: 'text', id: 'clarifier_mat', label: 'Material Tangki', placeholder: 'ex: Carbon Steel with Epoxy' },
      { type: 'textarea', id: 'clarifier_additional_items', label: 'Item Tambahan', placeholder: 'ex:\n- Static Mixer, Qty: 1 lot' },
    ],
  },
  {
    key: 'filter_1', toggleId: 'has_filter_1', title: 'Filter 1 (MMF / Birm)',
    fields: [
      { type: 'text', id: 'f1_type', label: 'Nama / Tipe Filter', placeholder: 'ex: Multi Media Filter' },
      { type: 'measure', id: 'f1_cap', unitId: 'f1_unit', label: 'Kapasitas', placeholder: 'ex: 5', options: ['m3/hr', 'LPM', 'CMD'] },
      { type: 'text', id: 'f1_tank_size', label: 'Ukuran Tank FRP', placeholder: 'ex: 1465 / 2162' },
      { type: 'measure', id: 'f1_media_vol', unitId: 'f1_media_unit', label: 'Volume Media', placeholder: 'ex: 175', options: ['Liters', 'Bag', 'kg'] },
      { type: 'text', id: 'f1_media_type', label: 'Jenis Media', placeholder: 'ex: Anthracite & Silica Sand' },
      { type: 'group', label: 'Valve Control & Qty', items: [
        { id: 'f1_valve', placeholder: 'ex: Manual Multiport', flex: 3 },
        { id: 'f1_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'textarea', id: 'f1_additional_items', label: 'Item Tambahan', placeholder: 'ex:\n- Pressure Gauge 0-6 Bar' },
    ],
  },
  {
    key: 'filter_2', toggleId: 'has_filter_2', title: 'Filter 2 (ACF)',
    fields: [
      { type: 'text', id: 'f2_type', label: 'Nama / Tipe Filter', placeholder: 'ex: Activated Carbon Filter' },
      { type: 'measure', id: 'f2_cap', unitId: 'f2_unit', label: 'Kapasitas', placeholder: 'ex: 5', options: ['m3/hr', 'LPM', 'CMD'] },
      { type: 'text', id: 'f2_tank_size', label: 'Ukuran Tank FRP', placeholder: 'ex: 1465 / 2162' },
      { type: 'measure', id: 'f2_media_vol', unitId: 'f2_media_unit', label: 'Volume Media', placeholder: 'ex: 175', options: ['Liters', 'Bag', 'kg'] },
      { type: 'text', id: 'f2_media_type', label: 'Jenis Media', placeholder: 'ex: Activated Carbon' },
      { type: 'group', label: 'Valve Control & Qty', items: [
        { id: 'f2_valve', placeholder: 'ex: Manual Multiport', flex: 3 },
        { id: 'f2_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'textarea', id: 'f2_additional_items', label: 'Item Tambahan', placeholder: 'ex:\n- Pressure Gauge 0-6 Bar' },
    ],
  },
  {
    key: 'uf', toggleId: 'has_uf', title: 'Ultra Filtration',
    fields: [
      { type: 'text', id: 'uf_model', label: 'UF Model Name', placeholder: 'ex: MTN-27H-B90-04' },
      { type: 'measure', id: 'uf_cap', unitId: 'uf_unit', label: 'Kapasitas', placeholder: 'ex: 2.7', options: ['m3/hr', 'LPM', 'CMD'] },
      { type: 'group', label: 'UF Feed Water Pump', items: [
        { id: 'uf_fwp_brand', placeholder: 'Brand', flex: 1 }, { id: 'uf_fwp_model', placeholder: 'Model', flex: 2 },
        { id: 'uf_fwp_cap', placeholder: 'm3/hr', flex: 1 }, { id: 'uf_fwp_kw', placeholder: 'kW', flex: 1 }, { id: 'uf_fwp_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'group', label: 'UF Backwash Pump', items: [
        { id: 'uf_bwp_brand', placeholder: 'Brand', flex: 1 }, { id: 'uf_bwp_model', placeholder: 'Model', flex: 2 },
        { id: 'uf_bwp_cap', placeholder: 'm3/hr', flex: 1 }, { id: 'uf_bwp_kw', placeholder: 'kW', flex: 1 }, { id: 'uf_bwp_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'group', label: 'Air Blower', items: [
        { id: 'uf_blower_brand', placeholder: 'Brand (Backport)', flex: 1 }, { id: 'uf_blower_model', placeholder: 'Model (Rb750)', flex: 2 },
        { id: 'uf_blower_kw', placeholder: 'kW', flex: 1 }, { id: 'uf_blower_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'group', label: 'Membrane Specs', items: [
        { id: 'uf_mem_brand', placeholder: 'Brand', flex: 1 }, { id: 'uf_mem_model', placeholder: 'Model', flex: 2 }, { id: 'uf_mem_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'measure', id: 'uf_cip_tank_cap', unitId: 'uf_cip_tank_unit', label: 'CIP Tank', placeholder: 'ex: 300', options: ['Liters', 'm3'] },
      { type: 'text', id: 'uf_cip_tank_mat', label: 'CIP Tank Material', placeholder: 'ex: PE' },
      { type: 'text', id: 'uf_fm_qty', label: 'Flowmeter Qty', placeholder: 'ex: 1' },
      { type: 'text', id: 'uf_sv_qty', label: 'Solenoid Valve Qty', placeholder: 'ex: 3' },
      { type: 'text', id: 'uf_ps_qty', label: 'Pressure Switch Qty', placeholder: 'ex: 2' },
      { type: 'text', id: 'uf_pg_qty', label: 'Pressure Gauge Qty', placeholder: 'ex: 3' },
      { type: 'textarea', id: 'uf_additional_items', label: 'Item Tambahan', placeholder: 'ex:\n- 2 units of Pressure switch Saginomiya, 0-6 bar' },
    ],
  },
  {
    key: 'int_tank', toggleId: 'has_int_tank', title: 'Intermediate Tank',
    fields: [
      { type: 'measure', id: 'int_tank_cap', unitId: 'int_tank_unit', label: 'Kapasitas', placeholder: 'ex: 500', options: ['Liters', 'm3'] },
      { type: 'text', id: 'int_tank_mat', label: 'Material', placeholder: 'ex: PE / PP' },
      { type: 'textarea', id: 'int_additional_items', label: 'Item Tambahan', placeholder: 'ex:\n- Level Switch Radar' },
    ],
  },
  {
    key: 'softener', toggleId: 'has_softener', title: 'Softener System',
    fields: [
      { type: 'text', id: 'soft_model', label: 'Softener Model', placeholder: 'ex: TS-30 P' },
      { type: 'measure', id: 'soft_cap', unitId: 'soft_unit', label: 'Kapasitas', placeholder: 'ex: 2.7', options: ['m3/hr', 'LPM', 'CMD'] },
      { type: 'text', id: 'soft_tank_size', label: 'FRP Size', placeholder: 'ex: 1465' },
      { type: 'text', id: 'soft_controller', label: 'Controller', placeholder: 'ex: Autotrol 255-740 c/w microswitch' },
      { type: 'measure', id: 'soft_resin_vol', unitId: 'soft_resin_unit', label: 'Resin Cation', placeholder: 'ex: 100', options: ['Liters', 'Bag', 'kg'] },
      { type: 'measure', id: 'soft_brine_cap', unitId: 'soft_brine_unit', label: 'Brine Tank', placeholder: 'ex: 200', options: ['Liters', 'm3'] },
      { type: 'textarea', id: 'soft_additional_items', label: 'Item Tambahan', placeholder: 'ex:\n- 1 unit of Solenoid valve nylon 1"\n- 1 bag of Salt' },
    ],
  },
  {
    key: 'ro', toggleId: 'has_ro', title: 'Reverse Osmosis Package (RO + Anti Scalant + CIP)',
    fields: [
      { type: 'subheading', label: 'A. Main Reverse Osmosis Unit' },
      { type: 'text', id: 'ro_model', label: 'RO Unit Model', placeholder: 'ex: BT40-40K-0840' },
      { type: 'measure', id: 'ro_cap', unitId: 'ro_unit', label: 'Kapasitas', placeholder: 'ex: 40', options: ['m3/hr', 'LPM', 'CMD'] },
      { type: 'group', label: 'RO Feed Water Pump', items: [
        { id: 'ro_fwp_brand', placeholder: 'Brand (ex: CNP)', flex: 1 }, { id: 'ro_fwp_model', placeholder: 'Model', flex: 2 },
        { id: 'ro_fwp_cap', placeholder: 'm3/hr', flex: 1 }, { id: 'ro_fwp_kw', placeholder: 'kW', flex: 1 }, { id: 'ro_fwp_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'group', label: 'RO Booster Pump', items: [
        { id: 'ro_bp_brand', placeholder: 'Brand (ex: GRUNDFOS)', flex: 1 }, { id: 'ro_bp_model', placeholder: 'Model (ex: CR 64-5-1)', flex: 2 },
        { id: 'ro_bp_kw', placeholder: 'Power kW', flex: 1 }, { id: 'ro_bp_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'group', label: 'Membrane Specs', items: [
        { id: 'ro_mem_brand', placeholder: 'Brand', flex: 1 }, { id: 'ro_mem_model', placeholder: 'Model', flex: 2 }, { id: 'ro_mem_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'group', label: 'Pressure Vessel Specs', items: [
        { id: 'ro_vessel_brand', placeholder: 'Brand', flex: 1 }, { id: 'ro_vessel_model', placeholder: 'Model', flex: 2 }, { id: 'ro_vessel_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'group', label: 'Cartridge Filter Housing', items: [
        { id: 'ro_cfh_mat', placeholder: 'Mat (SS)', flex: 1 }, { id: 'ro_cfh_model', placeholder: 'Model', flex: 2 }, { id: 'ro_cfh_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'group', label: '5-Micron Cartridge Filter', items: [
        { id: 'ro_cf_size', placeholder: 'Size (ex: 40” length)', flex: 3 }, { id: 'ro_cf_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'group', label: 'Product Flowmeter', items: [
        { id: 'ro_fm_prod_model', placeholder: 'Model (ex: Digital RTP...)', flex: 3 }, { id: 'ro_fm_prod_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'group', label: 'Reject Flowmeter', items: [
        { id: 'ro_fm_rej_model', placeholder: 'Model (ex: Inline 198...)', flex: 3 }, { id: 'ro_fm_rej_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'group', label: 'Conductivity Meter', items: [
        { id: 'ro_cond_model', placeholder: 'Model (ex: Analog Myron 0-200 µS/cm)', flex: 3 }, { id: 'ro_cond_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'textarea', id: 'ro_additional_items', label: 'Instrumen RO Tambahan', placeholder: 'ex:\n- Pressure Switch Saginomiya, 0-30 bar, Qty: 1 unit\n- Pressure Gauge Panel Mount, Qty: 2 units' },

      { type: 'subheading', label: 'B. Anti Scalant System' },
      { type: 'group', label: 'Chemical Tank Specs', items: [
        { id: 'as_tank_mat', placeholder: 'Material (ex: PE)', flex: 2 }, { id: 'as_tank_cap', placeholder: 'Cap (Liters)', flex: 1 }, { id: 'as_tank_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'group', label: 'Dosing Pump Specs', items: [
        { id: 'as_pump_brand', placeholder: 'Brand', flex: 1 }, { id: 'as_pump_model', placeholder: 'Model', flex: 1 },
        { id: 'as_pump_cap', placeholder: 'Cap (LPH)', flex: 1 }, { id: 'as_pump_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'textarea', id: 'as_additional_items', label: 'Item Tambahan', placeholder: 'ex:\n- Static mixer...' },

      { type: 'subheading', label: 'C. Chemical Cleaning System (CIP)' },
      { type: 'group', label: 'Cleaning Pump Specs', items: [
        { id: 'ro_cip_pump_brand', placeholder: 'Brand', flex: 1 }, { id: 'ro_cip_pump_model', placeholder: 'Model', flex: 1 },
        { id: 'ro_cip_pump_kw', placeholder: 'Power kW', flex: 1 }, { id: 'ro_cip_pump_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'group', label: 'Chemical / Flushing Tank', items: [
        { id: 'ro_cip_tank_mat', placeholder: 'Material (ex: PE)', flex: 2 }, { id: 'ro_cip_tank_cap', placeholder: 'Cap (Liters)', flex: 1 }, { id: 'ro_cip_tank_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'textarea', id: 'ro_cip_additional_items', label: 'Item Tambahan', placeholder: 'ex:\n- CIP Bag Filter...' },
    ],
  },
  {
    key: 'cip', toggleId: 'has_cip', title: 'Chemical Dosing System (Standalone)',
    fields: [
      { type: 'group', label: 'Dosing Pump Specs', items: [
        { id: 'std_cip_pump_brand', placeholder: 'Brand', flex: 1 }, { id: 'std_cip_pump_model', placeholder: 'Model', flex: 1 },
        { id: 'std_cip_pump_cap', placeholder: 'Cap (LPH)', flex: 1 }, { id: 'std_cip_pump_qty', placeholder: 'Qty', flex: 1 },
      ] },
      { type: 'measure', id: 'std_cip_tank_cap', unitId: 'std_cip_tank_unit', label: 'Tank Cap', placeholder: 'ex: 300', options: ['Liters', 'm3'] },
      { type: 'text', id: 'std_cip_tank_mat', label: 'Tank Material', placeholder: 'ex: Polyethylene' },
      { type: 'text', id: 'std_cip_tank_qty', label: 'Tank Qty', placeholder: 'ex: 1' },
      { type: 'textarea', id: 'std_cip_additional_items', label: 'Item Tambahan', placeholder: 'ex:\n- Selang dosing & injector valve' },
    ],
  },
  {
    key: 'panel', toggleId: 'has_panel', title: 'Control Panel',
    fields: [
      { type: 'text', id: 'panel_size', label: 'Panel Size (mm)', placeholder: 'ex: 1000 x 800 x 300' },
      { type: 'textarea', id: 'panel_additional_items', label: 'Item Tambahan', placeholder: 'ex:\n- PLC Siemens S7-1200\n- HMI Weintek 7 inch' },
    ],
  },
];

export function buildHandoverEmpty() {
  const empty = {
    system_title: '', contractor_name: 'PT Bening Khatulistiwa', buyer_company: '', project_name: '', po_number: '', location: '',
  };
  HANDOVER_SECTIONS.forEach((sec) => {
    empty[sec.toggleId] = false;
    sec.fields.forEach((f) => {
      if (f.type === 'text' || f.type === 'textarea') empty[f.id] = '';
      else if (f.type === 'measure') { empty[f.id] = ''; empty[f.unitId] = f.options[0]; }
      else if (f.type === 'group') f.items.forEach((it) => { empty[it.id] = ''; });
    });
  });
  return empty;
}
