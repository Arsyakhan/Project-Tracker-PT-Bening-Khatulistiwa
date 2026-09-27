// Proxy server-side untuk Generator Dokumen (Commissioning Report & Handover Report).
//
// Prinsip yang sama seperti /api/gas.js:
// - URL Apps Script Generator Dokumen HANYA ada di server (env DOCGEN_COMMISSIONING_URL
//   / DOCGEN_HANDOVER_URL), tidak pernah masuk ke bundle JavaScript browser.
// - Setiap request wajib punya sesi login NextAuth yang valid.
// - Kedua script Apps Script Generator Dokumen TIDAK diubah sama sekali -- proxy ini
//   cuma meneruskan payload yang persis sama seperti yang dulu dikirim langsung dari
//   browser di tool lama.
//
// Tambahan dari sekadar proxy: kalau request menyertakan projectId, setelah dokumen
// berhasil dibuat, route ini otomatis memanggil action "updateChecklist" yang sudah
// ada di backend Project Tracker (GAS_API_URL) untuk menyimpan link + mengubah status
// checklist jadi "Under Review" -- tanpa perlu bolak-balik lagi ke browser.

import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

export const config = { maxDuration: 30 };

const DOCGEN_URLS = {
  commissioning: process.env.DOCGEN_COMMISSIONING_URL,
  handover: process.env.DOCGEN_HANDOVER_URL,
};

// Harus sama persis dengan CHECKLIST_ITEMS di Code.gs (backend Project Tracker).
const CHECKLIST_ITEM_BY_TYPE = {
  commissioning: 'Commissioning Report',
  handover: 'Handover Report',
};

const TIMEOUT_MS = 28000;

function fail(res, status, message) {
  return res.status(status).json({ ok: false, error: message });
}

async function readJsonSafely(r) {
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'Method tidak diizinkan.');
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return fail(res, 401, 'Sesi habis. Silakan login lagi.');

  const body = req.body;
  if (!body || typeof body !== 'object') return fail(res, 400, 'Body harus JSON.');
  const { type, payload, projectId, checklistItem } = body;

  const docgenUrl = DOCGEN_URLS[type];
  if (!docgenUrl) {
    console.error(`DOCGEN_${String(type).toUpperCase()}_URL belum diset di Environment Variables, atau "type" salah.`);
    return fail(res, 500, 'Server belum dikonfigurasi untuk tipe dokumen ini.');
  }
  if (!payload || typeof payload !== 'object') return fail(res, 400, 'Payload harus JSON.');

  // 1) Panggil Apps Script Generator Dokumen yang sudah ada (tidak diubah sama sekali).
  let docRes;
  try {
    docRes = await fetch(docgenUrl, {
      method: 'POST',
      // text/plain: sama seperti tool lama, dan senada dengan /api/gas.js (supaya Apps
      // Script tidak butuh preflight CORS -- meski di sini ini server-to-server, jadi
      // CORS sendiri tidak relevan, tapi disamakan saja untuk konsistensi).
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    console.error('Panggil Apps Script Generator Dokumen gagal:', err);
    return fail(
      res,
      timedOut ? 504 : 502,
      timedOut ? 'Pembuatan dokumen terlalu lama. Coba lagi.' : 'Tidak bisa menghubungi Generator Dokumen.'
    );
  }

  const docJson = await readJsonSafely(docRes);
  if (!docJson) {
    console.error('Respons Generator Dokumen bukan JSON. Status:', docRes.status);
    return fail(res, 502, 'Generator Dokumen memberi respons tidak valid. Cek deployment Apps Script-nya (URL di env var masih benar?).');
  }
  if (docJson.status !== 'success' || !docJson.documentUrl) {
    return fail(res, 502, docJson.message || 'Gagal membuat dokumen.');
  }

  const result = { documentUrl: docJson.documentUrl, fileName: docJson.fileName || '', checklistUpdated: false };

  // 2) Kalau ada projectId, simpan link + status ke Checklist Engineering secara otomatis
  //    lewat backend Project Tracker yang sudah ada (GAS_API_URL / GAS_API_TOKEN).
  const item = checklistItem || CHECKLIST_ITEM_BY_TYPE[type];
  if (projectId && item) {
    const gasUrl = process.env.GAS_API_URL;
    const gasToken = process.env.GAS_API_TOKEN;
    if (!gasUrl || !gasToken) {
      console.error('GAS_API_URL / GAS_API_TOKEN belum diset -- link dokumen tidak otomatis tersimpan ke checklist.');
    } else {
      try {
        const clRes = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'updateChecklist',
            token: gasToken,
            payload: {
              projectId,
              items: { [item]: 'Under Review' },
              links: { [item]: docJson.documentUrl },
              // "user" SELALU dari sesi server, sama seperti /api/gas.js.
              user: email,
            },
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const clJson = await readJsonSafely(clRes);
        result.checklistUpdated = !!(clJson && clJson.ok);
        if (clJson && !clJson.ok) console.error('Gagal update checklist otomatis:', clJson.error);
      } catch (err) {
        console.error('Panggil updateChecklist otomatis gagal:', err);
        // Dokumennya sendiri tetap berhasil dibuat -- ini bukan kegagalan fatal, cuma
        // berarti link-nya perlu ditempel manual di tab Checklist Engineering.
      }
    }
  }

  return res.status(200).json({ ok: true, data: result });
}
