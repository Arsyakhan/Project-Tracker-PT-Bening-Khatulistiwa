const KEY = 'ptbk_recent_projects';
const MAX = 5;

export function getRecentProjects() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    // Data lama (sebelum ada Project ID) tidak punya "id" dan tidak bisa dibuka lagi: dibuang.
    return Array.isArray(list) ? list.filter((p) => p && p.id) : [];
  } catch {
    return [];
  }
}

export function addRecentProject({ id, poNumber, projectName }) {
  if (typeof window === 'undefined' || !id) return;
  try {
    const current = getRecentProjects().filter((p) => p.id !== id);
    const updated = [{ id, poNumber, projectName, viewedAt: Date.now() }, ...current].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('recentProjectsUpdated'));
  } catch {
    // localStorage tidak tersedia — abaikan saja, ini fitur pelengkap bukan kritis
  }
}
