// API modul gudang (Supabase). Sama seperti /api/gas: sesi NextAuth wajib, peran dicek di server,
// dan kunci Supabase hanya dipakai di server (lib/supabaseServer.js), tidak pernah dikirim ke browser.
// Logikanya ada di lib/gudangServer.js; file ini hanya membagi aksi dan memeriksa peran.

import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getRoleForEmail, canWrite, MSG_VIEWER } from '../../lib/roles';
import { supabaseConfigured } from '../../lib/supabaseServer';
import {
  KODE_RE,
  getKatalog, getBarang, updateBarang, createBarang,
  getLokasi, createLokasi,
  listOpname, getOpname, createOpname, deleteOpname, saveOpnameLine, deleteOpnameLine, postOpname,
  listBom, getBom, getBomSumber, createBom, revisiBom, updateBom, deleteBom, saveBomLine, deleteBomLine, terbitkanBom,
  bisaMemutuskan, listUsulan, getUsulan, buatUsulan, updateUsulan, deleteUsulan, saveUsulanLine, deleteUsulanLine,
  ajukanUsulan, putuskanUsulan,
} from '../../lib/gudangServer';

const MSG_BUKAN_DIREKSI = 'Usulan pembelian hanya bisa diputuskan oleh Direksi (atau Admin selama belum ada Direksi yang terdaftar).';

export const config = { maxDuration: 30 };

// Aksi tulis (semuanya untuk editor dan admin; viewer hanya membaca).
const POST_ACTIONS = {
  updateBarang,
  createBarang,
  createLokasi,
  createOpname,
  deleteOpname,
  saveOpnameLine,
  deleteOpnameLine,
  postOpname,
  createBom,
  revisiBom,
  updateBom,
  deleteBom,
  saveBomLine,
  deleteBomLine,
  terbitkanBom,
  buatUsulan,
  updateUsulan,
  deleteUsulan,
  saveUsulanLine,
  deleteUsulanLine,
  ajukanUsulan,
  putuskanUsulan, // juga wajib lolos bisaMemutuskan (lihat handler)
};

function fail(res, status, message, code) {
  return res.status(status).json({ ok: false, error: message, ...(code ? { code } : {}) });
}

async function handleGet(req, res, email) {
  const action = String(req.query.action || '');
  if (action === 'usulanList' || action === 'usulan') {
    const role = getRoleForEmail(email);
    const [data, boleh] = await Promise.all([
      action === 'usulanList' ? listUsulan() : getUsulan(req.query.id),
      bisaMemutuskan(email, role),
    ]);
    if (!data) return fail(res, 404, 'Usulan pembelian tidak ditemukan.');
    const bisa = { bisaMemutuskan: boleh && canWrite(role) };
    return res.status(200).json({ ok: true, data: action === 'usulanList' ? { usulan: data, ...bisa } : { ...data, ...bisa } });
  }
  if (action === 'katalog') return res.status(200).json({ ok: true, data: await getKatalog() });
  if (action === 'barang') {
    const kode = String(req.query.kode || '').toUpperCase();
    if (!KODE_RE.test(kode)) return fail(res, 400, 'Kode barang tidak valid.');
    const data = await getBarang(kode);
    if (!data) return fail(res, 404, `Barang ${kode} tidak ada di katalog.`);
    return res.status(200).json({ ok: true, data });
  }
  if (action === 'lokasi') return res.status(200).json({ ok: true, data: await getLokasi() });
  if (action === 'opnameList') return res.status(200).json({ ok: true, data: await listOpname() });
  if (action === 'opname') {
    const data = await getOpname(req.query.id);
    if (!data) return fail(res, 404, 'Sesi opname tidak ditemukan.');
    return res.status(200).json({ ok: true, data });
  }
  if (action === 'bomList') return res.status(200).json({ ok: true, data: await listBom({ project: req.query.project }) });
  if (action === 'bom') {
    const data = await getBom(req.query.id);
    if (!data) return fail(res, 404, 'BOM tidak ditemukan.');
    return res.status(200).json({ ok: true, data });
  }
  if (action === 'bomSumber') return res.status(200).json({ ok: true, data: await getBomSumber() });
  return fail(res, 400, 'Action tidak dikenal.');
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
    if (req.method === 'GET') return await handleGet(req, res, email);

    if (req.method === 'POST') {
      const body = req.body;
      if (!body || typeof body !== 'object') return fail(res, 400, 'Body harus JSON.');
      const fn = POST_ACTIONS[body.action];
      if (!fn) return fail(res, 400, 'Action tidak dikenal.');
      const role = getRoleForEmail(email);
      if (!canWrite(role)) return fail(res, 403, MSG_VIEWER);
      if (body.action === 'putuskanUsulan' && !(await bisaMemutuskan(email, role))) return fail(res, 403, MSG_BUKAN_DIREKSI);
      return res.status(200).json({ ok: true, data: await fn(body.payload || {}, email) });
    }

    res.setHeader('Allow', 'GET, POST');
    return fail(res, 405, 'Method tidak diizinkan.');
  } catch (err) {
    if (err.userFacing) return fail(res, err.status || 400, err.message, err.code);
    // Galat dari database yang berarti isian/keadaan data, bukan server rusak:
    // P0001 = pesan dari fungsi/trigger database (sudah berbahasa Indonesia), 23503 = kunci asing, 23505 = data ganda.
    if (err.code === 'P0001') return fail(res, 409, err.message);
    if (err.code === '23503') return fail(res, 400, 'Kategori, lokasi, sesi, atau kode barang yang dipilih tidak ada.');
    if (err.code === '23505') return fail(res, 409, 'Data yang sama sudah ada. Muat ulang halaman.');
    if (err.code === '23514') return fail(res, 400, 'Isian tidak memenuhi aturan database.');
    console.error('API gudang gagal:', err);
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return fail(res, timedOut ? 504 : 502, timedOut ? 'Database gudang terlalu lama merespons. Coba lagi.' : 'Tidak bisa menghubungi database gudang. Coba lagi.');
  }
}
