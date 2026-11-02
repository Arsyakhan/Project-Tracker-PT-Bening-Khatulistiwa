import { useRef } from 'react';
import useLayer from '../lib/useLayer';

const EXIT_MS = 320; // = --dur-slow
const SLOP = 10; // px: gerak sekecil ini masih dianggap ketukan atau awal gulir

// Titik henti yang diproyeksikan dari kecepatan lepas (perlambatan gulir iOS, laju 0,998): usapan cepat yang pendek
// tetap menutup menu, tarikan pelan yang dilepas di tengah kembali terbuka.
function projected(x, velocity) {
  return x + ((velocity / 1000) * 0.998) / (1 - 0.998);
}

// Tahanan di luar batas: makin jauh ditarik ke kanan, makin sedikit panel ikut.
function rubberband(over, size) {
  return (over * size * 0.55) / (size + 0.55 * Math.abs(over));
}

// Menu geser untuk HP dan tablet: masuk dari kiri dan keluar ke kiri lagi. Bisa ditutup dengan mengusap ke kiri di
// panel maupun di latar gelapnya; panel mengikuti jari 1:1 dan sesudah dilepas melanjutkan gerak dengan kecepatan jari.
export default function NavDrawer({ open, onClose, label, children }) {
  const { mounted, state } = useLayer(open, EXIT_MS);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const scrimRef = useRef(null);
  const drag = useRef(null);
  const swallowClick = useRef(false);

  if (!mounted) return null;

  function place(x, width) {
    panelRef.current.style.transform = `translateX(${x}px)`;
    scrimRef.current.style.opacity = String(Math.min(1, 1 + x / width));
  }

  function onPointerDown(e) {
    swallowClick.current = false;
    if (state !== 'open' || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, active: false, x: 0, samples: [] };
  }

  function onPointerMove(e) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.active) {
      const dx = e.clientX - d.x0;
      const dy = e.clientY - d.y0;
      if (Math.hypot(dx, dy) < SLOP) return;
      // Gerak tegak = menggulir daftar menu, bukan menutup
      if (Math.abs(dy) > Math.abs(dx)) {
        drag.current = null;
        return;
      }
      d.active = true;
      d.x0 = e.clientX; // mulai dari posisi sekarang supaya panel tidak melompat sejauh ambang
      d.width = panelRef.current.offsetWidth;
      rootRef.current.dataset.dragging = 'true';
      try {
        rootRef.current.setPointerCapture(e.pointerId); // tetap terlacak walau jari keluar dari panel
      } catch (err) {
        // pointer sudah tidak aktif; seretan tetap jalan selama jari di atas lapisan ini
      }
    }
    const raw = e.clientX - d.x0;
    d.x = raw > 0 ? rubberband(raw, d.width) : Math.max(raw, -d.width);
    d.samples.push({ x: d.x, t: e.timeStamp });
    while (d.samples.length > 2 && e.timeStamp - d.samples[0].t > 100) d.samples.shift();
    place(d.x, d.width);
  }

  function onPointerEnd(e) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.active) return;
    swallowClick.current = true; // usapan bukan ketukan: tautan dan latar di bawah jari tidak ikut terpicu

    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    // Jari yang sempat diam sebelum dilepas = kecepatan nol (keputusan dari posisi saja).
    const moving = e.type === 'pointerup' && e.timeStamp - last.t < 80 && last.t > first.t;
    const v = moving ? ((last.x - first.x) / (last.t - first.t)) * 1000 : 0;
    const close = projected(d.x, v) < -d.width / 2;
    // Kurva --ease-sheet mulai sekitar 2,25x kecepatan rata-ratanya, jadi durasi ini membuat panel melanjutkan
    // gerak dengan kecepatan jari, tanpa sambungan yang terasa antara diseret dan dianimasikan.
    const remaining = close ? d.width + d.x : Math.abs(d.x);
    const ms = Math.abs(v) > 50 ? Math.min(EXIT_MS, Math.max(120, (2.25 * remaining * 1000) / Math.abs(v))) : EXIT_MS;

    const panel = panelRef.current;
    const scrim = scrimRef.current;
    // Pastikan posisi jari terakhir sudah dihitung browser, supaya animasi mulai tepat dari sana.
    getComputedStyle(panel).transform; // eslint-disable-line no-unused-expressions
    panel.style.transitionDuration = `${Math.round(ms)}ms`;
    scrim.style.transitionDuration = `${Math.round(ms)}ms`;
    panel.style.transform = '';
    scrim.style.opacity = '';
    delete rootRef.current.dataset.dragging;
    setTimeout(() => {
      panel.style.transitionDuration = '';
      scrim.style.transitionDuration = '';
    }, ms);
    if (close) onClose();
  }

  function onClickCapture(e) {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-state={state}
      className="drawer lg:hidden fixed inset-0 z-40"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={onClickCapture}
    >
      <div ref={scrimRef} className="drawer-scrim absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} className="drawer-panel relative h-full w-72 max-w-[85vw] bg-panel border-r border-line shadow-xl">
        {children}
      </div>
    </div>
  );
}
