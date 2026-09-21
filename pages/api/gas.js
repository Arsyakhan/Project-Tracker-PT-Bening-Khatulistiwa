// Proxy server-side antara browser dan Google Apps Script.
//
// Kenapa ada ini?
// - URL & token Apps Script HANYA ada di server (env GAS_API_URL & GAS_API_TOKEN),
//   tidak pernah masuk ke bundle JavaScript browser.
// - Setiap request dicek dulu: harus punya sesi login NextAuth yang valid.
// - Field "user" (untuk Activity Log) diisi dari sesi di server, jadi tidak bisa dipalsukan.
//
// Catatan: middleware.js tidak menjaga /api/*, jadi pengecekan sesi WAJIB ada di sini.

import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

// Apps Script kadang lambat saat cold start; beri waktu lebih dari default Vercel.
export const config = { maxDuration: 30 };

// 'comments' & 'addComment' disiapkan untuk fitur komentar (backend-nya belum ada di Code.gs).
const GET_ACTIONS = new Set(['projects', 'dashboard', 'meta', 'activityLog', 'comments']);
const POST_ACTIONS = new Set(['addProject', 'updateProject', 'updateChecklist', 'deleteProject', 'addComment']);
// Parameter tambahan yang boleh diteruskan pada GET (selain action & token)
const GET_EXTRA_PARAMS = ['projectId', 'poNumber'];
const TIMEOUT_MS = 28000;

function fail(res, status, message) {
  return res.status(status).json({ ok: false, error: message });
}

async function readGasResponse(gasRes) {
  const text = await gasRes.text();
  try {
    return JSON.parse(text);
  } catch {
    // Apps Script mengembalikan halaman HTML kalau ada error tak tertangani / deployment salah.
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return fail(res, 401, 'Sesi habis. Silakan login lagi.');

  const gasUrl = process.env.GAS_API_URL;
  const gasToken = process.env.GAS_API_TOKEN;
  if (!gasUrl || !gasToken) {
    console.error('GAS_API_URL / GAS_API_TOKEN belum diset di Environment Variables.');
    return fail(res, 500, 'Server belum dikonfigurasi (GAS_API_URL / GAS_API_TOKEN).');
  }

  try {
    let gasRes;

    if (req.method === 'GET') {
      const action = String(req.query.action || '');
      if (!GET_ACTIONS.has(action)) return fail(res, 400, 'Action tidak dikenal.');

      const url = new URL(gasUrl);
      GET_EXTRA_PARAMS.forEach((k) => {
        if (typeof req.query[k] === 'string') url.searchParams.set(k, req.query[k]);
      });
      url.searchParams.set('action', action);
      url.searchParams.set('token', gasToken);
      gasRes = await fetch(url.toString(), {
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } else if (req.method === 'POST') {
      const body = req.body;
      if (!body || typeof body !== 'object') return fail(res, 400, 'Body harus JSON.');
      const { action, payload } = body;
      if (!POST_ACTIONS.has(action)) return fail(res, 400, 'Action tidak dikenal.');

      gasRes = await fetch(gasUrl, {
        method: 'POST',
        // text/plain supaya Apps Script tidak butuh preflight CORS
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action,
          token: gasToken,
          // "user" SELALU dari sesi server; nilai dari browser diabaikan.
          payload: { ...(payload && typeof payload === 'object' ? payload : {}), user: email },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } else {
      res.setHeader('Allow', 'GET, POST');
      return fail(res, 405, 'Method tidak diizinkan.');
    }

    const json = await readGasResponse(gasRes);
    if (!json) {
      console.error('Respons Apps Script bukan JSON. Status:', gasRes.status);
      return fail(res, 502, 'Backend (Apps Script) memberi respons tidak valid. Cek deployment-nya.');
    }
    if (!json.ok && json.error === 'Unauthorized') {
      console.error('Apps Script menolak token. GAS_API_TOKEN di Vercel tidak sama dengan API_TOKEN di Script Properties.');
      return fail(res, 502, 'Token backend tidak cocok. Hubungi admin.');
    }
    // Kesalahan logis (mis. "PO Number sudah dipakai") diteruskan apa adanya ke UI.
    return res.status(200).json(json);
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    console.error('Proxy Apps Script gagal:', err);
    return fail(res, timedOut ? 504 : 502, timedOut ? 'Backend terlalu lama merespons. Coba lagi.' : 'Tidak bisa menghubungi backend.');
  }
}
