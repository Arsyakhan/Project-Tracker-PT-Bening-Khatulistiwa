// Membuat Google Doc notulensi dari satu rapat yang sudah tersimpan.
//
// Alur (server-side, sama prinsipnya dengan /api/docgen.js):
//   1) wajib login (NextAuth)
//   2) ambil data rapat TERBARU dari backend Project Tracker (GAS_API_URL + GAS_API_TOKEN),
//      jadi dokumen selalu sesuai yang tersimpan, bukan kiriman dari browser
//   3) panggil script Apps Script Generator Notulensi (DOCGEN_MEETING_URL, + DOCGEN_MEETING_SECRET)
//   4) simpan link dokumen ke baris rapat (action "setMeetingDoc")
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

export const config = { maxDuration: 30 };

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

  const meetingId = typeof req.body?.meetingId === 'string' ? req.body.meetingId.trim() : '';
  if (!meetingId) return fail(res, 400, 'meetingId wajib diisi.');

  const gasUrl = process.env.GAS_API_URL;
  const gasToken = process.env.GAS_API_TOKEN;
  const genUrl = process.env.DOCGEN_MEETING_URL;
  if (!gasUrl || !gasToken) return fail(res, 500, 'Server belum dikonfigurasi (GAS_API_URL / GAS_API_TOKEN).');
  if (!genUrl) {
    console.error('DOCGEN_MEETING_URL belum diset di Environment Variables.');
    return fail(res, 500, 'Generator Notulensi belum dikonfigurasi (DOCGEN_MEETING_URL).');
  }

  // 1) Ambil rapat dari backend
  let meeting = null;
  try {
    const url = new URL(gasUrl);
    url.searchParams.set('action', 'meetings');
    url.searchParams.set('token', gasToken);
    const r = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
    const json = await readJsonSafely(r);
    if (!json || !json.ok) return fail(res, 502, (json && json.error) || 'Backend memberi respons tidak valid.');
    meeting = (json.data || []).find((m) => m.id === meetingId) || null;
  } catch (err) {
    console.error('Ambil data rapat gagal:', err);
    return fail(res, 502, 'Tidak bisa menghubungi backend.');
  }
  if (!meeting) return fail(res, 404, 'Rapat tidak ditemukan. Simpan dulu, lalu coba lagi.');

  // 2) Buat dokumen
  let docJson = null;
  try {
    const r = await fetch(genUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: process.env.DOCGEN_MEETING_SECRET || '', meeting }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    docJson = await readJsonSafely(r);
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    console.error('Panggil Generator Notulensi gagal:', err);
    return fail(res, timedOut ? 504 : 502, timedOut ? 'Pembuatan dokumen terlalu lama. Coba lagi.' : 'Tidak bisa menghubungi Generator Notulensi.');
  }
  if (!docJson) return fail(res, 502, 'Generator Notulensi memberi respons tidak valid. Cek URL deployment-nya.');
  if (docJson.status !== 'success' || !docJson.documentUrl) return fail(res, 502, docJson.message || 'Gagal membuat dokumen.');

  // 3) Simpan link ke baris rapat (best effort: dokumen sudah jadi walau langkah ini gagal)
  let saved = false;
  try {
    const r = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'setMeetingDoc', token: gasToken, payload: { id: meetingId, docUrl: docJson.documentUrl, user: email } }),
      signal: AbortSignal.timeout(15000),
    });
    const json = await readJsonSafely(r);
    saved = !!(json && json.ok);
    if (!saved) console.error('Gagal setMeetingDoc:', json && json.error);
  } catch (err) {
    console.error('Simpan link dokumen rapat gagal:', err);
  }

  return res.status(200).json({ ok: true, data: { documentUrl: docJson.documentUrl, fileName: docJson.fileName || '', linkSaved: saved } });
}
