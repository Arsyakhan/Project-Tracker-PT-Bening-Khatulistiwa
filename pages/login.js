import { useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { clearAllCache } from '../lib/persistedCache';
import BeningLogo from '../components/brand/BeningLogo';
import WaterSurface from '../components/brand/WaterSurface';

function GoogleMark() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

// Halaman masuk. Seluruh latar = foto instalasi WTP yang dilihat dari balik permukaan air (WaterSurface, WebGL):
// beriak pelan, merespons kursor, dan menerima riak dari tetes logo yang jatuh saat intro. Teks sesedikit mungkin:
// logo, "Super App PT Bening Khatulistiwa", dan kartu masuk dengan tombol Google.
const LOGO_LANDS_MS = 430; // sama dengan akhir animasi bl-fall di globals.css

export default function Login() {
  const router = useRouter();
  const { error } = router.query;
  const [loading, setLoading] = useState(false);
  const waterRef = useRef(null);
  const brandRef = useRef(null);

  // Halaman login = belum/tidak lagi login (keluar atau sesi habis). Buang data tersimpan di
  // browser supaya tidak terlihat oleh siapa pun yang login berikutnya di perangkat ini.
  useEffect(() => {
    clearAllCache();
  }, []);

  // Saat tetes logo mendarat, riaknya menyebar ke permukaan air di belakangnya.
  useEffect(() => {
    const t = setTimeout(() => {
      const marks = brandRef.current ? brandRef.current.querySelectorAll('.bl-mark') : [];
      const mark = Array.from(marks).find((m) => m.getClientRects().length > 0);
      if (!mark || !waterRef.current) return;
      const r = mark.getBoundingClientRect();
      waterRef.current.drop(r.left + r.width / 2, r.bottom - r.height * 0.12, 1.4);
    }, LOGO_LANDS_MS);
    return () => clearTimeout(t);
  }, []);

  const errorMessage =
    error === 'AccessDenied'
      ? 'Email ini belum terdaftar di Bening Hub. Hubungi admin untuk didaftarkan.'
      : error
      ? 'Gagal masuk. Silakan coba lagi.'
      : '';

  function handleSignIn() {
    setLoading(true);
    signIn('google', { callbackUrl: '/' });
  }

  const year = new Date().getFullYear();

  return (
    <>
      <Head>
        <title>Masuk - Bening Hub</title>
      </Head>
      <div className="relative min-h-screen overflow-hidden water-base text-white">
        <WaterSurface ref={waterRef} src="/wastewater-treatment-upd.webp" />
        <div className="absolute inset-0 login-scrim" aria-hidden="true" />

        <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
          {/* Merek: kiri bawah di desktop, di atas kartu di HP */}
          <section ref={brandRef} className="flex-1 flex flex-col justify-end px-6 pt-24 pb-8 sm:px-12 lg:px-16 lg:pb-16">
            <h1 className="hidden lg:block">
              <BeningLogo height={46} intro className="text-white" />
            </h1>
            <h1 className="lg:hidden">
              <BeningLogo height={26} intro className="text-white" />
            </h1>
            <p className="login-sub mt-4 lg:mt-6 text-base lg:text-xl font-medium text-white/85">Super App PT Bening Khatulistiwa</p>
            <p className="hidden lg:block mt-14 text-xs text-white/60">© {year} PT Bening Khatulistiwa</p>
          </section>

          {/* Kartu masuk */}
          <main className="lg:w-[480px] flex items-end justify-center px-4 pb-6 sm:px-8 lg:pl-0 lg:pr-16 lg:pb-16">
            <div className="login-card w-full max-w-sm bg-panel text-ink rounded-2xl shadow-md ring-1 ring-black/5 dark:ring-white/10 p-6 sm:p-8">
              <h2 className="text-lg font-semibold">Masuk</h2>
              <p className="mt-1 text-sm text-inkmute">Gunakan akun Google yang sudah terdaftar.</p>

              {errorMessage && (
                <div role="alert" className="mt-5 flex items-start gap-2.5 bg-rust/10 border border-rust/30 text-rust text-sm p-3 rounded-lg font-medium">
                  <svg className="w-5 h-5 flex-shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSignIn}
                disabled={loading}
                className="mt-6 w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-line bg-panel text-ink text-sm font-semibold shadow-sm transition-[border-color,box-shadow,transform] duration-150 ease-standard hover:border-blueprint/60 hover:shadow-md active:translate-y-px disabled:opacity-60 disabled:cursor-wait"
              >
                <GoogleMark />
                {loading ? 'Mengalihkan ke Google...' : 'Masuk dengan Google'}
              </button>
              <p className="lg:hidden mt-5 text-xs text-inkmute text-center">© {year} PT Bening Khatulistiwa</p>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
