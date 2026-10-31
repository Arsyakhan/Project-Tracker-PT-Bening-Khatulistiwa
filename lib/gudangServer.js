// Logika server modul gudang (Supabase). Hanya dipanggil dari pages/api/gudang.js, jangan diimpor dari halaman.
// Semua akses database lewat lib/supabaseServer.js (kunci rahasia, melewati RLS), jadi setiap isian dari browser
// dibersihkan dan dicek di sini.

import { sbSelect, sbSelectAll, sbUpdate, sbInsert, sbDelete, sbRpc } from './supabaseServer';
import { BARANG_EDITABLE, STATUS_CEK_KEYS, BARANG_BARU_FIELDS, ringkasUsulan } from './gudang';

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

const KATALOG_FIELDS = 'kode,kategori_kode,jenis,nama_lain,nama,spesifikasi,ukuran,material,merek,model,satuan,dipakai_project,status_cek,perlu_dicek,gabung_ke,aktif,diubah_pada';

// Daftar jenis per kategori (bentuk fisik barang, mis. Tangki PE / Tangki FRP), urut seperti di tabel jenis_barang.
function getJenis() {
  return sbSelect('jenis_barang', { select: 'kategori_kode,nama,urutan', order: 'kategori_kode,urutan' });
}

export async function getKatalog() {
  const [kategori, jenis, barang, stok] = await Promise.all([
    sbSelect('kategori_barang', { select: 'kode,nama,urutan', order: 'urutan' }),
    getJenis(),
    sbSelectAll('barang', { select: KATALOG_FIELDS, order: 'kode' }),
    sbSelectAll('stok_barang', { select: 'kode,stok', stok: 'neq.0', order: 'kode' }),
  ]);
  const stokOf = new Map(stok.map((s) => [s.kode, Number(s.stok) || 0]));
  return { kategori, jenis, barang: barang.map((b) => ({ ...b, stok: stokOf.get(b.kode) || 0 })) };
}

export async function getBarang(kode) {
  const [rows, stok, kategori, jenis, perLokasi, lokasi, transaksi] = await Promise.all([
    sbSelect('barang', { select: '*', kode: `eq.${kode}` }),
    sbSelect('stok_barang', { select: 'stok,transaksi_terakhir', kode: `eq.${kode}` }),
    sbSelect('kategori_barang', { select: 'kode,nama,urutan', order: 'urutan' }),
    getJenis(),
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
    jenis,
    baris,
    files,
    digabung: digabung || [],
  };
}

// Jenis harus salah satu dari daftar jenis kategori itu (tabel jenis_barang; database juga menjaganya lewat kunci asing).
async function cekJenis(kategori, jenis) {
  const ada = await sbSelect('jenis_barang', { select: 'nama', kategori_kode: `eq.${kategori}`, nama: `eq.${jenis}` });
  if (!ada || !ada[0]) throw userError(`Jenis "${jenis}" tidak ada di kategori ini. Pilih dari daftar.`);
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
  if ('kategori_kode' in out || 'jenis' in out) {
    // Jenis lama milik kategori lama: ganti kategori tanpa memilih jenis = jenis dikosongkan.
    if ('kategori_kode' in out && !('jenis' in out)) out.jenis = null;
    if (out.jenis) {
      let kat = out.kategori_kode;
      if (!kat) {
        const cur = await sbSelect('barang', { select: 'kategori_kode', kode: `eq.${kode}` });
        kat = cur && cur[0] && cur[0].kategori_kode;
      }
      await cekJenis(kat, out.jenis);
    }
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
  if (!row.jenis) throw userError('Pilih jenis barang.');
  await cekJenis(kat, row.jenis);

  if (!/[*%,()]/.test(row.nama)) {
    const same = await sbSelect('barang', { select: 'kode,nama,ukuran,material', nama: `ilike.${row.nama}` });
    const dup = (same || []).find((b) => norm(b.ukuran) === norm(row.ukuran) && norm(b.material) === norm(row.material));
    if (dup) throw userError(`Barang ini sudah ada di katalog dengan kode ${dup.kode}.`, 409, 'duplicate');
  }

  const sumber = { ditambah_dari: { opname: 'stock opname', bom: 'BOM project' }[p.konteks] || 'web', oleh: email };
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

// ---------------------------------------------------------------------------------------------------------------
// BOM project

const PROJECT_ID_RE = /^prj_[A-Za-z0-9_-]{3,40}$/;
const BOM_FIELDS = 'id,project_id,project_nama,judul,revisi,revisi_dari,status,sumber,catatan,dibuat_oleh,dibuat_pada,diubah_oleh,diubah_pada,diterbitkan_oleh,diterbitkan_pada';
const BOM_BARIS_FIELDS = 'id,urutan,bagian,barang_kode,qty,satuan,catatan,diubah_oleh,diubah_pada,barang(kode,nama,ukuran,material,merek,model,satuan,kategori_kode,status_cek,gabung_ke)';

function projectId(v) {
  const s = String(v || '').trim();
  if (!PROJECT_ID_RE.test(s)) throw userError('Project tidak valid. Pilih project dari daftar.');
  return s;
}

// Jumlah di BOM: kosong boleh selama draf (belum diisi), selain itu harus lebih dari 0.
function qtyBom(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) throw userError('Jumlah harus angka lebih dari 0, atau dikosongkan dulu.');
  if (n > MAX_QTY) throw userError('Jumlah terlalu besar.');
  return Math.round(n * 1000) / 1000;
}

export async function listBom(query) {
  const q = { select: `${BOM_FIELDS},bom_baris(count)`, order: 'diubah_pada.desc' };
  if (query && query.project) q.project_id = `eq.${projectId(query.project)}`;
  const rows = await sbSelect('bom', q, { limit: 500 });
  return (rows || []).map(({ bom_baris: c, ...b }) => ({ ...b, jumlah_baris: (c && c[0] && c[0].count) || 0 }));
}

export async function getBom(idRaw) {
  const id = positiveId(idRaw, 'Nomor BOM');
  const rows = await sbSelect('bom', { select: BOM_FIELDS, id: `eq.${id}` });
  const bom = rows && rows[0];
  if (!bom) return null;
  const [baris, stok, terkait, penyisihan, usulan] = await Promise.all([
    sbSelectAll('bom_baris', { select: BOM_BARIS_FIELDS, bom_id: `eq.${id}`, order: 'urutan,id' }),
    // Stok fisik semua lokasi dan jumlah yang sudah disisihkan BOM final (termasuk BOM ini kalau final)
    sbSelectAll('stok_tersedia', { select: 'kode,stok,disisihkan', or: '(stok.neq.0,disisihkan.neq.0)', order: 'kode' }),
    // Revisi sebelumnya dan revisi sesudahnya (kalau ada)
    sbSelect('bom', { select: 'id,revisi,status,judul', or: `(id.eq.${bom.revisi_dari || 0},revisi_dari.eq.${id})`, order: 'revisi' }),
    sbSelectAll('penyisihan_stok', { select: 'barang_kode,qty,dibuat_oleh,dibuat_pada', bom_id: `eq.${id}`, order: 'barang_kode' }),
    sbSelect('usulan_pembelian', { select: 'id,status,diubah_pada', bom_id: `eq.${id}`, order: 'id.desc' }),
  ]);
  const kodeSet = new Set(baris.map((b) => b.barang_kode));
  return {
    bom,
    baris,
    stok: stok.filter((s) => kodeSet.has(s.kode)).map((s) => ({ kode: s.kode, stok: Number(s.stok), disisihkan: Number(s.disisihkan) })),
    penyisihan: penyisihan.map((p) => ({ ...p, qty: Number(p.qty) })),
    usulan: usulan || [],
    terkait: (terkait || []).filter((t) => t.id !== id),
  };
}

// File BOM lama (hasil impor Dropbox) yang bisa disalin menjadi BOM baru, beserta lembar-lembarnya.
export async function getBomSumber() {
  const [files, lembar] = await Promise.all([
    sbSelect('file_bom', {
      select: 'id,jenis_sumber,project_label,nama_file,revisi,tanggal_ubah,revisi_terakhir,jumlah_baris',
      order: 'tanggal_ubah.desc.nullslast,id',
    }, { limit: 1000 }),
    sbSelectAll('file_bom_lembar', { select: 'file_id,lembar,jumlah_baris', order: 'file_id,lembar' }),
  ]);
  const byFile = {};
  lembar.forEach((l) => { (byFile[l.file_id] = byFile[l.file_id] || []).push({ lembar: l.lembar, jumlah_baris: Number(l.jumlah_baris) }); });
  return { files: (files || []).map((f) => ({ ...f, lembar: byFile[f.id] || [] })) };
}

export async function createBom(payload, email) {
  const p = payload || {};
  const jenis = String(p.jenis || 'kosong');
  if (!['kosong', 'arsip', 'bom'].includes(jenis)) throw userError('Pilih isi awal BOM.');
  const args = {
    p_project_id: projectId(p.project_id),
    p_project_nama: text(p.project_nama, 'Nama project', { required: true, max: 200 }),
    p_judul: text(p.judul, 'Judul BOM', { required: true, max: 150 }),
    p_email: email,
    p_jenis: jenis,
    p_file_id: null,
    p_lembar: null,
    p_bom_id: null,
  };
  if (jenis === 'arsip') {
    const f = String(p.file_id || '').trim();
    if (!/^F\d{3,5}$/.test(f)) throw userError('Pilih file BOM lama yang akan disalin.');
    args.p_file_id = f;
    if (Array.isArray(p.lembar)) {
      const l = p.lembar.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 30);
      if (!l.length) throw userError('Pilih minimal satu lembar yang disalin.');
      if (l.some((x) => x.length > 100)) throw userError('Nama lembar tidak valid.');
      args.p_lembar = l;
    }
  }
  if (jenis === 'bom') args.p_bom_id = positiveId(p.bom_id, 'BOM yang disalin');
  const id = await sbRpc('buat_bom', args);
  return { id: Number(id) };
}

export async function revisiBom(payload, email) {
  const id = positiveId(payload?.id, 'Nomor BOM');
  const newId = await sbRpc('buat_bom', {
    p_project_id: null, p_project_nama: null, p_judul: null, p_email: email, p_jenis: 'revisi', p_file_id: null, p_lembar: null, p_bom_id: id,
  });
  return { id: Number(newId) };
}

export async function updateBom(payload, email) {
  const id = positiveId(payload?.id, 'Nomor BOM');
  const changes = { diubah_oleh: email };
  if ('judul' in (payload || {})) changes.judul = text(payload.judul, 'Judul BOM', { required: true, max: 150 });
  if ('catatan' in (payload || {})) changes.catatan = text(payload.catatan, 'Catatan', { max: 1000 });
  const updated = await sbUpdate('bom', { id: `eq.${id}`, status: 'eq.draf', select: BOM_FIELDS }, changes);
  if (updated && updated.length) return updated[0];
  const exists = await sbSelect('bom', { select: 'id', id: `eq.${id}` });
  if (!exists || !exists[0]) throw userError('BOM tidak ditemukan.', 404);
  throw userError('BOM yang sudah diterbitkan tidak bisa diubah. Buat revisi untuk mengubahnya.', 409);
}

export async function deleteBom(payload) {
  const id = positiveId(payload?.id, 'Nomor BOM');
  const deleted = await sbDelete('bom', { id: `eq.${id}`, status: 'eq.draf' });
  if (deleted && deleted.length) return { id };
  const exists = await sbSelect('bom', { select: 'id', id: `eq.${id}` });
  if (!exists || !exists[0]) throw userError('BOM tidak ditemukan.', 404);
  throw userError('BOM yang sudah diterbitkan tidak bisa dihapus.', 409);
}

export async function saveBomLine(payload, email) {
  const p = payload || {};
  const bom_id = positiveId(p.bom_id, 'Nomor BOM');
  const barang_kode = kodeBarang(p.barang_kode);
  const found = await sbSelect('barang', { select: 'kode,satuan,status_cek,gabung_ke', kode: `eq.${barang_kode}` });
  if (!found || !found[0]) throw userError(`Barang ${barang_kode} tidak ada di katalog.`, 404);
  if (found[0].status_cek === 'Gabung' && found[0].gabung_ke) {
    throw userError(`${barang_kode} sudah digabung ke ${found[0].gabung_ke}. Pakai kode ${found[0].gabung_ke}.`);
  }
  const row = {
    barang_kode,
    qty: qtyBom(p.qty),
    satuan: text(p.satuan, 'Satuan', { max: 30 }) || found[0].satuan,
    bagian: text(p.bagian, 'Bagian', { max: 120 }),
    catatan: text(p.catatan, 'Catatan', { max: 300 }),
    diubah_oleh: email,
  };
  if (p.id) {
    const id = positiveId(p.id, 'Baris BOM');
    const updated = await sbUpdate('bom_baris', { id: `eq.${id}`, bom_id: `eq.${bom_id}`, select: BOM_BARIS_FIELDS }, row);
    if (!updated || !updated.length) throw userError('Baris BOM tidak ditemukan. Muat ulang halaman.', 404);
    return updated[0];
  }
  const last = await sbSelect('bom_baris', { select: 'urutan', bom_id: `eq.${bom_id}`, order: 'urutan.desc' }, { limit: 1 });
  const urutan = (last && last[0] ? Number(last[0].urutan) || 0 : 0) + 10;
  const created = await sbInsert('bom_baris', [{ ...row, bom_id, urutan }], { select: BOM_BARIS_FIELDS });
  return created[0];
}

export async function deleteBomLine(payload, email) {
  const bom_id = positiveId(payload?.bom_id, 'Nomor BOM');
  const id = positiveId(payload?.id, 'Baris BOM');
  await sbDelete('bom_baris', { id: `eq.${id}`, bom_id: `eq.${bom_id}` });
  await sbUpdate('bom', { id: `eq.${bom_id}`, status: 'eq.draf' }, { diubah_oleh: email });
  return { id, bom_id };
}

export async function terbitkanBom(payload, email) {
  const id = positiveId(payload?.id, 'Nomor BOM');
  return sbRpc('terbitkan_bom', { p_id: id, p_email: email });
}

// ---------------------------------------------------------------------------------------------------------------
// Penyisihan stok dan usulan pembelian (persetujuan Direksi)

const USULAN_FIELDS = 'id,bom_id,project_id,project_nama,status,catatan,vendor,tautan_penawaran,dikembalikan_oleh,dikembalikan_pada,catatan_dikembalikan,dibuat_oleh,dibuat_pada,diubah_oleh,diubah_pada,diajukan_oleh,diajukan_pada,diputuskan_oleh,diputuskan_pada,catatan_keputusan';
const USULAN_BARIS_FIELDS = 'id,barang_kode,qty_butuh,qty_disisihkan,qty_disetujui_sebelumnya,qty_beli,satuan,harga_satuan,catatan,diubah_oleh,diubah_pada,barang(kode,nama,ukuran,material,merek,model,satuan,kategori_kode)';
const DIVISI_DIREKSI = ['Direksi', 'Marketing & Direksi'];
const MAX_HARGA = 100000000000;

// Yang boleh menyetujui/menolak: pengguna aktif berdivisi Direksi di tabel `pengguna`. Selama belum ada satu pun yang
// terdaftar, Admin (PM) yang memutuskan (aturan aman yang sama dengan ADMIN_EMAILS di lib/roles.js).
export async function bisaMemutuskan(email, role) {
  const direksi = await sbSelect('pengguna', {
    select: 'email',
    aktif: 'eq.true',
    divisi: `in.(${DIVISI_DIREKSI.map((d) => `"${d}"`).join(',')})`,
  });
  if (!direksi || direksi.length === 0) return role === 'admin';
  const e = String(email || '').trim().toLowerCase();
  return direksi.some((d) => String(d.email || '').trim().toLowerCase() === e);
}

function qtyBeli(v) {
  const n = Number(String(v ?? '').replace(',', '.'));
  if (v === '' || v === null || v === undefined || !Number.isFinite(n) || n <= 0) throw userError('Jumlah beli harus angka lebih dari 0. Hapus barisnya jika barang ini tidak perlu dibeli.');
  if (n > MAX_QTY) throw userError('Jumlah beli terlalu besar.');
  return Math.round(n * 1000) / 1000;
}

// Estimasi harga satuan dalam Rupiah. Titik ribuan boleh ("1.500.000"); koma = desimal. Kosong = belum ada harga.
function harga(v) {
  const s = v === null || v === undefined ? '' : String(v).trim();
  if (!s) return null;
  if (!/^(rp\.?\s*)?\d[\d.\s]*(,\d+)?$/i.test(s)) throw userError('Harga satuan harus angka, mis. 1.500.000.');
  const n = Number(s.replace(/[^\d,]/g, '').replace(',', '.'));
  if (n > MAX_HARGA) throw userError('Harga satuan terlalu besar.');
  return Math.round(n * 100) / 100;
}

export async function listUsulan() {
  const rows = await sbSelect(
    'usulan_pembelian',
    { select: `${USULAN_FIELDS},bom(judul,revisi,status),usulan_pembelian_baris(qty_beli,harga_satuan)`, order: 'id.desc' },
    { limit: 300 }
  );
  return (rows || []).map(({ usulan_pembelian_baris: baris, ...u }) => ({ ...u, ...ringkasUsulan(baris) }));
}

export async function getUsulan(idRaw) {
  const id = positiveId(idRaw, 'Nomor usulan');
  const rows = await sbSelect('usulan_pembelian', { select: `${USULAN_FIELDS},bom(id,judul,revisi,status)`, id: `eq.${id}` });
  const usulan = rows && rows[0];
  if (!usulan) return null;
  const [baris, riwayat] = await Promise.all([
    sbSelectAll('usulan_pembelian_baris', { select: USULAN_BARIS_FIELDS, usulan_id: `eq.${id}`, order: 'barang_kode' }),
    // Usulan lain dari BOM yang sama (mis. yang pernah ditolak)
    sbSelect('usulan_pembelian', { select: 'id,status,diputuskan_pada,catatan_keputusan', bom_id: `eq.${usulan.bom_id}`, id: `neq.${id}`, order: 'id.desc' }),
  ]);
  return { usulan, baris, riwayat: riwayat || [] };
}

export async function buatUsulan(payload, email) {
  const bom_id = positiveId(payload?.bom_id, 'Nomor BOM');
  const r = await sbRpc('sisihkan_dan_usulkan', { p_bom_id: bom_id, p_email: email });
  return { ...r, usulan_id: r && r.usulan_id ? Number(r.usulan_id) : null };
}

// Keterangan usulan untuk Direksi: vendor yang disarankan, tautan penawaran (https, mis. PDF di Drive), catatan.
export async function updateUsulan(payload, email) {
  const id = positiveId(payload?.id, 'Nomor usulan');
  const changes = {
    catatan: text(payload?.catatan, 'Catatan', { max: 1000 }),
    vendor: text(payload?.vendor, 'Vendor', { max: 300 }),
    tautan_penawaran: text(payload?.tautan_penawaran, 'Tautan penawaran', { max: 500 }),
    diubah_oleh: email,
  };
  if (changes.tautan_penawaran && !/^https:\/\//i.test(changes.tautan_penawaran)) {
    throw userError('Tautan penawaran harus diawali https://, mis. tautan file di Google Drive.');
  }
  const updated = await sbUpdate('usulan_pembelian', { id: `eq.${id}`, status: 'eq.draf', select: USULAN_FIELDS }, changes);
  if (updated && updated.length) return updated[0];
  const exists = await sbSelect('usulan_pembelian', { select: 'id', id: `eq.${id}` });
  if (!exists || !exists[0]) throw userError('Usulan tidak ditemukan.', 404);
  throw userError('Usulan yang sudah diajukan tidak bisa diubah.', 409);
}

export async function deleteUsulan(payload) {
  const id = positiveId(payload?.id, 'Nomor usulan');
  const deleted = await sbDelete('usulan_pembelian', { id: `eq.${id}`, status: 'eq.draf' });
  if (deleted && deleted.length) return { id };
  const exists = await sbSelect('usulan_pembelian', { select: 'id', id: `eq.${id}` });
  if (!exists || !exists[0]) throw userError('Usulan tidak ditemukan.', 404);
  throw userError('Usulan yang sudah diajukan tidak bisa dihapus.', 409);
}

// Ubah satu baris (jumlah beli, estimasi harga, catatan). Baris baru tidak ditambah dari web: isinya selalu dari BOM.
export async function saveUsulanLine(payload, email) {
  const p = payload || {};
  const usulan_id = positiveId(p.usulan_id, 'Nomor usulan');
  const id = positiveId(p.id, 'Baris usulan');
  const updated = await sbUpdate(
    'usulan_pembelian_baris',
    { id: `eq.${id}`, usulan_id: `eq.${usulan_id}`, select: USULAN_BARIS_FIELDS },
    { qty_beli: qtyBeli(p.qty_beli), harga_satuan: harga(p.harga_satuan), catatan: text(p.catatan, 'Catatan', { max: 300 }), diubah_oleh: email }
  );
  if (!updated || !updated.length) throw userError('Baris usulan tidak ditemukan. Muat ulang halaman.', 404);
  return updated[0];
}

export async function deleteUsulanLine(payload) {
  const usulan_id = positiveId(payload?.usulan_id, 'Nomor usulan');
  const id = positiveId(payload?.id, 'Baris usulan');
  await sbDelete('usulan_pembelian_baris', { id: `eq.${id}`, usulan_id: `eq.${usulan_id}` });
  return { id, usulan_id };
}

export async function ajukanUsulan(payload, email) {
  const id = positiveId(payload?.id, 'Nomor usulan');
  return sbRpc('ajukan_usulan', { p_id: id, p_email: email });
}

// Hak memutuskan dicek di pages/api/gudang.js (bisaMemutuskan) sebelum fungsi ini dipanggil.
export async function putuskanUsulan(payload, email) {
  const id = positiveId(payload?.id, 'Nomor usulan');
  if (typeof payload?.setuju !== 'boolean') throw userError('Pilih setujui atau tolak.');
  return sbRpc('putuskan_usulan', {
    p_id: id,
    p_email: email,
    p_setuju: payload.setuju,
    p_catatan: text(payload.catatan, 'Catatan keputusan', { max: 1000 }),
  });
}

// Diajukan -> draf lagi dengan catatan apa yang perlu dilengkapi. Hak memutuskan dicek di pages/api/gudang.js.
export async function kembalikanUsulan(payload, email) {
  const id = positiveId(payload?.id, 'Nomor usulan');
  return sbRpc('kembalikan_usulan', { p_id: id, p_email: email, p_catatan: text(payload?.catatan, 'Catatan', { max: 1000 }) });
}
