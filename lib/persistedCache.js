// Cache persisten di browser (localStorage) supaya halaman bisa langsung menampilkan data
// terakhir sambil menunggu backend (Apps Script) yang kadang lambat. Data di sini SELALU
// diperbarui dari server begitu jawaban datang -- ini hanya untuk tampilan awal.
//
// Dihapus otomatis: saat ada perubahan data (lihat lib/api.js) dan saat halaman login
// dibuka (logout / sesi habis), jadi tidak tersisa untuk pengguna berikutnya.

const PREFIX = 'bk_cache_v1:';

export function readCache(name, maxAgeMs) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + name);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > maxAgeMs) return null;
    return parsed.data === undefined ? null : parsed.data;
  } catch {
    return null;
  }
}

export function writeCache(name, data) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + name, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Penyimpanan penuh / diblokir (mode privat): tidak masalah, cuma tidak ada cache.
  }
}

export function clearCache(name) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PREFIX + name);
  } catch {}
}

export function clearAllCache() {
  if (typeof window === 'undefined') return;
  try {
    const ls = window.localStorage;
    for (let i = ls.length - 1; i >= 0; i--) {
      const key = ls.key(i);
      if (key && key.startsWith(PREFIX)) ls.removeItem(key);
    }
  } catch {}
}
