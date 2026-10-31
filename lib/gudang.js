// Modul gudang (Supabase lewat /api/gudang): konstanta bersama halaman dan route, serta pemanggil API dari browser.

import { readCache, writeCache } from './persistedCache';

// Status pemeriksaan katalog oleh W&P / Engineering. Kosong = belum dicek.
// label = di daftar, short = di pilihan halaman detail, help = penjelasan di bawah pilihan.
export const STATUS_CEK = [
  { key: '', label: 'Belum dicek', short: 'Belum dicek', tone: 'muted', help: 'Barang ini belum dicocokkan dengan BOM dan gudang.' },
  { key: 'OK', label: 'OK', short: 'OK', tone: 'teal', help: 'Nama, ukuran, dan model sudah benar. Kode ini siap dipakai di BOM dan stok.' },
  { key: 'Ubah', label: 'Perlu diubah', short: 'Perlu diubah', tone: 'amber', help: 'Ada data yang salah atau kurang. Ubah datanya di bawah, lalu tandai OK.' },
  { key: 'Gabung', label: 'Gabung ke kode lain', short: 'Gabung', tone: 'amber', help: 'Barang yang sama tercatat dengan dua kode. Isi kode yang dipertahankan.' },
  { key: 'Hapus', label: 'Hapus', short: 'Hapus', tone: 'rust', help: 'Bukan barang (mis. judul atau baris catatan di BOM), atau tidak akan dipakai lagi.' },
];
export const STATUS_CEK_KEYS = STATUS_CEK.map((s) => s.key).filter(Boolean);
export function statusCekInfo(key) {
  return STATUS_CEK.find((s) => s.key === (key || '')) || STATUS_CEK[0];
}

// Kolom barang yang boleh diubah dari web (sama dengan allowlist di pages/api/gudang.js).
export const BARANG_EDITABLE = [
  'nama', 'kategori_kode', 'jenis', 'spesifikasi', 'ukuran', 'material', 'merek', 'model', 'satuan',
  'stok_minimum', 'foto_url', 'status_cek', 'gabung_ke', 'catatan',
];

// Kolom yang diisi saat menambah barang baru ke katalog dari web (mis. saat stock opname).
export const BARANG_BARU_FIELDS = ['nama', 'kategori_kode', 'jenis', 'spesifikasi', 'ukuran', 'material', 'merek', 'model', 'satuan', 'stok_minimum'];

// Jenis transaksi stok (buku besar transaksi_stok). Nilai kunci sama dengan check constraint di database.
export const JENIS_TRANSAKSI = {
  saldo_awal: 'Saldo awal',
  masuk: 'Masuk',
  keluar: 'Keluar',
  kembali: 'Kembali ke gudang',
  penyesuaian: 'Penyesuaian opname',
};

export const OPNAME_STATUS = {
  draf: { label: 'Sedang dihitung', tone: 'amber' },
  selesai: { label: 'Sudah diposting', tone: 'teal' },
};

export const BOM_STATUS = {
  draf: { label: 'Draf', tone: 'amber' },
  final: { label: 'Diterbitkan', tone: 'teal' },
  diganti: { label: 'Diganti revisi baru', tone: 'muted' },
};

// Usulan pembelian: kekurangan stok dari BOM final yang diajukan ke Direksi. Nilai kunci sama dengan check constraint.
export const USULAN_STATUS = {
  draf: { label: 'Draf', tone: 'amber' },
  diajukan: { label: 'Menunggu persetujuan', tone: 'blueprint' },
  disetujui: { label: 'Disetujui', tone: 'teal' },
  ditolak: { label: 'Ditolak', tone: 'rust' },
};
export const USULAN_BERJALAN = ['draf', 'diajukan', 'disetujui'];
export const nomorSerahTerima = (id) => `ST-${String(id).padStart(4, '0')}`;

// Tahap usulan yang disetujui: belum dipesan -> dipesan -> diterima sebagian -> diterima lengkap.
// r = hasil ringkasUsulan (baris_lengkap, jumlah_barang). Mengembalikan { label, tone }.
export function tahapPengadaan(u, r, today = new Date().toISOString().slice(0, 10)) {
  if (u.status !== 'disetujui') return null;
  if (r.jumlah_barang && r.baris_lengkap >= r.jumlah_barang) return { label: 'Diterima lengkap', tone: 'teal' };
  const terlambat = u.eta && u.eta < today;
  if (r.baris_lengkap > 0) return { label: `Diterima ${r.baris_lengkap} dari ${r.jumlah_barang} barang${terlambat ? ', lewat ETA' : ''}`, tone: terlambat ? 'rust' : 'amber' };
  if (u.no_po || u.tanggal_pesan) return { label: terlambat ? 'Dipesan, lewat ETA' : 'Dipesan, menunggu barang', tone: terlambat ? 'rust' : 'blueprint' };
  return { label: 'Belum dipesan', tone: 'amber' };
}
export const nomorUsulan = (id) => `UP-${String(id).padStart(4, '0')}`;

// Ringkasan baris usulan: jumlah barang, baris tanpa estimasi harga, dan estimasi total (hanya baris berharga).
export function ringkasUsulan(baris) {
  let estimasi = 0;
  let tanpaHarga = 0;
  let lengkap = 0;
  (baris || []).forEach((b) => {
    if (b.harga_satuan === null || b.harga_satuan === undefined) tanpaHarga += 1;
    else estimasi += Number(b.qty_beli) * Number(b.harga_satuan);
    if (Number(b.qty_diterima) >= Number(b.qty_beli)) lengkap += 1;
  });
  const n = (baris || []).length;
  // baris_lengkap = barang yang sudah diterima seluruhnya (penerimaan barang dari usulan yang disetujui)
  return { jumlah_barang: n, tanpa_harga: tanpaHarga, estimasi: Math.round(estimasi), baris_lengkap: lengkap };
}

export function fmtRupiah(n) {
  const v = Number(n);
  if (n === null || n === undefined || n === '' || !Number.isFinite(v)) return '';
  return `Rp ${v.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
}

// Untuk angka besar di StatStrip: "Rp 12,4 jt", "Rp 1,2 M".
export function fmtRupiahRingkas(n) {
  const v = Number(n) || 0;
  const f = (x, s) => `Rp ${x.toLocaleString('id-ID', { maximumFractionDigits: 1 })} ${s}`;
  if (v >= 1e9) return f(v / 1e9, 'M');
  if (v >= 1e6) return f(v / 1e6, 'jt');
  return fmtRupiah(v);
}

export const SATUAN_UMUM = ['pcs', 'unit', 'set', 'm', 'batang', 'roll', 'lot', 'pack', 'kg', 'liter', 'sak', 'pail', 'kaleng', 'box', 'lembar', 'pasang'];

async function call(method, params, body) {
  const qs = method === 'GET' ? `?${new URLSearchParams(params).toString()}` : '';
  const res = await fetch(`/api/gudang${qs}`, {
    method,
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    throw new Error('Server gudang memberi respons tidak valid.');
  }
  if (!json.ok) {
    const err = new Error(json.error || 'Gagal memuat data gudang.');
    err.code = json.code;
    err.status = res.status;
    throw err;
  }
  return json.data;
}

const post = (action) => (payload) => call('POST', null, { action, payload });

export const gudangApi = {
  getKatalog: () => call('GET', { action: 'katalog' }),
  getBarang: (kode) => call('GET', { action: 'barang', kode }),
  updateBarang: post('updateBarang'),
  createBarang: post('createBarang'),
  getLokasi: () => call('GET', { action: 'lokasi' }),
  createLokasi: post('createLokasi'),
  listOpname: () => call('GET', { action: 'opnameList' }),
  getOpname: (id) => call('GET', { action: 'opname', id }),
  createOpname: post('createOpname'),
  deleteOpname: post('deleteOpname'),
  saveOpnameLine: post('saveOpnameLine'),
  deleteOpnameLine: post('deleteOpnameLine'),
  postOpname: post('postOpname'),
  listBom: (project) => call('GET', project ? { action: 'bomList', project } : { action: 'bomList' }),
  getBom: (id) => call('GET', { action: 'bom', id }),
  getBomSumber: () => call('GET', { action: 'bomSumber' }),
  createBom: post('createBom'),
  revisiBom: post('revisiBom'),
  updateBom: post('updateBom'),
  deleteBom: post('deleteBom'),
  saveBomLine: post('saveBomLine'),
  deleteBomLine: post('deleteBomLine'),
  terbitkanBom: post('terbitkanBom'),
  listUsulan: () => call('GET', { action: 'usulanList' }),
  getUsulan: (id) => call('GET', { action: 'usulan', id }),
  buatUsulan: post('buatUsulan'),
  updateUsulan: post('updateUsulan'),
  deleteUsulan: post('deleteUsulan'),
  saveUsulanLine: post('saveUsulanLine'),
  deleteUsulanLine: post('deleteUsulanLine'),
  ajukanUsulan: post('ajukanUsulan'),
  putuskanUsulan: post('putuskanUsulan'),
  kembalikanUsulan: post('kembalikanUsulan'),
  catatPesanan: post('catatPesanan'),
  terimaBarang: post('terimaBarang'),
  listSerahTerima: (project) => call('GET', project ? { action: 'serahTerimaList', project } : { action: 'serahTerimaList' }),
  getSerahTerima: (id) => call('GET', { action: 'serahTerima', id }),
  getSerahTerimaSumber: (project) => call('GET', project ? { action: 'serahTerimaSumber', project } : { action: 'serahTerimaSumber' }),
  buatSerahTerima: post('buatSerahTerima'),
};

// Sesudah menyimpan satu barang: perbarui juga data katalog yang tersimpan di browser, supaya daftar langsung
// menampilkan perubahan tanpa menunggu muat ulang. Daftar tetap mengambil data segar dari server saat dibuka.
const KATALOG_CACHE = 'gudang-katalog';
export function patchKatalogCache(updated) {
  if (!updated || !updated.kode) return;
  const cached = readCache(KATALOG_CACHE, Infinity);
  if (!cached || !Array.isArray(cached.barang)) return;
  writeCache(KATALOG_CACHE, {
    ...cached,
    barang: cached.barang.map((b) => (b.kode === updated.kode ? { ...b, ...pickKatalog(updated) } : b)),
  });
}
// Barang baru yang dibuat dari web: tambahkan ke data katalog yang tersimpan di browser.
export function addToKatalogCache(created) {
  if (!created || !created.kode) return;
  const cached = readCache(KATALOG_CACHE, Infinity);
  if (!cached || !Array.isArray(cached.barang) || cached.barang.some((b) => b.kode === created.kode)) return;
  writeCache(KATALOG_CACHE, { ...cached, barang: [...cached.barang, { ...pickKatalog(created), stok: 0 }] });
}
const KATALOG_KEYS = ['kode', 'kategori_kode', 'jenis', 'nama_lain', 'nama', 'spesifikasi', 'ukuran', 'material', 'merek', 'model', 'satuan', 'dipakai_project', 'status_cek', 'perlu_dicek', 'gabung_ke', 'aktif', 'diubah_pada'];
function pickKatalog(b) {
  const out = {};
  KATALOG_KEYS.forEach((k) => { if (k in b) out[k] = b[k]; });
  return out;
}

// Penanda dari impor yang perlu dilihat orang (selain "hanya ada di penawaran", yang sudah terlihat dari kolom Dipakai).
export const FLAG_PENAWARAN = 'hanya ada di penawaran';
export function reviewFlags(b) {
  return (b.perlu_dicek || []).filter((f) => f !== FLAG_PENAWARAN);
}

// Teks pencarian satu barang (kode, nama, jenis, spesifikasi, ukuran, material, merek, model, nama lama/ejaan lain).
// Nama lama ikut dicari: tangki yang dulu bernama "CIP Tank" tetap ketemu walau kini bernama "Tangki PE".
export function barangSearchText(b) {
  return [b.kode, b.nama, b.jenis, b.spesifikasi, b.ukuran, b.material, b.merek, b.model, ...(b.nama_lain || [])]
    .filter(Boolean).join(' ').toLowerCase();
}

// Pencarian beberapa kata sekaligus di katalog (semua kata harus ada). Kode yang diketik persis diletakkan paling atas.
export function searchKatalog(barang, query, limit = 8) {
  const q = String(query || '').trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return (barang || [])
    .filter((b) => b.aktif !== false)
    .filter((b) => {
      const t = barangSearchText(b);
      return words.every((w) => t.includes(w));
    })
    .sort((a, b) => (b.kode.toLowerCase() === q) - (a.kode.toLowerCase() === q) || (b.dipakai_project || 0) - (a.dipakai_project || 0) || a.kode.localeCompare(b.kode))
    .slice(0, limit);
}

// Nama barang lengkap untuk judul/daftar: nama + ukuran + material.
export function barangLabel(b) {
  return [b?.nama, b?.ukuran, b?.material].filter(Boolean).join(' ');
}

// Waktu lokal singkat, mis. "27 Okt 14.05".
export function fmtWaktu(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function fmtQty(n) {
  if (n === null || n === undefined || n === '') return '';
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  return v.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
