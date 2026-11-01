// /api/gudang-foto/<id>[?ukuran=kecil]: menyajikan foto gudang dari bucket Storage privat, hanya untuk pengguna yang
// login. Isi satu nomor foto tidak pernah berubah, jadi boleh disimpan lama di cache browser (private).
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseConfigured, sbStorageGet } from '../../../lib/supabaseServer';
import { BUCKET, pathFoto } from '../../../lib/fotoServer';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).end(); }
  if (!supabaseConfigured()) return res.status(500).end();
  try {
    const path = await pathFoto(req.query.id, req.query.ukuran === 'kecil');
    if (!path) return res.status(404).end();
    const upstream = await sbStorageGet(BUCKET, path);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    return res.status(200).send(buf);
  } catch (err) {
    console.error('Foto gudang gagal disajikan:', err);
    return res.status(err.status === 404 || err.status === 400 ? 404 : 502).end();
  }
}
