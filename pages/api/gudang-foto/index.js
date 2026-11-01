// /api/gudang-foto: daftar, unggah, tautkan, dan hapus foto barang. Route terpisah dari /api/gudang karena unggahan
// foto (base64) lebih besar dari batas body bawaan. Sesi wajib; menulis hanya untuk editor dan admin.
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getRoleForEmail, canWrite, MSG_VIEWER } from '../../../lib/roles';
import { supabaseConfigured } from '../../../lib/supabaseServer';
import { listFoto, unggahFoto, tautkanFoto, hapusFoto } from '../../../lib/fotoServer';

// Vercel membatasi body 4,5 MB; foto sudah dikompres di browser (biasanya < 400 KB).
export const config = { maxDuration: 30, api: { bodyParser: { sizeLimit: '4.4mb' } } };

const ACTIONS = { unggah: unggahFoto, tautkan: tautkanFoto, hapus: (p) => hapusFoto(p?.id) };

function fail(res, status, message) {
  return res.status(status).json({ ok: false, error: message });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return fail(res, 401, 'Sesi habis. Silakan login lagi.');
  if (!supabaseConfigured()) return fail(res, 500, 'Database gudang belum dikonfigurasi.');

  try {
    if (req.method === 'GET') return res.status(200).json({ ok: true, data: await listFoto(String(req.query.kode || '')) });
    if (req.method === 'POST') {
      const body = req.body;
      const fn = body && typeof body === 'object' ? ACTIONS[body.action] : null;
      if (!fn) return fail(res, 400, 'Action tidak dikenal.');
      if (!canWrite(getRoleForEmail(email))) return fail(res, 403, MSG_VIEWER);
      return res.status(200).json({ ok: true, data: await fn(body.payload || {}, email) });
    }
    res.setHeader('Allow', 'GET, POST');
    return fail(res, 405, 'Method tidak diizinkan.');
  } catch (err) {
    if (err.userFacing) return fail(res, err.status || 400, err.message);
    if (err.code === '23514') return fail(res, 400, 'Isian foto tidak memenuhi aturan database.');
    console.error('API foto gudang gagal:', err);
    return fail(res, 502, 'Foto belum bisa disimpan. Coba lagi.');
  }
}
