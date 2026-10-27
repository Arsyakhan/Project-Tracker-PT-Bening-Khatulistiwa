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
  'nama', 'kategori_kode', 'spesifikasi', 'ukuran', 'material', 'merek', 'model', 'satuan',
  'stok_minimum', 'foto_url', 'status_cek', 'gabung_ke', 'catatan',
];

// Kolom yang diisi saat menambah barang baru ke katalog dari web (mis. saat stock opname).
export const BARANG_BARU_FIELDS = ['nama', 'kategori_kode', 'spesifikasi', 'ukuran', 'material', 'merek', 'model', 'satuan', 'stok_minimum'];

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
const KATALOG_KEYS = ['kode', 'kategori_kode', 'nama', 'spesifikasi', 'ukuran', 'material', 'merek', 'model', 'satuan', 'dipakai_project', 'status_cek', 'perlu_dicek', 'gabung_ke', 'aktif', 'diubah_pada'];
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

// Teks pencarian satu barang (kode, nama, spesifikasi, ukuran, material, merek, model).
export function barangSearchText(b) {
  return [b.kode, b.nama, b.spesifikasi, b.ukuran, b.material, b.merek, b.model].filter(Boolean).join(' ').toLowerCase();
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
