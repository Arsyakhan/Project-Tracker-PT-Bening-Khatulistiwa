import { useEffect, useRef, useState } from 'react';

// Lapisan (dialog, menu geser) tetap terpasang selama animasi keluarnya, supaya keluar lewat jalur yang sama dengan
// saat masuk (kelas .layer-* dan .drawer di globals.css). Dibuka lagi di tengah animasi keluar = langsung berbalik
// dari posisi saat itu. Sesudah ditutup, fokus keyboard kembali ke tombol yang membukanya.
// Pakai: const { mounted, state } = useLayer(open, 200); if (!mounted) return null; ... data-state={state}
export default function useLayer(open, exitMs) {
  const [kept, setKept] = useState(open);
  const prevOpen = useRef(false);
  const returnFocus = useRef(null);

  // Dicatat saat render, sebelum autoFocus di dalam lapisan memindahkan fokus.
  if (open !== prevOpen.current) {
    if (open && typeof document !== 'undefined') returnFocus.current = document.activeElement;
    prevOpen.current = open;
  }

  useEffect(() => {
    if (open) {
      setKept(true);
      return undefined;
    }
    const el = returnFocus.current;
    returnFocus.current = null;
    // Tombol pembuka bisa saja sudah hilang (mis. baris yang baru dihapus); kalau begitu fokus dibiarkan.
    if (el && el !== document.body && el.isConnected && typeof el.focus === 'function') el.focus({ preventScroll: true });
    const t = setTimeout(() => setKept(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);

  return { mounted: open || kept, state: open ? 'open' : 'closed' };
}
