// API modul gudang (Supabase). Sama seperti /api/gas: sesi NextAuth wajib, peran dicek di server,
// dan kunci Supabase hanya dipakai di sini (lib/supabaseServer.js), tidak pernah dikirim ke browser.

import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getRoleForEmail, canWrite, MSG_VIEWER } from '../../lib/roles';
import { supabaseConfigured, sbSelect, sbSelectAll, sbUpdate } from '../../lib/supabaseServer';
import { BARANG_EDITABLE, STATUS_CEK_KEYS } from '../../lib/gudang';

export const config = { maxDuration: 30 };

const KATALOG_FIELDS = 'kode,kategori_kode,nama,spesifikasi,ukuran,material,merek,model,satuan,dipakai_project,status_cek,perlu_dicek,gabung_ke,aktif,diubah_pada';
const KODE_RE = /^[A-Z]{3}-\d{4}$/;
const MAX_TEXT = 500;

// Galat yang pesannya aman dan berguna untuk pengguna (salah isi, konflik, tidak ditemukan).
function userError(message, status = 400, code) {
  return Object.assign(new Error(message), { userFacing: true, status, code });
}

function fail(res, status, message, code) {
  return res.status(status).json({ ok: false, error: message, ...(code ? { code } : {}) });
}

async function getKatalog() {
  const [kategori, barang, stok] = await Promise.all([
    sbSelect('kategori_barang', { select: 'kode,nama,urutan', order: 'urutan' }),
    sbSelectAll('barang', { select: KATALOG_FIELDS, order: 'kode' }),
    sbSelectAll('stok_barang', { select: 'kode,stok', stok: 'neq.0', order: 'kode' }),
  ]);
  const stokOf = new Map(stok.map((s) => [s.kode, Number(s.stok) || 0]));
  return { kategori, barang: barang.map((b) => ({ ...b, stok: stokOf.get(b.kode) || 0 })) };
}

async function getBarang(kode) {
  const [rows, stok, kategori] = await Promise.all([
    sbSelect('barang', { select: '*', kode: `eq.${kode}` }),
    sbSelect('stok_barang', { select: 'stok,transaksi_terakhir', kode: `eq.${kode}` }),
    sbSelect('kategori_barang', { select: 'kode,nama,urutan', order: 'urutan' }),
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
  return {
    barang,
    stok: stok && stok[0] ? { stok: Number(stok[0].stok) || 0, transaksi_terakhir: stok[0].transaksi_terakhir } : { stok: 0 },
    kategori,
    baris,
    files,
    digabung: digabung || [],
  };
}

// Bersihkan perubahan dari browser: hanya kolom yang diizinkan, teks dipangkas, aturan Gabung dicek.
async function cleanChanges(kode, changes) {
  const out = {};
  for (const key of BARANG_EDITABLE) {
    if (!(key in changes)) continue;
    let v = changes[key];
    if (key === 'stok_minimum') {
      if (v === '' || v === null || v === undefined) v = null;
      else {
        v = Number(String(v).replace(',', '.'));
        if (!Number.isFinite(v) || v < 0) throw userError('Stok minimum harus angka 0 atau lebih.');
      }
    } else {
      v = v === null || v === undefined ? '' : String(v).trim();
      if (v.length > MAX_TEXT) throw userError(`Isian ${key} terlalu panjang (maksimal ${MAX_TEXT} karakter).`);
      if (v === '') v = null;
    }
    out[key] = v;
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
    const status = 'status_cek' in out ? out.status_cek : changes.__statusLama;
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

async function updateBarang(payload, email) {
  const kode = String(payload?.kode || '').toUpperCase();
  if (!KODE_RE.test(kode)) throw userError('Kode barang tidak valid.');
  const base = String(payload?.baseDiubahPada || '');
  if (!base) throw userError('Data dasar tidak lengkap. Muat ulang halaman.');
  const changes = await cleanChanges(kode, { ...(payload.changes || {}), __statusLama: payload.statusLama });
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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return fail(res, 401, 'Sesi habis. Silakan login lagi.');

  if (!supabaseConfigured()) {
    console.error('SUPABASE_URL / SUPABASE_SECRET_KEY belum diset di Environment Variables.');
    return fail(res, 500, 'Database gudang belum dikonfigurasi (SUPABASE_URL / SUPABASE_SECRET_KEY).');
  }

  try {
    if (req.method === 'GET') {
      const action = String(req.query.action || '');
      if (action === 'katalog') return res.status(200).json({ ok: true, data: await getKatalog() });
      if (action === 'barang') {
        const kode = String(req.query.kode || '').toUpperCase();
        if (!KODE_RE.test(kode)) return fail(res, 400, 'Kode barang tidak valid.');
        const data = await getBarang(kode);
        if (!data) return fail(res, 404, `Barang ${kode} tidak ada di katalog.`);
        return res.status(200).json({ ok: true, data });
      }
      return fail(res, 400, 'Action tidak dikenal.');
    }

    if (req.method === 'POST') {
      const body = req.body;
      if (!body || typeof body !== 'object') return fail(res, 400, 'Body harus JSON.');
      const role = getRoleForEmail(email);
      if (!canWrite(role)) return fail(res, 403, MSG_VIEWER);
      if (body.action === 'updateBarang') {
        return res.status(200).json({ ok: true, data: await updateBarang(body.payload, email) });
      }
      return fail(res, 400, 'Action tidak dikenal.');
    }

    res.setHeader('Allow', 'GET, POST');
    return fail(res, 405, 'Method tidak diizinkan.');
  } catch (err) {
    if (err.userFacing) return fail(res, err.status || 400, err.message, err.code);
    // Pelanggaran kunci asing dari Postgres (mis. kategori tidak dikenal): salah isi, bukan galat server.
    if (err.code === '23503') return fail(res, 400, 'Kategori atau kode barang yang dipilih tidak ada di katalog.');
    console.error('API gudang gagal:', err);
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return fail(res, timedOut ? 504 : 502, timedOut ? 'Database gudang terlalu lama merespons. Coba lagi.' : 'Tidak bisa menghubungi database gudang. Coba lagi.');
  }
}
