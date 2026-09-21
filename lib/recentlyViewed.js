const KEY = 'ptbk_recent_projects';
const MAX = 5;

export function getRecentProjects() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentProject({ poNumber, projectName }) {
  if (typeof window === 'undefined' || !poNumber) return;
  try {
    const current = getRecentProjects().filter((p) => p.poNumber !== poNumber);
    const updated = [{ poNumber, projectName, viewedAt: Date.now() }, ...current].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('recentProjectsUpdated'));
  } catch {
    // localStorage tidak tersedia — abaikan saja, ini fitur pelengkap bukan kritis
  }
}
