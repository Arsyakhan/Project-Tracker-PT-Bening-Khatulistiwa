// Spesifikasi Peralatan (form Hand Over) diambil dari TEKNOLOGI project.
//
// Sumbernya dua: (1) kapasitas + satuan tiap modul di grid teknologi, dan (2) teks "Detail Spesifikasi" yang ditulis
// per modul, dibaca oleh pembaca (parser) di file ini. Pembacanya aturan tetap (bukan AI yang menebak saat dipakai),
// disusun dari kebiasaan menulis di Detail Spesifikasi arsip: judul peralatan ("P-01 FEED PUMP"), lalu baris
// "Label : isi" (Model, Capacity, Power, Qty, Material, Media, ...). Satu sel boleh memuat beberapa peralatan,
// masing-masing dengan judulnya sendiri (mis. RO: pompa feed, booster, membran, dst.).
//
// Hasilnya HANYA nilai awal otomatis. Isian yang diketik manual di Spesifikasi Peralatan tetap menang
// (lihat buildSpecValues / packSpecs di lib/docgen/specs.js).
import { toSpecCap } from './techflow';
import { EXTRA_SECTIONS, EXTRA_MODULE_KEYS, EXTRA_TEMPLATES, EXTRA_EXAMPLES } from './docgen/specExtra';

// ---------------------------------------------------------------------------------------------
// 1. Memecah teks menjadi blok peralatan
// ---------------------------------------------------------------------------------------------
const upperRatio = (s) => {
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (letters.length < 3) return 0;
  return letters.replace(/[^A-Z]/g, '').length / letters.length;
};

// Label (teks sebelum titik dua) -> kunci baku.
const LABEL_KEYS = [
  ['brandmodel', /^(brand|merk|merek)\s*\/\s*(model|type|tipe)$/i],
  ['brand', /^(brand|merk|merek)$/i],
  ['model', /^(model|model name|model no\.?)$/i],
  ['cap', /^(cap|capacity|kapasitas|debit|flow ?rate|flow)$/i],
  ['type', /^(type|tipe|jenis)$/i],
  ['power', /^(power|daya|motor)$/i],
  ['qty', /^(qty|quantity|jumlah)$/i],
  ['material', /^(material|tank material|mat|bahan|material tank|material tangki)$/i],
  ['size', /^(size|ukuran|dimensi|dimension|dimensions|tank size|frp size|ukuran tank|tank frp)$/i],
  ['media', /^(media|jenis media|media type)$/i],
  ['volume', /^(volume|media volume|vol|volume media)$/i],
  ['valve', /^(valve|valve control|control valve|jenis valve)$/i],
  ['controller', /^(controller|kontrol|control)$/i],
  ['resin', /^(resin|resin cation|resin volume|volume resin)$/i],
  ['brine', /^(brine|brine tank|brine cap|brine capacity)$/i],
];

function labelKey(label) {
  const l = String(label).trim();
  const hit = LABEL_KEYS.find(([, re]) => re.test(l));
  return hit ? hit[0] : null;
}

// Teks Detail Spesifikasi -> [{ title, f: { kunci: nilai }, rows: [{label, value}] }].
//  - baris "Label : isi" = isian blok ini (nilai pertama untuk tiap kunci yang dipakai);
//  - baris tanpa titik dua = judul blok baru (kalau blok belum punya isian, atau ditulis HURUF BESAR),
//    selain itu dianggap lanjutan isian sebelumnya ("with epoxy painting", "(one service, one standby)").
export function parseDetail(text) {
  const blocks = [];
  let cur = null;
  const open = (title) => {
    cur = { title: title || '', f: {}, rows: [] };
    blocks.push(cur);
  };
  String(text || '').split(/\r?\n/).forEach((raw) => {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) return;
    const m = line.match(/^([^:：]{1,45}?)\s*[:：]\s*(.*)$/);
    if (m && !/^\d+$/.test(m[1])) {
      if (!cur) open('');
      const label = m[1].trim();
      const value = m[2].trim();
      cur.rows.push({ label, value });
      const key = labelKey(label);
      if (key && value && cur.f[key] === undefined) cur.f[key] = value;
      return;
    }
    if (!cur || cur.rows.length === 0) {
      // Judul bisa terdiri dari beberapa baris ("P-101.1A/B" lalu "INTAKE WATER PUMP").
      if (cur && cur.rows.length === 0) cur.title = `${cur.title} ${line}`.trim();
      else open(line);
      return;
    }
    if (upperRatio(line) > 0.6) { open(line); return; }
    // Lanjutan nilai sebelumnya.
    const last = cur.rows[cur.rows.length - 1];
    last.value = `${last.value} ${line}`.trim();
    const key = labelKey(last.label);
    if (key && cur.f[key] !== undefined) cur.f[key] = last.value;
  });
  return blocks;
}

// ---------------------------------------------------------------------------------------------
// 2. Mengambil angka / satuan dari nilai
// ---------------------------------------------------------------------------------------------
function numFrom(str) {
  const m = String(str ?? '').match(/\d[\d.,]*/);
  if (!m) return null;
  let s = m[0].replace(/[.,]+$/, '');
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');       // 100,000 -> 100000
  else if (/^\d{1,3}(\.\d{3})+$/.test(s) && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, ''); // 100.000 -> 100000
  else s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
const round3 = (n) => String(Math.round(n * 1000) / 1000);

// Nilai + satuannya: "5 M3/hr @ 20 m" -> { n: 5, unit: 'm3/hr' }; "100,000 Liter" -> { n: 100000, unit: 'Liters' }.
const UNIT_RULES = [
  ['m3/hr', /(\d[\d.,]*)\s*(?:m3|m³|m\^3)\s*\/\s*(?:h|hr|hour|jam)\b/i],
  ['m3/hr', /(\d[\d.,]*)\s*(?:cmh|mph)\b/i],
  ['LPM', /(\d[\d.,]*)\s*(?:lpm|l\s*\/\s*min|liters?\s*\/\s*min)\b/i],
  ['CMD', /(\d[\d.,]*)\s*(?:cmd|(?:m3|m³)\s*\/\s*(?:day|d|hari))\b/i],
  ['LPH', /(\d[\d.,]*)\s*(?:lph|l\s*\/\s*h|liters?\s*\/\s*h)\b/i],
  ['Liters', /(\d[\d.,]*)\s*(?:liters?|litres?|ltr|lt|l)\b/i],
  ['m3', /(\d[\d.,]*)\s*(?:m3|m³)\b/i],
  ['Bag', /(\d[\d.,]*)\s*(?:bags?|sak|karung)\b/i],
  ['kg', /(\d[\d.,]*)\s*kg\b/i],
];
function measureOf(str) {
  const s = String(str ?? '');
  for (const [unit, re] of UNIT_RULES) {
    const m = s.match(re);
    if (m) {
      const n = numFrom(m[1]);
      if (n !== null) return { n, unit };
    }
  }
  const n = numFrom(s);
  return n === null ? null : { n, unit: '' };
}

// Debit dalam m3/jam (untuk kolom pompa yang hanya berisi angka m3/hr).
function flowM3h(str) {
  const m = measureOf(str);
  if (!m) return null;
  if (m.unit === 'm3/hr' || m.unit === '') return m.n;
  if (m.unit === 'LPM') return (m.n * 60) / 1000;
  if (m.unit === 'LPH') return m.n / 1000;
  return null;
}
const litersOf = (str) => {
  const m = measureOf(str);
  if (!m) return null;
  if (m.unit === 'Liters' || m.unit === '') return m.n;
  if (m.unit === 'm3') return m.n * 1000;
  return null;
};

const kwOf = (str) => {
  const m = String(str ?? '').match(/(\d[\d.,]*)\s*kw\b/i);
  return m ? numFrom(m[1]) : null;
};
const qtyOf = (str) => {
  const m = String(str ?? '').match(/\d+/);
  return m ? m[0] : '';
};

// Merk & model: "Brand/Model: CNP/CHL 20-20", "Model : southern, CHL-4-30", atau Brand dan Model terpisah.
function brandModel(f) {
  let brand = f.brand || '';
  let model = f.model || '';
  const combined = f.brandmodel || '';
  const split = (s) => {
    const parts = String(s).split(/\s*[\/,]\s*/);
    if (parts.length >= 2 && !/\d/.test(parts[0])) return [parts[0], parts.slice(1).join(' / ')];
    return ['', s];
  };
  if (combined && !brand && !model) [brand, model] = split(combined);
  else if (!brand && model) {
    const [b, mdl] = split(model);
    if (b) { brand = b; model = mdl; }
  }
  return { brand: brand.trim(), model: model.trim() };
}

// ---------------------------------------------------------------------------------------------
// 3. Bentuk isian per jenis peralatan -> id field Hand Over
// ---------------------------------------------------------------------------------------------
// Tiap fungsi menerima blok (hasil parseDetail) dan mengembalikan { akhiran: nilai }.
const FIELD_KINDS = {
  // brand, model, cap (m3/hr), kW, qty
  pump: (b) => {
    const bm = brandModel(b.f);
    const cap = flowM3h(b.f.cap) ?? (b.f.type ? flowM3h(b.f.type) : null);
    return { brand: bm.brand, model: bm.model, cap: cap === null ? '' : round3(cap), kw: kwOf(b.f.power) === null ? '' : round3(kwOf(b.f.power)), qty: qtyOf(b.f.qty) };
  },
  // brand, model, kW, qty (booster, blower, pompa CIP)
  pumpkw: (b) => {
    const bm = brandModel(b.f);
    return { brand: bm.brand, model: bm.model, kw: kwOf(b.f.power) === null ? '' : round3(kwOf(b.f.power)), qty: qtyOf(b.f.qty) };
  },
  // pompa dosing: brand, model, cap (LPH), qty
  dose: (b) => {
    const bm = brandModel(b.f);
    const cm = measureOf(b.f.cap);
    let lph = '';
    if (cm) lph = cm.unit === 'LPH' || cm.unit === '' ? round3(cm.n) : cm.unit === 'LPM' ? round3(cm.n * 60) : '';
    return { brand: bm.brand, model: bm.model, cap: lph, qty: qtyOf(b.f.qty) };
  },
  // membran: brand, model, qty
  membrane: (b) => {
    const bm = brandModel(b.f);
    return { brand: bm.brand, model: bm.model, qty: qtyOf(b.f.qty) };
  },
  // housing cartridge: bahan, model, qty
  housing: (b) => ({ mat: b.f.material || '', model: brandModel(b.f).model, qty: qtyOf(b.f.qty) }),
  // cartridge 5 micron: ukuran, qty
  cartridge: (b) => ({ size: b.f.size || b.f.type || '', qty: qtyOf(b.f.qty) }),
  // instrumen: model, qty
  meter: (b) => ({ model: [brandModel(b.f).brand, brandModel(b.f).model].filter(Boolean).join(' ') || b.f.type || '', qty: qtyOf(b.f.qty) }),
  // tangki bahan kimia: bahan, kapasitas (liter, angka), qty
  tank: (b) => {
    const l = litersOf(b.f.cap || b.f.volume);
    return { mat: b.f.material || '', cap: l === null ? '' : round3(l), qty: qtyOf(b.f.qty) };
  },
  qty: (b) => ({ qty: qtyOf(b.f.qty) }),
};

// Sub-peralatan dalam Detail sebuah modul: [ judul cocok, awalan id field, jenis ].
const SUBS = {
  uf: [
    [/back ?wash/i, 'uf_bwp', 'pump'],
    [/blower/i, 'uf_blower', 'pumpkw'],
    [/membran|membrane/i, 'uf_mem', 'membrane'],
    [/flow ?meter/i, 'uf_fm', 'qty'],
    [/solenoid/i, 'uf_sv', 'qty'],
    [/pressure switch/i, 'uf_ps', 'qty'],
    [/pressure gauge/i, 'uf_pg', 'qty'],
    [/(cip|cleaning).*(tank|tangki)|(tank|tangki).*(cip|cleaning)/i, 'uf_cip_tank', 'cliptank'],
    [/feed/i, 'uf_fwp', 'pump'],
  ],
  ro: [
    [/booster/i, 'ro_bp', 'pumpkw'],
    [/membran|membrane/i, 'ro_mem', 'membrane'],
    [/vessel/i, 'ro_vessel', 'membrane'],
    [/housing/i, 'ro_cfh', 'housing'],
    [/micron|cartridge/i, 'ro_cf', 'cartridge'],
    [/product.*flow|flow.*product/i, 'ro_fm_prod', 'meter'],
    [/reject.*flow|flow.*reject/i, 'ro_fm_rej', 'meter'],
    [/conductiv/i, 'ro_cond', 'meter'],
    [/(anti ?scalant|scalant).*(tank|tangki)|(tank|tangki).*(anti ?scalant|scalant)/i, 'as_tank', 'tank'],
    [/(anti ?scalant|scalant|dosing).*pump|pump.*(anti ?scalant|scalant|dosing)/i, 'as_pump', 'dose'],
    [/(cip|cleaning).*pump|pump.*(cip|cleaning)/i, 'ro_cip_pump', 'pumpkw'],
    [/(cip|cleaning|flushing|chemical).*(tank|tangki)|(tank|tangki).*(cip|cleaning|flushing)/i, 'ro_cip_tank', 'tank'],
    // Pompa yang mengumpan RO adalah modul Booster Feed Pump. Blok "RO FEED WATER PUMP" di Detail RO (tulisan lama) tidak
    // punya kolom lagi, tetapi tetap harus dikenali supaya tidak terbaca sebagai unit RO; isinya tercetak sebagai baris
    // tambahan (lib/docgen/techDetail.js), jadi tidak ada data yang hilang.
    [/feed/i, null, 'skip'],
  ],
};

// Nilai kapasitas UF: tangki CIP UF memakai pasangan kapasitas + satuan (Liters / m3).
FIELD_KINDS.cliptank = (b) => {
  const m = measureOf(b.f.cap || b.f.volume);
  const unit = m && (m.unit === 'm3' || m.unit === 'Liters') ? m.unit : (m ? 'Liters' : '');
  return { cap: m ? round3(m.n) : '', unit, mat: b.f.material || '' };
};

// ---------------------------------------------------------------------------------------------
// 3b. Pembaca teks untuk seksi tambahan (definisi kolomnya di lib/docgen/specExtra.js)
// ---------------------------------------------------------------------------------------------
// Isi di belakang titik dua ("Label : isi") dipindah ke kolom yang sesuai; polanya sama dengan seksi bawaan.
const TEXT_READERS = {
  model: (b) => { const bm = brandModel(b.f); return [bm.brand, bm.model].filter(Boolean).join(' '); },
  type: (b) => b.f.type || '',
  mat: (b) => b.f.material || '',
  size: (b) => b.f.size || '',
  media: (b) => b.f.media || '',
  valve: (b) => b.f.valve || b.f.controller || '',
  qty: (b) => qtyOf(b.f.qty),
  // "1.5 kW"; angka saja (tanpa satuan) pada kolom Daya dianggap kW.
  kw: (b) => {
    const k = kwOf(b.f.power);
    if (k !== null) return round3(k);
    return /^\s*\d+([.,]\d+)?\s*$/.test(b.f.power || '') ? round3(numFrom(b.f.power)) : '';
  },
};
// Nilai baris pertama yang labelnya cocok dengan pola (untuk label yang tidak punya kunci baku).
const rowValue = (b, re) => { const r = b.rows.find((x) => re.test(x.label) && x.value); return r ? r.value : ''; };

// Nilai + satuan sesuai jenis ukuran kolom (flow: m3/hr|LPM|CMD, volume: Liters|m3, media: Liters|Bag|kg).
function measureFor(mkind, str) {
  const mm = measureOf(str);
  if (!mm || !(mm.n > 0)) return null;
  if (mkind === 'flow') {
    if (['m3/hr', 'LPM', 'CMD'].includes(mm.unit)) return { n: mm.n, unit: mm.unit };
    if (mm.unit === 'LPH') return { n: mm.n / 1000, unit: 'm3/hr' };
    return mm.unit === '' ? { n: mm.n, unit: 'm3/hr' } : null;
  }
  if (mkind === 'volume') {
    if (mm.unit === 'm3') return { n: mm.n, unit: 'm3' };
    return mm.unit === 'Liters' || mm.unit === '' ? { n: mm.n, unit: 'Liters' } : null;
  }
  if (['Liters', 'Bag', 'kg'].includes(mm.unit)) return { n: mm.n, unit: mm.unit };
  if (mm.unit === 'm3') return { n: mm.n * 1000, unit: 'Liters' };
  return mm.unit === '' ? { n: mm.n, unit: 'Liters' } : null;
}

// ---------------------------------------------------------------------------------------------
// 4. Teknologi -> nilai Spesifikasi Peralatan
// ---------------------------------------------------------------------------------------------
const FILTER_SLOTS = ['birm', 'mmf', 'acf'];

/**
 * Nilai Spesifikasi Peralatan (id field Hand Over -> nilai) yang bisa diturunkan dari teknologi project.
 * @param {Array<{key,cap,unit,detail}>} modules teknologi (gridModules)
 * @returns {{ values: Object, found: Object }} values = nilai awal otomatis; found[modul] = jumlah kolom yang terisi
 *          dari modul itu (0 untuk modul ber-Detail yang tidak terbaca sama sekali).
 */
export function specsFromTech(modules) {
  const values = {};
  const found = {};
  const by = {};
  (modules || []).forEach((m) => { if (m && m.key && !by[m.key]) by[m.key] = m; });

  const put = (moduleKey, id, value) => {
    const v = String(value ?? '').trim();
    if (!v) return;
    if (values[id] === undefined) {
      values[id] = v;
      found[moduleKey] = (found[moduleKey] || 0) + 1;
    }
  };
  // Pasangan ukur + satuan: angka dan satuan selalu diisi bersama.
  const putMeasure = (moduleKey, capId, unitId, n, unit) => {
    if (n === null || n === undefined || n === '' || values[capId] !== undefined) return;
    put(moduleKey, capId, typeof n === 'number' ? round3(n) : n);
    if (unitId && unit) values[unitId] = unit;
  };
  // Kapasitas utama modul: dari kolom Kapasitas + Satuan di grid, kalau kosong dari Detail.
  const gridCap = (m, kind) => toSpecCap(m.cap, String(m.unit || '').toUpperCase(), kind);
  const mainCap = (m, block, capId, unitId, kind) => {
    const g = gridCap(m, kind);
    if (g) return putMeasure(m.key, capId, unitId, g.value, g.unit);
    if (block && block.f.cap !== undefined) {
      const mm = measureOf(block.f.cap);
      if (mm && mm.n > 0) {
        const unit = kind === 'flow' ? (['m3/hr', 'LPM', 'CMD'].includes(mm.unit) ? mm.unit : (mm.unit === '' ? 'm3/hr' : '')) : (['Liters', 'm3'].includes(mm.unit) ? mm.unit : (mm.unit === '' ? 'Liters' : ''));
        if (unit) putMeasure(m.key, capId, unitId, mm.n, unit);
      }
    }
  };
  const fill = (moduleKey, prefix, fields) => {
    Object.keys(fields).forEach((suffix) => put(moduleKey, `${prefix}_${suffix}`, fields[suffix]));
  };
  const blocksOf = (m) => (m && m.detail ? parseDetail(m.detail) : []);
  const firstBlock = (blocks) => blocks[0] || null;

  // Sub-peralatan dari blok-blok sebuah Detail (modul uf / ro). Mengembalikan blok utama (yang tidak cocok sub apa pun).
  const applySubs = (m, blocks, subs) => {
    let main = null;
    blocks.forEach((b) => {
      const sub = subs.find(([re]) => re.test(b.title));
      if (!sub) { if (!main) main = b; return; }
      const [, prefix, kind] = sub;
      if (!prefix) return; // blok dikenali tetapi tidak punya kolom (lihat SUBS.ro)
      const fields = FIELD_KINDS[kind](b);
      if (kind === 'cliptank') {
        putMeasure(m.key, `${prefix}_cap`, `${prefix}_unit`, fields.cap, fields.unit);
        put(m.key, `${prefix}_mat`, fields.mat);
      } else fill(m.key, prefix, fields);
    });
    return main;
  };

  // Seksi tambahan (modul tanpa seksi di template Hand Over). Dibaca lebih dulu: modul tersendiri (mis. Pompa cleaning)
  // menang atas blok sejenis yang ditulis di dalam Detail modul lain (mis. blok CIP di Detail RO).
  const readExtra = (sec, m) => {
    const blocks = blocksOf(m);
    const subs = sec.fields.filter((f) => f.src && f.src.role === 'sub');
    let main = null;
    const matched = [];
    if (blocks.length === 1) main = blocks[0]; // satu blok saja = peralatan utama modul ini
    else {
      blocks.forEach((b) => {
        const sub = subs.find((f) => f.src.match.test(b.title));
        if (sub) matched.push([sub, b]);
        else if (!main) main = b;
      });
    }
    const fillGroup = (f, b, isMain) => {
      const fields = b ? FIELD_KINDS[f.gkind](b) : {};
      if (isMain && f.gkind === 'pump') {
        const g = gridCap(m, 'flow');
        if (g) put(m.key, `${f.prefix}_cap`, g.unit === 'CMD' ? round3(Number(g.value) / 24) : g.value);
      }
      if (isMain && f.gkind === 'tank') {
        const g = gridCap(m, 'volume');
        if (g) put(m.key, `${f.prefix}_cap`, g.value);
      }
      fill(m.key, f.prefix, fields);
    };
    sec.fields.filter((f) => f.src && f.src.role === 'main').forEach((f) => {
      const s = f.src;
      if (f.type === 'group') return fillGroup(f, main, true);
      if (f.type === 'text') {
        if (!main) return;
        put(m.key, f.id, s.re ? rowValue(main, s.re) : (TEXT_READERS[s.read || s.name] || (() => ''))(main));
        return;
      }
      // Ukuran + satuan. Kolom "cap" = kapasitas modul: kolom Kapasitas di grid dulu, baru teks Detail.
      if (s.name === 'cap') {
        mainCap(m, main, f.id, f.unitId, s.mkind === 'volume' ? 'volume' : 'flow');
        if (values[f.id] === undefined && main && s.mkind === 'volume') {
          const mv = measureFor('volume', main.f.volume);
          if (mv) putMeasure(m.key, f.id, f.unitId, mv.n, mv.unit);
        }
        return;
      }
      if (!main) return;
      const raw = s.re ? rowValue(main, s.re) : main.f[s.from || (s.name === 'vol' ? 'volume' : s.name)];
      const mm = measureFor(s.mkind, raw);
      if (mm) putMeasure(m.key, f.id, f.unitId, mm.n, mm.unit);
    });
    matched.forEach(([f, b]) => { if (!f.src.retired) fillGroup(f, b, false); }); // kolom pensiun: blok dikenali, tidak dibaca
  };
  // Filter yang tidak muat di 2 slot template (Birm -> MMF -> Carbon): hanya yang ke-3 yang dibaca ke seksi tambahan.
  const overflowFilters = new Set(['birm', 'mmf', 'acf'].filter((k) => by[k]).slice(2));
  EXTRA_SECTIONS.forEach((sec) => {
    if (sec.key === 'x_dosing') return; // pompa dosing hanya "Ada", tidak punya Detail
    const m = by[sec.modules[0]];
    if (!m || (sec.overflow && !overflowFilters.has(m.key))) return;
    readExtra(sec, m);
  });

  // --- Air baku ---
  if (by.feed_pump) {
    const b = firstBlock(blocksOf(by.feed_pump));
    const g = gridCap(by.feed_pump, 'flow');
    if (g) put('feed_pump', 'rw_pump_cap', g.value);
    if (b) fill('feed_pump', 'rw_pump', FIELD_KINDS.pump(b));
  }
  if (by.raw_tank) {
    const m = by.raw_tank;
    const b = firstBlock(blocksOf(m));
    mainCap(m, b, 'rw_tank_cap', 'rw_tank_unit', 'volume');
    if (b) {
      if (values.rw_tank_cap === undefined) {
        const mm = measureOf(b.f.volume);
        if (mm) putMeasure('raw_tank', 'rw_tank_cap', 'rw_tank_unit', mm.n, mm.unit === 'm3' ? 'm3' : 'Liters');
      }
      put('raw_tank', 'rw_tank_mat', b.f.material);
      put('raw_tank', 'rw_tank_qty', qtyOf(b.f.qty));
    }
  }
  // --- Clarifier ---
  if (by.clarifier) {
    const m = by.clarifier;
    const b = firstBlock(blocksOf(m));
    mainCap(m, b, 'clarifier_cap', 'clarifier_unit', 'flow');
    if (b) put('clarifier', 'clarifier_mat', b.f.material);
  }
  // --- Filter (2 slot Hand Over: Birm -> MMF -> Carbon) ---
  FILTER_SLOTS.filter((k) => by[k]).slice(0, 2).forEach((k, i) => {
    const m = by[k];
    const slot = i === 0 ? 'f1' : 'f2';
    const b = firstBlock(blocksOf(m));
    mainCap(m, b, `${slot}_cap`, `${slot}_unit`, 'flow');
    if (!b) return;
    put(k, `${slot}_tank_size`, b.f.size);
    const vol = measureOf(b.f.volume);
    if (vol && vol.n > 0) putMeasure(k, `${slot}_media_vol`, `${slot}_media_unit`, vol.n, ['Liters', 'Bag', 'kg'].includes(vol.unit) ? vol.unit : 'Liters');
    put(k, `${slot}_media_type`, b.f.media);
    put(k, `${slot}_valve`, b.f.valve || b.f.controller);
    put(k, `${slot}_qty`, qtyOf(b.f.qty));
  });
  // --- Softener ---
  if (by.softener) {
    const m = by.softener;
    const b = firstBlock(blocksOf(m));
    mainCap(m, b, 'soft_cap', 'soft_unit', 'flow');
    if (b) {
      put('softener', 'soft_model', brandModel(b.f).model || b.f.type);
      put('softener', 'soft_tank_size', b.f.size);
      put('softener', 'soft_controller', b.f.controller || b.f.valve);
      const rv = measureOf(b.f.resin);
      if (rv) putMeasure('softener', 'soft_resin_vol', 'soft_resin_unit', rv.n, ['Liters', 'Bag', 'kg'].includes(rv.unit) ? rv.unit : 'Liters');
      const br = measureOf(b.f.brine);
      if (br) putMeasure('softener', 'soft_brine_cap', 'soft_brine_unit', br.n, br.unit === 'm3' ? 'm3' : 'Liters');
    }
  }
  // Soft Water Tank (penampung air lunak) punya seksi sendiri (x_soft_tank); bukan Brine Tank softener.
  // --- UF ---
  if (by.uf_pump) {
    const b = firstBlock(blocksOf(by.uf_pump));
    const g = gridCap(by.uf_pump, 'flow');
    if (g) put('uf_pump', 'uf_fwp_cap', g.value);
    if (b) fill('uf_pump', 'uf_fwp', FIELD_KINDS.pump(b));
  }
  if (by.uf) {
    const m = by.uf;
    const main = applySubs(m, blocksOf(m), SUBS.uf);
    mainCap(m, main, 'uf_cap', 'uf_unit', 'flow');
    if (main) put('uf', 'uf_model', brandModel(main.f).model || main.f.type);
  }
  // --- RO ---
  if (by.booster) {
    const b = firstBlock(blocksOf(by.booster));
    if (b) fill('booster', 'ro_bp', FIELD_KINDS.pumpkw(b));
  }
  if (by.cartridge) {
    const bl = blocksOf(by.cartridge);
    const housing = bl.find((b) => /housing/i.test(b.title)) || bl[0];
    const cart = bl.find((b) => /micron|cartridge/i.test(b.title) && !/housing/i.test(b.title));
    if (housing) fill('cartridge', 'ro_cfh', FIELD_KINDS.housing(housing));
    if (cart) fill('cartridge', 'ro_cf', FIELD_KINDS.cartridge(cart));
  }
  if (by.ro) {
    const m = by.ro;
    const main = applySubs(m, blocksOf(m), SUBS.ro);
    mainCap(m, main, 'ro_cap', 'ro_unit', 'flow');
    if (main) put('ro', 'ro_model', brandModel(main.f).model || main.f.type);
  }

  // Modul ber-Detail yang tidak menghasilkan satu kolom pun (supaya bisa diberi tahu: "tidak terbaca").
  (modules || []).forEach((m) => {
    if (m && m.detail && String(m.detail).trim() && found[m.key] === undefined && RELEVANT.has(m.key)) found[m.key] = 0;
  });
  return { values, found };
}

// Modul yang punya kolom di Spesifikasi Peralatan (selain itu Detail-nya hanya catatan).
const RELEVANT = new Set(['feed_pump', 'raw_tank', 'clarifier', 'birm', 'mmf', 'acf', 'softener', 'uf_pump', 'uf', 'booster', 'cartridge', 'ro', ...EXTRA_MODULE_KEYS]);
export const hasSpecFields = (key) => RELEVANT.has(key);

// ---------------------------------------------------------------------------------------------
// 5. Template penulisan Detail Spesifikasi
// ---------------------------------------------------------------------------------------------
// Kerangka kosong per modul, dengan judul dan label yang dibaca specsFromTech. "Isi dari template" menyisipkan
// kerangka ini ke kolom Detail Spesifikasi; baris yang dibiarkan kosong tidak dipakai.
const T = {
  pump: (title) => `${title}\nBrand/Model : \nCapacity : \nPower : \nQty : `,
};
export const DETAIL_TEMPLATES = {
  ...EXTRA_TEMPLATES,
  feed_pump: T.pump('P-01 FEED WATER PUMP'),
  raw_tank: 'RAW WATER TANK\nCapacity : \nMaterial : \nQty : ',
  clarifier: 'CLARIFIER\nCapacity : \nTank Material : ',
  mmf: 'MULTI MEDIA FILTER\nModel : \nCapacity : \nTank Size : \nMedia : \nVolume : \nValve : \nQty : ',
  birm: 'BIRM FILTER\nModel : \nCapacity : \nTank Size : \nMedia : \nVolume : \nValve : \nQty : ',
  acf: 'ACTIVATED CARBON FILTER\nModel : \nCapacity : \nTank Size : \nMedia : \nVolume : \nValve : \nQty : ',
  softener: 'SOFTENER\nModel : \nCapacity : \nSize : \nController : \nResin : \nBrine Tank : ',
  uf_pump: T.pump('UF FEED WATER PUMP'),
  // UF hanya memuat peralatan UF sendiri. Pompa feed UF punya modul sendiri (uf_pump), jadi tidak di sini.
  uf: [
    'UF UNIT\nModel : \nCapacity : ',
    T.pump('UF BACKWASH PUMP'),
    'AIR BLOWER\nBrand/Model : \nPower : \nQty : ',
    'UF MEMBRANE\nBrand/Model : \nQty : ',
    'UF CIP TANK\nCapacity : \nMaterial : ',
    'FLOWMETER\nQty : \nSOLENOID VALVE\nQty : \nPRESSURE SWITCH\nQty : \nPRESSURE GAUGE\nQty : ',
  ].join('\n\n'),
  booster: 'RO BOOSTER PUMP\nBrand/Model : \nPower : \nQty : ',
  cartridge: 'CARTRIDGE FILTER HOUSING\nMaterial : \nModel : \nQty : \n\n5 MICRON CARTRIDGE FILTER\nSize : \nQty : ',
  // RO hanya memuat peralatan RO sendiri: unit, membran, pressure vessel, flowmeter, conductivity. Pompa yang mengumpan RO
  // (Booster Feed Pump), cartridge filter, dosing antiscalant, dan pompa/tangki cleaning-flushing punya modul sendiri di
  // Teknologi, jadi tidak diulang di sini.
  ro: [
    'RO UNIT\nModel : \nCapacity : ',
    'RO MEMBRANE\nBrand/Model : \nQty : ',
    'PRESSURE VESSEL\nBrand/Model : \nQty : ',
    'PRODUCT FLOWMETER\nModel : \nQty : ',
    'REJECT FLOWMETER\nModel : \nQty : ',
    'CONDUCTIVITY METER\nModel : \nQty : ',
  ].join('\n\n'),
};

export const detailTemplate = (key) => DETAIL_TEMPLATES[key] || '';

// Contoh isi (bukan nilai sungguhan) untuk placeholder kolom Detail Spesifikasi.
export const DETAIL_EXAMPLES = {
  ...EXTRA_EXAMPLES,
  feed_pump: 'P-01 FEED WATER PUMP\nBrand/Model : CNP / CHL 4-30\nCapacity : 5 m3/hr @ 20 m\nPower : 3 phase, 380V, 0.75 kW\nQty : 1 unit',
  raw_tank: 'RAW WATER TANK\nCapacity : 5000 Liters\nMaterial : Polyethylene\nQty : 1 unit',
  clarifier: 'F-01 CLARIFIER\nCapacity : 5 m3/hr\nTank Material : Carbon steel with epoxy painting',
  mmf: 'F-02 MULTI MEDIA FILTER\nModel : MMF-21M\nCapacity : 5 m3/hr\nTank Size : 1465\nMedia : Anthracite and silica sand\nVolume : 175 Liters\nValve : Manual multiport\nQty : 1',
  softener: 'SOFTENER\nModel : TS-30 P\nCapacity : 2.7 m3/hr\nSize : 1465\nController : Autotrol 255-740\nResin : 100 Liters\nBrine Tank : 200 Liters',
  uf: 'UF UNIT\nModel : MTN-27H-B90-04\nCapacity : 2.7 m3/hr\n\nUF BACKWASH PUMP\nBrand/Model : CNP / CHL 4-30\nCapacity : 5 m3/hr\nPower : 0.75 kW\nQty : 1',
  ro: 'RO UNIT\nModel : BT40-40K-0840\nCapacity : 40 m3/hr\n\nRO MEMBRANE\nBrand/Model : DOW / BW30-400\nQty : 24',
};
