// Semua request lewat /api/gas (proxy server kita sendiri) — BUKAN langsung
// ke Apps Script. Proxy itu yang nyimpen token & nambahin identitas user dari
// sesi login, jadi di sini kita tidak perlu (dan tidak boleh) kirim token apa pun.

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

export const api = {
  getProjects: () => callGet('projects'),
  getDashboard: () => callGet('dashboard'),
  getMeta: () => callGet('meta'),
  getActivityLog: () => callGet('activityLog'),
  getComments: (projectId) => callGet('comments', { projectId }),
  addProject: (payload) => callPost('addProject', payload),
  updateProject: (payload) => callPost('updateProject', payload),
  updateChecklist: (payload) => callPost('updateChecklist', payload),
  deleteProject: (payload) => callPost('deleteProject', payload),
  addComment: (payload) => callPost('addComment', payload)
};
