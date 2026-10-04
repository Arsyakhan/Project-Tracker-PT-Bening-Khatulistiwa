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
//
// Tambahan lain: SETIAP dokumen yang berhasil dibuat (dengan atau tanpa projectId) dicatat
// ke tab "Document Log" lewat action "logDocument". GET /api/docgen membaca riwayat itu.

import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getRoleForEmail, canWrite, MSG_VIEWER } from '../../lib/roles';

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

// Panggil backend Project Tracker (Apps Script) dari server. Tidak pernah melempar error:
// kalau gagal, hasilnya null dan penyebabnya dicatat di log Vercel.
async function callGasPost(gasUrl, gasToken, action, payload, timeoutMs) {
  try {
    const r = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: gasToken, payload }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = await readJsonSafely(r);
    if (!json) console.error(`Respons ${action} bukan JSON. Status:`, r.status);
    else if (!json.ok) console.error(`Gagal ${action}:`, json.error);
    return json;
  } catch (err) {
    console.error(`Panggil ${action} gagal:`, err);
    return null;
  }
}

// GET: riwayat dokumen (opsional ?projectId=...)
async function handleList(req, res) {
  const gasUrl = process.env.GAS_API_URL;
  const gasToken = process.env.GAS_API_TOKEN;
  if (!gasUrl || !gasToken) {
    console.error('GAS_API_URL / GAS_API_TOKEN belum diset di Environment Variables.');
    return fail(res, 500, 'Server belum dikonfigurasi (GAS_API_URL / GAS_API_TOKEN).');
  }
  try {
    const url = new URL(gasUrl);
    url.searchParams.set('action', 'documents');
    url.searchParams.set('token', gasToken);
    if (typeof req.query.projectId === 'string' && req.query.projectId) {
      url.searchParams.set('projectId', req.query.projectId);
    }
    const r = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
    const json = await readJsonSafely(r);
    if (!json) return fail(res, 502, 'Backend (Apps Script) memberi respons tidak valid. Cek deployment-nya.');
    if (!json.ok && json.error === 'Unauthorized') {
      console.error('Apps Script menolak token. GAS_API_TOKEN di Vercel tidak sama dengan API_TOKEN di Script Properties.');
      return fail(res, 502, 'Token backend tidak cocok. Hubungi admin.');
    }
    return res.status(200).json(json);
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    console.error('Ambil riwayat dokumen gagal:', err);
    return fail(res, timedOut ? 504 : 502, timedOut ? 'Backend terlalu lama merespons. Coba lagi.' : 'Tidak bisa menghubungi backend.');
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return fail(res, 405, 'Method tidak diizinkan.');
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return fail(res, 401, 'Sesi habis. Silakan login lagi.');

  if (req.method === 'GET') return handleList(req, res);

  // Membuat dokumen = menulis ke Drive & spreadsheet, jadi Viewer tidak boleh.
  if (!canWrite(getRoleForEmail(email))) return fail(res, 403, MSG_VIEWER);

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

  const result = {
    documentUrl: docJson.documentUrl,
    fileName: docJson.fileName || '',
    checklistUpdated: false,
    logged: false,
  };

  // 2) Setelah dokumen jadi, dua hal dikerjakan bersamaan lewat backend Project Tracker
  //    (GAS_API_URL / GAS_API_TOKEN). Keduanya "best effort": kalau gagal, dokumennya
  //    tetap berhasil dibuat dan link-nya tetap dikembalikan ke browser.
  //    a) logDocument     : catat ke tab "Document Log" (selalu, termasuk dokumen tanpa project)
  //    b) updateChecklist : hanya kalau ada projectId -> simpan link + status "Under Review"
  const gasUrl = process.env.GAS_API_URL;
  const gasToken = process.env.GAS_API_TOKEN;
  if (!gasUrl || !gasToken) {
    console.error('GAS_API_URL / GAS_API_TOKEN belum diset -- dokumen tidak dicatat & link tidak tersimpan ke checklist.');
  } else {
    const item = checklistItem || CHECKLIST_ITEM_BY_TYPE[type];

    const logTask = callGasPost(
      gasUrl,
      gasToken,
      'logDocument',
      {
        docType: type,
        fileName: result.fileName,
        documentUrl: result.documentUrl,
        poNumber: payload.po_number || '',
        projectName: payload.project_name || payload.company_name || '',
        projectId: projectId || '',
        // "user" SELALU dari sesi server, sama seperti /api/gas.js.
        user: email,
      },
      15000
    );

    const checklistTask =
      projectId && item
        ? callGasPost(
            gasUrl,
            gasToken,
            'updateChecklist',
            {
              projectId,
              items: { [item]: 'Under Review' },
              links: { [item]: docJson.documentUrl },
              user: email,
            },
            TIMEOUT_MS
          )
        : Promise.resolve(null);

    const [logJson, clJson] = await Promise.all([logTask, checklistTask]);
    result.logged = !!(logJson && logJson.ok);
    result.checklistUpdated = !!(clJson && clJson.ok);
  }

  return res.status(200).json({ ok: true, data: result });
}
