import { useId } from 'react';
import BeningMark from './BeningMark';
import { WORDMARK_LETTERS, WORDMARK_RATIO, WORDMARK_VIEWBOX } from './wordmarkPaths';

// Logo lengkap: tetes air + wordmark BENING HUB (vektor, per huruf) + baris kecil opsional ("Super App").
// height = tinggi wordmark dalam px. Warna mengikuti kelas teks pembungkus (bawaan text-brand), jadi ikut tema.
//
// Gerak (motion graphic), semuanya CSS di styles/globals.css (bagian "Logo bergerak"):
// - intro: tetes jatuh, memercik (dua riak air), lalu terisi; huruf BENING HUB muncul satu per satu dari bawah
//   garis air; baris "Super App" menyusul. Sekitar 1,4 detik, sekali saat logo pertama kali tampil.
// - ambient: sesudahnya air di tetes tetap bergelombang pelan (dipakai di halaman masuk saja).
// - busy: tetes surut dan bergelombang selama pindah halaman (sidebar dan header HP).
// prefers-reduced-motion: semua langsung tampil utuh tanpa gerak.
export default function BeningLogo({
  height = 18,
  tagline,
  busy = false,
  intro = false,
  ambient = false,
  className = 'text-brand',
}) {
  const clipId = `wl${useId().replace(/:/g, '')}`;
  const markSize = Math.round(height * 2.1);
  const wordWidth = Math.round(height * WORDMARK_RATIO);
  return (
    <span className={`bl inline-flex items-center gap-2.5 ${intro ? 'bl-intro' : ''} ${className}`}>
      <span className="bl-mark relative inline-flex">
        <BeningMark size={markSize} busy={busy} fillOnMount={intro} ambient={ambient} />
        {intro && (
          <>
            <span className="bl-ripple" aria-hidden="true" />
            <span className="bl-ripple bl-ripple-2" aria-hidden="true" />
          </>
        )}
      </span>
      <span className="flex flex-col gap-1">
        <svg
          viewBox={WORDMARK_VIEWBOX}
          width={wordWidth}
          height={height}
          className="bl-word block overflow-visible"
          aria-hidden="true"
          focusable="false"
        >
          {/* Garis air: huruf yang masih di bawah garis ini tidak terlihat, jadi huruf tampak muncul dari air */}
          <clipPath id={clipId}>
            <rect x="-40" y="-200" width="2048" height="444" />
          </clipPath>
          <g clipPath={`url(#${clipId})`}>
            {WORDMARK_LETTERS.map((d, i) => (
              <path key={i} d={d} fill="currentColor" className="wm-letter" style={{ '--i': i }} />
            ))}
          </g>
        </svg>
        <span className="sr-only">Bening Hub</span>
        {tagline && <span className="bl-tagline text-xs font-medium text-inkmute leading-none">{tagline}</span>}
      </span>
    </span>
  );
}
