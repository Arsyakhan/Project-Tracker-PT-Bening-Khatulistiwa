// Semua request lewat /api/gas (proxy server kita sendiri) — BUKAN langsung
// ke Apps Script. Proxy itu yang nyimpen token & nambahin identitas user dari
// sesi login, jadi di sini kita tidak perlu (dan tidak boleh) kirim token apa pun.

// Cache ringan di memori browser untuk getProjects(): navigasi antar halaman
// (Dashboard <-> Semua Project <-> detail) dalam beberapa detik tidak perlu
// minta ulang ke server. Dihapus otomatis begitu ada aksi tulis (add/update/
// checklist/delete) supaya perubahan sendiri selalu langsung terlihat.
import { clearCache } from './persistedCache';

let projectsCache = null; // { data, expiresAt }
const PROJECTS_CACHE_MS = 10000;
let cacheVersion = 0;   // naik tiap cache dibuang, supaya hasil request lama tidak menimpa cache baru
let inflight = null;    // { version, promise } -> request getProjects yang sedang jalan, dipakai bersama

function invalidateProjectsCache() {
  projectsCache = null;
  cacheVersion++;
  // Data tersimpan di browser (lib/persistedCache.js) juga sudah usang setelah ada perubahan.
  clearCache('projects');
}

async function callGet(action, extraParams) {
  const qs = new URLSearchParams({ action, ...(extraParams || {}) });
  const res = await fetch(`/api/gas?${qs.toString()}`, { cache: 'no-store' });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}

async function callPost(action, payload) {
  const res = await fetch('/api/gas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}

// Beberapa komponen bisa minta daftar project hampir bersamaan (halaman + pencarian Ctrl+K,
// dll). Request yang sedang berjalan dipakai bersama, jadi backend yang lambat tidak dipanggil
// dua kali untuk data yang sama.
function getProjects() {
  if (projectsCache && projectsCache.expiresAt > Date.now()) {
    return Promise.resolve(projectsCache.data);
  }
  if (inflight && inflight.version === cacheVersion) return inflight.promise;

  const version = cacheVersion;
  const promise = callGet('projects')
    .then((data) => {
      if (version === cacheVersion) {
        projectsCache = { data, expiresAt: Date.now() + PROJECTS_CACHE_MS };
      }
      return data;
    })
    .finally(() => {
      if (inflight && inflight.promise === promise) inflight = null;
    });
  inflight = { version, promise };
  return promise;
}

// Meta (daftar stage, status, prioritas) hampir tidak pernah berubah, jadi cukup diambil sekali
// per sesi halaman. Kalau gagal, percobaan berikutnya boleh mengulang.
let metaPromise = null;
function getMeta() {
  if (!metaPromise) {
    metaPromise = callGet('meta').catch((err) => {
      metaPromise = null;
      throw err;
    });
  }
  return metaPromise;
}

// Aksi tulis: jalankan, lalu buang cache projects supaya request berikutnya
// (mis. load() setelah simpan) pasti dapat data terbaru, bukan yang basi.
async function mutateAndInvalidate(action, payload) {
  const data = await callPost(action, payload);
  invalidateProjectsCache();
  return data;
}

// Generator Dokumen (Commissioning/Handover) lewat /api/docgen -- BUKAN /api/gas,
// karena ini memanggil script Apps Script yang lain (lihat pages/api/docgen.js).
async function generateDocument({ type, payload, projectId, checklistItem }) {
  const res = await fetch('/api/docgen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, payload, projectId, checklistItem })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  // Kalau projectId dikirim, checklist project itu mungkin ikut berubah (link & status),
  // jadi cache getProjects() perlu dibuang supaya halaman project menampilkan yang terbaru.
  if (projectId) invalidateProjectsCache();
  // Dokumen baru masuk ke Riwayat Dokumen, jadi data tersimpan riwayatnya sudah usang.
  clearCache('documents');
  return json.data;
}

// Riwayat dokumen yang pernah dibuat lewat Generator Dokumen (tab "Document Log" di sheet).
// Diambil lewat /api/docgen (GET), bukan /api/gas. projectId opsional untuk memfilter satu project.
async function getDocuments(projectId) {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const res = await fetch(`/api/docgen${qs}`, { cache: 'no-store' });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}

// Buat Google Doc notulensi lewat /api/meeting-doc (script Apps Script generator yang terpisah).
async function generateMeetingDoc(meetingId) {
  const res = await fetch('/api/meeting-doc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}

export const api = {
  getProjects,
  getDashboard: () => callGet('dashboard'),
  getMeta,
  getActivityLog: () => callGet('activityLog'),
  getComments: (projectId) => callGet('comments', { projectId }),
  addProject: (payload) => mutateAndInvalidate('addProject', payload),
  updateProject: (payload) => mutateAndInvalidate('updateProject', payload),
  updateChecklist: (payload) => mutateAndInvalidate('updateChecklist', payload),
  deleteProject: (payload) => mutateAndInvalidate('deleteProject', payload),
  addComment: (payload) => callPost('addComment', payload),
  // Spesifikasi peralatan per project (dipakai tab Spesifikasi & form Hand Over). Tidak ikut cache projects.
  getSpecs: (projectId) => callGet('specs', { projectId }),
  saveSpecs: (payload) => callPost('saveSpecs', payload),
  // Notulensi rapat (tab "Meetings"). Tidak ikut cache projects.
  getMeetings: () => callGet('meetings'),
  saveMeeting: (payload) => callPost('saveMeeting', payload),
  deleteMeeting: (payload) => callPost('deleteMeeting', payload),
  generateMeetingDoc,
  generateDocument,
  getDocuments
};
