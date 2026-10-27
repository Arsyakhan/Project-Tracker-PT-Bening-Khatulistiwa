import { useEffect, useId, useState } from 'react';

// Tetes air Bening Hub, digambar ulang dari logo (public/logo-bening-hub*.png) sebagai SVG supaya bisa bergerak.
// Geometri mengikuti logo asli (dicek per baris piksel): ujung di tengah atas, sisi lurus yang menyinggung
// lingkaran r=70 di bawah, dan tiga sorot cahaya yang di logo berupa lubang (di sini: mask).
//
// Satu-satunya gerak di logo adalah AIR: isi tetes naik-turun dengan permukaan bergelombang.
// - level 1 (bawaan) = penuh, sama persis dengan logo statis.
// - busy  = sedang memuat (mis. pindah halaman): air turun ke setengah dan bergelombang, lalu penuh lagi.
// - fillOnMount = tetes terisi dari kosong saat pertama tampil (dipakai di halaman login).
// Warna = currentColor (atur dengan kelas teks, mis. text-brand). Gerak dimatikan oleh prefers-reduced-motion.

export const DROP_W = 140;
export const DROP_H = 198;
export const DROP_PATH = 'M70 0 L128.6 89.7 A70 70 0 1 1 11.4 89.7 Z';
const HIGHLIGHTS = [
  'M89 57 Q101 71 100.5 92',  // sorot kanan atas
  'M33 120 Q20 145 30.5 169', // sorot kiri bawah
  'M120 131 Q119 156 101 170', // sorot kanan bawah
];

// Gelombang selebar 3x tetes dengan periode 70: digeser 70 satuan = mulus berulang.
function wavePath(amp, phase = 0) {
  let d = `M${-140 + phase} 0`;
  for (let x = -140; x < 280; x += 35) {
    const up = ((x + 140) / 35) % 2 === 0;
    d += ` Q${x + 17.5 + phase} ${up ? -amp : amp} ${x + 35 + phase} 0`;
  }
  return `${d} L${280 + phase} 240 L${-140 + phase} 240 Z`;
}
const WAVE_FRONT = wavePath(7);
const WAVE_BACK = wavePath(9, -17.5);

// Posisi permukaan air (satuan SVG) untuk level 0..1. Penuh = di atas ujung tetes, jadi gelombang tidak terlihat.
function surfaceY(level) {
  const l = Math.max(0, Math.min(1, level));
  return DROP_H + 12 - l * (DROP_H + 26);
}

// Isi tetes sebagai <g>, supaya bisa dipasang di dalam SVG lain (diagram hub di halaman login).
export function MarkGraphic({ level = 1, live = false, idPrefix, emptyOpacity = 0.16, backWaveClass = 'bm-wave-back' }) {
  const clipId = `${idPrefix}-clip`;
  const maskId = `${idPrefix}-mask`;
  return (
    <g className="bm" data-live={live ? 'true' : 'false'}>
      <defs>
        <clipPath id={clipId}>
          <path d={DROP_PATH} />
        </clipPath>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={DROP_W} height={DROP_H}>
          <rect width={DROP_W} height={DROP_H} fill="white" />
          {HIGHLIGHTS.map((d) => (
            <path key={d} d={d} fill="none" stroke="black" strokeWidth="12" strokeLinecap="round" />
          ))}
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        <path d={DROP_PATH} fill="currentColor" fillOpacity={emptyOpacity} />
        <g clipPath={`url(#${clipId})`}>
          <g className="bm-water" style={{ transform: `translateY(${surfaceY(level)}px)` }}>
            <path className={backWaveClass} d={WAVE_BACK} fill="currentColor" fillOpacity="0.45" />
            <path className="bm-wave-front" d={WAVE_FRONT} fill="currentColor" />
          </g>
        </g>
      </g>
    </g>
  );
}

export default function BeningMark({ size = 32, busy = false, fillOnMount = false, ambient = false, title, className = '' }) {
  const uid = `bm${useId().replace(/:/g, '')}`;
  const [filled, setFilled] = useState(!fillOnMount);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (!fillOnMount) return undefined;
    // Dua frame: pastikan keadaan kosong sempat tergambar dulu, baru transisi ke penuh berjalan.
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setFilled(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [fillOnMount]);

  // ambient: air sedikit di bawah penuh supaya permukaannya yang bergelombang terlihat (logo "hidup").
  const level = !filled ? 0 : busy ? 0.5 : hover || ambient ? 0.86 : 1;

  // Gelombang hanya bergerak selama air tidak penuh, ditambah sebentar sesudahnya sampai air selesai naik.
  // Saat diam (penuh) animasinya berhenti, jadi logo di sidebar tidak menggambar ulang terus-menerus.
  const [settling, setSettling] = useState(false);
  useEffect(() => {
    if (level < 1) return undefined;
    setSettling(true);
    const t = setTimeout(() => setSettling(false), fillOnMount ? 1600 : 1000);
    return () => clearTimeout(t);
  }, [level, fillOnMount]);
  const live = ambient || level < 1 || settling;

  return (
    <svg
      viewBox={`0 0 ${DROP_W} ${DROP_H}`}
      width={(size * DROP_W) / DROP_H}
      height={size}
      className={`bm-root ${fillOnMount ? 'bm-slow' : ''} ${className}`}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      focusable="false"
    >
      <MarkGraphic level={level} live={live} idPrefix={uid} />
    </svg>
  );
}
