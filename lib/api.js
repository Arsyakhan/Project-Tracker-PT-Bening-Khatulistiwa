// Semua request lewat /api/gas (proxy server kita sendiri) — BUKAN langsung
// ke Apps Script. Proxy itu yang nyimpen token & nambahin identitas user dari
// sesi login, jadi di sini kita tidak perlu (dan tidak boleh) kirim token apa pun.

// Cache ringan di memori browser untuk getProjects(): navigasi antar halaman
// (Dashboard <-> Semua Project <-> detail) dalam beberapa detik tidak perlu
// minta ulang ke server. Dihapus otomatis begitu ada aksi tulis (add/update/
// checklist/delete) supaya perubahan sendiri selalu langsung terlihat.
let projectsCache = null; // { data, expiresAt }
const PROJECTS_CACHE_MS = 10000;

function invalidateProjectsCache() {
  projectsCache = null;
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

async function getProjects() {
  if (projectsCache && projectsCache.expiresAt > Date.now()) {
    return projectsCache.data;
  }
  const data = await callGet('projects');
  projectsCache = { data, expiresAt: Date.now() + PROJECTS_CACHE_MS };
  return data;
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
  return json.data;
}

export const api = {
  getProjects,
  getDashboard: () => callGet('dashboard'),
  getMeta: () => callGet('meta'),
  getActivityLog: () => callGet('activityLog'),
  getComments: (projectId) => callGet('comments', { projectId }),
  addProject: (payload) => mutateAndInvalidate('addProject', payload),
  updateProject: (payload) => mutateAndInvalidate('updateProject', payload),
  updateChecklist: (payload) => mutateAndInvalidate('updateChecklist', payload),
  deleteProject: (payload) => mutateAndInvalidate('deleteProject', payload),
  addComment: (payload) => callPost('addComment', payload),
  generateDocument
};
