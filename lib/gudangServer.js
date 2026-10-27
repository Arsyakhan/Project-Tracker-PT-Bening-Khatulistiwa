// Logika server modul gudang (Supabase). Hanya dipanggil dari pages/api/gudang.js, jangan diimpor dari halaman.
// Semua akses database lewat lib/supabaseServer.js (kunci rahasia, melewati RLS), jadi setiap isian dari browser
// dibersihkan dan dicek di sini.

import { sbSelect, sbSelectAll, sbUpdate, sbInsert, sbDelete, sbRpc } from './supabaseServer';
import { BARANG_EDITABLE, STATUS_CEK_KEYS, BARANG_BARU_FIELDS } from './gudang';

export const KODE_RE = /^[A-Z]{3}-\d{4}$/;
const MAX_TEXT = 500;
const MAX_QTY = 10000000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Galat yang pesannya aman dan berguna untuk pengguna (salah isi, konflik, tidak ditemukan).
export function userError(message, status = 400, code) {
  return Object.assign(new Error(message), { userFacing: true, status, code });
}

function text(v, label, { required = false, max = MAX_TEXT } = {}) {
  const s = v === null || v === undefined ? '' : String(v).trim();
  if (s.length > max) throw userError(`Isian ${label} terlalu panjang (maksimal ${max} karakter).`);
  if (required && !s) throw userError(`${label} wajib diisi.`);
  return s || null;
}

function qty(v, label = 'Jumlah') {
  if (v === '' || v === null || v === undefined) throw userError(`${label} wajib diisi.`);
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw userError(`${label} harus angka 0 atau lebih.`);
  if (n > MAX_QTY) throw userError(`${label} terlalu besar.`);
  return Math.round(n * 1000) / 1000;
}

function positiveId(v, label) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw userError(`${label} tidak valid.`);
  return n;
}

function kodeBarang(v) {
  const k = String(v || '').trim().toUpperCase();
  if (!KODE_RE.test(k)) throw userError('Kode barang tidak valid.');
  return k;
}

// ---------------------------------------------------------------------------------------------------------------
// Katalog

const KATALOG_FIELDS = 'kode,kategori_kode,nama,spesifikasi,ukuran,material,merek,model,satuan,dipakai_project,status_cek,perlu_dicek,gabung_ke,aktif,diubah_pada';

export async function getKatalog() {
  const [kategori, barang, stok] = await Promise.all([
    sbSelect('kategori_barang', { select: 'kode,nama,urutan', order: 'urutan' }),
    sbSelectAll('barang', { select: KATALOG_FIELDS, order: 'kode' }),
    sbSelectAll('stok_barang', { select: 'kode,stok', stok: 'neq.0', order: 'kode' }),
  ]);
  const stokOf = new Map(stok.map((s) => [s.kode, Number(s.stok) || 0]));
  return { kategori, barang: barang.map((b) => ({ ...b, stok: stokOf.get(b.kode) || 0 })) };
}

export async function getBarang(kode) {
  const [rows, stok, kategori, perLokasi, lokasi, transaksi] = await Promise.all([
    sbSelect('barang', { select: '*', kode: `eq.${kode}` }),
    sbSelect('stok_barang', { select: 'stok,transaksi_terakhir', kode: `eq.${kode}` }),
    sbSelect('kategori_barang', { select: 'kode,nama,urutan', order: 'urutan' }),
    sbSelect('stok_per_lokasi', { select: 'lokasi_kode,stok', barang_kode: `eq.${kode}` }),
    sbSelect('lokasi_gudang', { select: 'kode,nama', order: 'nama' }),
    sbSelect(
      'transaksi_stok',
      { select: 'id,lokasi_kode,jenis,qty,referensi,catatan,tanggal,dicatat_oleh,opname_id', barang_kode: `eq.${kode}`, order: 'tanggal.desc,id.desc' },
      { limit: 50 }
    ),
  ]);
  const barang = rows && rows[0];
  if (!barang) return null;
  const [baris, digabung] = await Promise.all([
    sbSelectAll('baris_bom_arsip', {
      select: 'id,file_id,project_label,revisi,lembar,baris_excel,bagian,nama,lokasi_pasang,spesifikasi,ukuran,material,model,qty,satuan,keterangan',
      barang_kode: `eq.${kode}`,
      order: 'id',
    }),
    sbSelect('barang', { select: 'kode,nama,ukuran,material,model', gabung_ke: `eq.${kode}`, order: 'kode' }),
  ]);
  const fileIds = Array.from(new Set(baris.map((b) => b.file_id)));
  const files = fileIds.length
    ? await sbSelect('file_bom', {
        select: 'id,jenis_sumber,project_label,nama_file,revisi,tanggal_ubah,revisi_terakhir,lokasi',
        id: `in.(${fileIds.map((id) => `"${id}"`).join(',')})`,
      })
    : [];
  const s = stok && stok[0];
  return {
    barang,
    stok: {
      stok: s ? Number(s.stok) || 0 : 0,
      transaksi_terakhir: s ? s.transaksi_terakhir : null,
      perLokasi: (perLokasi || []).filter((p) => Number(p.stok) !== 0).map((p) => ({ lokasi_kode: p.lokasi_kode, stok: Number(p.stok) })),
    },
    lokasi: lokasi || [],
    transaksi: transaksi || [],
    kategori,
    baris,
    files,
    digabung: digabung || [],
  };
}

// Bersihkan perubahan dari browser: hanya kolom yang diizinkan, teks dipangkas, aturan Gabung dicek.
async function cleanChanges(kode, changes, statusLama) {
  const out = {};
  for (const key of BARANG_EDITABLE) {
    if (!(key in changes)) continue;
    let v = changes[key];
    if (key === 'stok_minimum') {
      out[key] = v === '' || v === null || v === undefined ? null : qty(v, 'Stok minimum');
      continue;
    }
    v = v === null || v === undefined ? '' : String(v).trim();
    if (v.length > MAX_TEXT) throw userError(`Isian ${key} terlalu panjang (maksimal ${MAX_TEXT} karakter).`);
    out[key] = v === '' ? null : v;
  }
  if ('nama' in out && !out.nama) throw userError('Nama barang wajib diisi.');
  if ('satuan' in out && !out.satuan) throw userError('Satuan wajib diisi.');
  if ('status_cek' in out && out.status_cek !== null && !STATUS_CEK_KEYS.includes(out.status_cek)) {
    throw userError('Status cek tidak dikenal.');
  }
  if ('foto_url' in out && out.foto_url && !/^https:\/\//i.test(out.foto_url)) {
    throw userError('Tautan foto harus diawali https:// (tautan Google Drive).');
  }
  if ('status_cek' in out || 'gabung_ke' in out) {
    const status = 'status_cek' in out ? out.status_cek : statusLama;
    if (status === 'Gabung') {
      const target = String(out.gabung_ke || '').toUpperCase();
      if (!KODE_RE.test(target)) throw userError('Isi kode barang tujuan penggabungan, mis. FTG-0079.');
      if (target === kode) throw userError('Barang tidak bisa digabung ke dirinya sendiri.');
      const found = await sbSelect('barang', { select: 'kode,gabung_ke', kode: `eq.${target}` });
      if (!found || !found[0]) throw userError(`Kode ${target} tidak ada di katalog.`);
      if (found[0].gabung_ke) throw userError(`Kode ${target} sendiri sudah ditandai gabung ke ${found[0].gabung_ke}. Pilih kode tujuan akhirnya.`);
      out.gabung_ke = target;
    } else {
      out.gabung_ke = null;
    }
  }
  return out;
}

export async function updateBarang(payload, email) {
  const kode = kodeBarang(payload?.kode);
  const base = String(payload?.baseDiubahPada || '');
  if (!base) throw userError('Data dasar tidak lengkap. Muat ulang halaman.');
  const changes = await cleanChanges(kode, payload.changes || {}, payload.statusLama);
  if (Object.keys(changes).length === 0) throw userError('Tidak ada perubahan.');

  const updated = await sbUpdate('barang', { kode: `eq.${kode}`, diubah_pada: `eq.${base}` }, { ...changes, diubah_oleh: email });
  if (!updated || updated.length === 0) {
    const exists = await sbSelect('barang', { select: 'kode,diubah_oleh,diubah_pada', kode: `eq.${kode}` });
    if (!exists || !exists[0]) throw userError('Barang tidak ditemukan.', 404);
    const by = exists[0].diubah_oleh ? ` oleh ${exists[0].diubah_oleh}` : '';
    throw userError(`Barang ini baru saja diubah${by}. Muat ulang halaman, lalu ulangi perubahan Anda.`, 409, 'conflict');
  }
  return updated[0];
}

const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Tambah barang baru ke katalog (mis. barang yang ditemukan saat stock opname tetapi belum pernah ada di BOM lama).
// Kode = awalan kategori + nomor berikutnya. Barang dengan nama, ukuran, dan material yang sama ditolak.
export async function createBarang(payload, email) {
  const p = payload || {};
  const row = {};
  BARANG_BARU_FIELDS.forEach((k) => {
    if (k === 'stok_minimum') row[k] = p[k] === '' || p[k] === null || p[k] === undefined ? null : qty(p[k], 'Stok minimum');
    else row[k] = text(p[k], k);
  });
  row.nama = text(p.nama, 'Nama barang', { required: true });
  row.satuan = text(p.satuan, 'Satuan', { required: true });
  const kat = String(p.kategori_kode || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(kat)) throw userError('Pilih kategori barang.');
  row.kategori_kode = kat;

  if (!/[*%,()]/.test(row.nama)) {
    const same = await sbSelect('barang', { select: 'kode,nama,ukuran,material', nama: `ilike.${row.nama}` });
    const dup = (same || []).find((b) => norm(b.ukuran) === norm(row.ukuran) && norm(b.material) === norm(row.material));
    if (dup) throw userError(`Barang ini sudah ada di katalog dengan kode ${dup.kode}.`, 409, 'duplicate');
  }

  const sumber = { ditambah_dari: p.konteks === 'opname' ? 'stock opname' : 'web', oleh: email };
  for (let attempt = 0; attempt < 4; attempt++) {
    const last = await sbSelect('barang', { select: 'kode', kode: `like.${kat}-*`, order: 'kode.desc' }, { limit: 1 });
    const next = last && last[0] ? Number(last[0].kode.slice(4)) + 1 : 1;
    if (next > 9999) throw userError(`Nomor kode kategori ${kat} sudah habis.`);
    const kode = `${kat}-${String(next).padStart(4, '0')}`;
    try {
      const created = await sbInsert('barang', [{
        ...row,
        kode,
        status_cek: null,
        perlu_dicek: [],
        nama_lain: [],
        daftar_project: [],
        dipakai_project: 0,
        sumber,
        aktif: true,
        diubah_oleh: email,
      }]);
      return created[0];
    } catch (err) {
      if (err.code === '23505' && attempt < 3) continue; // kode baru saja dipakai orang lain: coba nomor berikutnya
      throw err;
    }
  }
  throw userError('Gagal membuat kode barang baru. Coba lagi.');
}

// ---------------------------------------------------------------------------------------------------------------
// Lokasi gudang

export async function getLokasi() {
  return sbSelect('lokasi_gudang', { select: 'kode,nama,keterangan', aktif: 'eq.true', order: 'nama' });
}

export async function createLokasi(payload) {
  const nama = text(payload?.nama, 'Nama lokasi', { required: true, max: 80 });
  const keterangan = text(payload?.keterangan, 'Keterangan', { max: 200 });
  const base = nama.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 16) || 'LOKASI';
  const existing = await sbSelect('lokasi_gudang', { select: 'kode,nama', kode: `like.${base}*` });
  if ((existing || []).some((l) => norm(l.nama) === norm(nama))) throw userError(`Lokasi "${nama}" sudah ada.`, 409);
  const used = new Set((existing || []).map((l) => l.kode));
  let kode = base;
  for (let i = 2; used.has(kode); i++) kode = `${base}-${i}`;
  const created = await sbInsert('lokasi_gudang', [{ kode, nama, keterangan, aktif: true }]);
  return created[0];
}

// ---------------------------------------------------------------------------------------------------------------
// Stock opname

const OPNAME_FIELDS = 'id,judul,lokasi_kode,tanggal,status,catatan,dibuat_oleh,dibuat_pada,diposting_oleh,diposting_pada';
const BARIS_FIELDS = 'id,barang_kode,qty_hitung,catatan,dihitung_oleh,dihitung_pada,barang(kode,nama,ukuran,material,merek,model,satuan,kategori_kode)';

export async function listOpname() {
  const [rows, lokasi] = await Promise.all([
    sbSelect('stock_opname', { select: `${OPNAME_FIELDS},stock_opname_baris(count)`, order: 'id.desc' }, { limit: 200 }),
    getLokasi(),
  ]);
  return {
    opname: (rows || []).map(({ stock_opname_baris: c, ...o }) => ({ ...o, jumlah_barang: (c && c[0] && c[0].count) || 0 })),
    lokasi,
  };
}

export async function getOpname(idRaw) {
  const id = positiveId(idRaw, 'Nomor opname');
  const rows = await sbSelect('stock_opname', { select: OPNAME_FIELDS, id: `eq.${id}` });
  const opname = rows && rows[0];
  if (!opname) return null;
  const [baris, lokasi] = await Promise.all([
    sbSelectAll('stock_opname_baris', { select: BARIS_FIELDS, opname_id: `eq.${id}`, order: 'dihitung_pada.desc,id.desc' }),
    sbSelect('lokasi_gudang', { select: 'kode,nama', kode: `eq.${opname.lokasi_kode}` }),
  ]);
  // Draf: stok sistem saat ini di lokasi sesi (untuk pratinjau selisih). Selesai: transaksi yang dibuat saat posting.
  const stokLokasi = opname.status === 'draf'
    ? await sbSelectAll('stok_per_lokasi', { select: 'barang_kode,stok,jumlah_transaksi', lokasi_kode: `eq.${opname.lokasi_kode}`, order: 'barang_kode' })
    : [];
  const hasil = opname.status === 'selesai'
    ? await sbSelectAll('transaksi_stok', { select: 'barang_kode,jenis,qty', opname_id: `eq.${id}`, order: 'id' })
    : [];
  return { opname, lokasi: (lokasi && lokasi[0]) || { kode: opname.lokasi_kode, nama: opname.lokasi_kode }, baris, stokLokasi, hasil };
}

export async function createOpname(payload, email) {
  const judul = text(payload?.judul, 'Judul', { required: true, max: 120 });
  const lokasi_kode = String(payload?.lokasi_kode || '').trim();
  if (!lokasi_kode) throw userError('Pilih lokasi gudang.');
  const tanggal = String(payload?.tanggal || '').trim();
  if (!DATE_RE.test(tanggal) || Number.isNaN(Date.parse(tanggal))) throw userError('Tanggal opname tidak valid.');
  const catatan = text(payload?.catatan, 'Catatan');
  const created = await sbInsert('stock_opname', [{ judul, lokasi_kode, tanggal, catatan, dibuat_oleh: email }], { select: OPNAME_FIELDS });
  return created[0];
}

export async function deleteOpname(payload) {
  const id = positiveId(payload?.id, 'Nomor opname');
  const deleted = await sbDelete('stock_opname', { id: `eq.${id}`, status: 'eq.draf' });
  if (deleted && deleted.length) return { id };
  const exists = await sbSelect('stock_opname', { select: 'id,status', id: `eq.${id}` });
  if (!exists || !exists[0]) throw userError('Sesi opname tidak ditemukan.', 404);
  throw userError('Sesi opname yang sudah diposting tidak bisa dihapus.', 409);
}

export async function saveOpnameLine(payload, email) {
  const opname_id = positiveId(payload?.opname_id, 'Nomor opname');
  const barang_kode = kodeBarang(payload?.barang_kode);
  const qty_hitung = qty(payload?.qty_hitung, 'Jumlah hitungan');
  const catatan = text(payload?.catatan, 'Catatan', { max: 300 });
  const found = await sbSelect('barang', { select: 'kode,status_cek,gabung_ke', kode: `eq.${barang_kode}` });
  if (!found || !found[0]) throw userError(`Barang ${barang_kode} tidak ada di katalog.`, 404);
  if (found[0].status_cek === 'Gabung' && found[0].gabung_ke) {
    throw userError(`${barang_kode} sudah digabung ke ${found[0].gabung_ke}. Hitung barang ini di kode ${found[0].gabung_ke}.`);
  }
  const saved = await sbInsert(
    'stock_opname_baris',
    [{ opname_id, barang_kode, qty_hitung, catatan, dihitung_oleh: email, dihitung_pada: new Date().toISOString() }],
    { upsertOn: 'opname_id,barang_kode', select: BARIS_FIELDS }
  );
  return saved[0];
}

export async function deleteOpnameLine(payload) {
  const opname_id = positiveId(payload?.opname_id, 'Nomor opname');
  const barang_kode = kodeBarang(payload?.barang_kode);
  await sbDelete('stock_opname_baris', { opname_id: `eq.${opname_id}`, barang_kode: `eq.${barang_kode}` });
  return { opname_id, barang_kode };
}

export async function postOpname(payload, email) {
  const id = positiveId(payload?.id, 'Nomor opname');
  const ringkasan = await sbRpc('posting_opname', { p_id: id, p_email: email });
  return { id, ringkasan };
}
