const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function callGet(action, extraParams) {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL belum diset di .env.local');
  const qs = new URLSearchParams({ action, ...(extraParams || {}) });
  const res = await fetch(`${API_URL}?${qs.toString()}`, { cache: 'no-store' });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}

// Apps Script doesn't handle CORS preflight for JSON content-type, so we
// send as text/plain and parse JSON server-side to avoid the OPTIONS request.
async function callPost(action, payload) {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL belum diset di .env.local');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
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
  getComments: (poNumber) => callGet('comments', { poNumber }),
  addProject: (payload) => callPost('addProject', payload),
  updateProject: (payload) => callPost('updateProject', payload),
  updateChecklist: (payload) => callPost('updateChecklist', payload),
  deleteProject: (payload) => callPost('deleteProject', payload),
  addComment: (payload) => callPost('addComment', payload)
};
