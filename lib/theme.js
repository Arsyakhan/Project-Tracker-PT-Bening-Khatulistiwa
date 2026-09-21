const KEY = 'ptbk_theme'; // 'light' | 'dark'

export function getStoredTheme() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function setStoredTheme(theme) {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KEY, theme);
    } catch {
      // localStorage tidak tersedia (mode private, dll) — abaikan saja
    }
  }
  applyTheme(theme);
}
