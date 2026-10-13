// Isi "Detail Spesifikasi" Teknologi yang tidak punya kolom di Spesifikasi Peralatan.
//
// Pembaca di lib/specParser.js hanya memakai label baku (Brand, Model, Capacity, Power, Qty, ...) dan hanya yang cocok
// dengan kolom seksi. Tulisan lain di Detail (ukuran, bahan tambahan, tekanan, pompa kedua, catatan bebas) tidak punya
// kolom, sehingga dulu tidak ikut tercetak di dokumen Hand Over. Di sini baris-baris itu dicari dan dijadikan baris
// tambahan di butir modulnya, supaya semua yang tercatat di Teknologi ikut keluar di dokumen.
//
// Dua pemeriksaan, keduanya aturan tetap yang bisa diuji (bukan tebakan):
//  1. DIPAKAI PEMBACA? Satu baris Detail dibuang dari teks, lalu nilai otomatis modul itu dihitung ulang. Kalau ada
//     nilai yang berubah, baris itu sudah dipakai pembaca (sudah punya kolom): tidak dicetak lagi sebagai tambahan.
//  2. SUDAH TERCETAK? Baris yang tidak dipakai pembaca tetap dilewati kalau semua kata/angkanya sudah ada di teks butir
//     dokumen (dibandingkan sebagai himpunan kata, tanpa peduli huruf besar/kecil dan tanda baca), mis. "Capacity : 5 m3/hr"
//     yang sudah tercetak dari kolom Kapasitas di grid.
// Detail yang memuat beberapa peralatan (blok ber-judul) dan satu blok seluruhnya tidak dipakai pembaca (mis. pompa
// kedua) dicetak utuh, lengkap dengan judulnya.
//
// Fungsi murni (tanpa React, tanpa jaringan).
import { parseDetail, specsFromTech } from '../specParser';

// Kata/angka sebuah teks, dinormalkan supaya penulisan yang beda tapi artinya sama dianggap sama: "5m3/h" = "5 m3/hr",
// "units" = "unit", "3phase" = "3 phase".
const HOUR = new Set(['h', 'hr', 'hrs', 'hour', 'hours', 'jam']);
const tokensOf = (s) => String(s ?? '')
  .toLowerCase()
  .replace(/m³/g, 'm3')
  .replace(/(\d)([a-z])/g, '$1 $2')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .split(' ')
  .filter(Boolean)
  .map((t) => (HOUR.has(t) ? 'hr' : t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));

// Himpunan kata/angka dari teks yang sudah tercetak.
export const tokenSet = (text) => new Set(tokensOf(text));

const isCarried = (value, set) => {
  const t = tokensOf(value);
  return t.length === 0 || t.every((x) => set.has(x));
};

// Teks Detail disusun ulang dari blok hasil baca (judul, lalu "Label : isi"), boleh tanpa satu baris.
const rebuild = (blocks, skip) => blocks
  .map((b, bi) => [b.title, ...b.rows.map((r, ri) => (skip && skip[0] === bi && skip[1] === ri ? '' : `${r.label} : ${r.value}`))]
    .filter(Boolean).join('\n'))
  .join('\n');

// Baris Detail (indeks blok:indeks baris) yang dipakai pembaca.
function usedRows(mod, blocks) {
  const sig = (detail) => JSON.stringify(specsFromTech([{ ...mod, detail }]).values);
  const base = sig(rebuild(blocks));
  const used = new Set();
  blocks.forEach((b, bi) => b.rows.forEach((r, ri) => {
    if (String(r.value).trim() && sig(rebuild(blocks, [bi, ri])) !== base) used.add(`${bi}:${ri}`);
  }));
  return used;
}

// Baris tambahan dari Detail sebuah modul Teknologi ({ key, cap, unit, detail }). `carried` = teks (atau himpunan kata)
// dari semua butir yang sudah tercetak.
// Satu baris per isian ("Tank Material: Composite with FRP lining"; judul peralatannya sudah ada di butir), satu baris
// per peralatan kedua yang seluruhnya tidak dipakai pembaca ("P-101.2A/B WATER INTAKE TRANSFER PUMP, Type: 100 m3/hr,
// Qty: 2 sets"), dan satu baris per teks bebas tanpa titik dua ("2 unit RO 20 MPH + RO 10 MPH").
export function detailLeftovers(mod, carried) {
  const set = carried instanceof Set ? carried : tokenSet(carried);
  const blocks = parseDetail(mod?.detail);
  if (blocks.length === 0) return [];
  const used = usedRows(mod, blocks);
  const multi = blocks.length > 1;
  const out = [];
  blocks.forEach((b, bi) => {
    if (b.rows.length === 0) {
      // Judul tanpa isian = teks bebas.
      if (b.title && !isCarried(b.title, set)) out.push(b.title);
      return;
    }
    const filled = b.rows.map((r, ri) => ({ ...r, ri })).filter((r) => String(r.value).trim());
    const wholeUnused = multi && filled.length > 0 && filled.every((r) => !used.has(`${bi}:${r.ri}`));
    const pairs = filled
      .filter((r) => !used.has(`${bi}:${r.ri}`) && (wholeUnused || !isCarried(r.value, set)))
      .map((r) => `${r.label}: ${r.value}`);
    if (pairs.length === 0) return;
    if (wholeUnused) out.push([b.title, ...pairs].filter(Boolean).join(', '));
    else out.push(...pairs);
  });
  return out;
}
