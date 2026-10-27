import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import { clearAllCache } from '../lib/persistedCache';
import BeningLogo from '../components/brand/BeningLogo';
import HubDiagram from '../components/brand/HubDiagram';

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

// Halaman masuk: sesedikit mungkin tulisan. Panel merek menggambarkan Bening Hub sebagai super app (satu sumber
// air mengalir ke semua modul); panel masuk hanya berisi logo, satu baris "Super App", dan tombol Google.
export default function Login() {
  const router = useRouter();
  const { error } = router.query;
  const [loading, setLoading] = useState(false);

  // Halaman login = belum/tidak lagi login (keluar atau sesi habis). Buang data tersimpan di
  // browser supaya tidak terlihat oleh siapa pun yang login berikutnya di perangkat ini.
  useEffect(() => {
    clearAllCache();
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

  return (
    <>
      <Head>
        <title>Masuk - Bening Hub</title>
      </Head>
      <div className="min-h-screen flex flex-col lg:flex-row bg-canvas">
        {/* Panel merek: foto instalasi WTP + lapisan navy ("deep") di kedua tema, isinya ilustrasi saja. */}
        <section aria-hidden="true" className="relative overflow-hidden bg-deep lg:w-[56%] flex items-center justify-center px-6 pt-8 pb-6 sm:px-10 lg:p-14">
          <Image
            src="/wastewater-treatment-upd.webp"
            alt=""
            fill
            sizes="(min-width: 1024px) 56vw, 100vw"
            style={{ objectFit: 'cover', objectPosition: 'center' }}
            priority
            quality={70}
          />
          <div className="absolute inset-0 photo-veil" />
          <div className="absolute inset-0 grid-deep" />
          <div className="absolute inset-0 glow-air" />
          <HubDiagram className="relative w-full max-w-[640px] h-auto" />
        </section>

        {/* Panel masuk */}
        <main className="flex-1 flex flex-col px-6 pt-10 pb-8 sm:px-10 lg:px-16 lg:py-10">
          <div className="flex-1 flex items-start lg:items-center">
            <div className="w-full max-w-sm mx-auto lg:mx-0">
              <h1>
                <BeningLogo height={26} intro ambient />
              </h1>
              <p className="mt-5 text-base text-inkmute">Super App PT Bening Khatulistiwa</p>

              {errorMessage && (
                <div role="alert" className="mt-8 flex items-start gap-2.5 bg-rust/10 border border-rust/30 text-rust text-sm p-3 rounded-lg font-medium">
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
                className="mt-8 w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-line bg-panel text-ink text-sm font-semibold shadow-sm transition-[border-color,box-shadow,transform] duration-150 ease-standard hover:border-blueprint/60 hover:shadow-md active:translate-y-px disabled:opacity-60 disabled:cursor-wait"
              >
                <GoogleMark />
                {loading ? 'Mengalihkan ke Google...' : 'Masuk dengan Google'}
              </button>
              <p className="mt-3 text-xs text-inkmute">Khusus akun yang sudah didaftarkan admin.</p>
            </div>
          </div>
          <p className="text-xs text-inkmute text-center lg:text-left">© {new Date().getFullYear()} PT Bening Khatulistiwa</p>
        </main>
      </div>
    </>
  );
}
