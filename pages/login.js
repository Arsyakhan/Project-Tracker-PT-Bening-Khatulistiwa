import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import { clearAllCache } from '../lib/persistedCache';
import { STAGES } from '../lib/stages';

const DIVISIONS = ['Marketing & Direksi', 'Engineering', 'Warehouse & Purchasing', 'Technician'];

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

// Jalur 12 tahap project, dari PO sampai Hand Over. Murni hiasan: menggambarkan apa yang dilacak aplikasi.
function StageTrack() {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Alur project dari PO sampai Hand Over">
      {STAGES.map((s, i) => (
        <li
          key={s}
          title={s}
          className={`h-1.5 flex-1 rounded-full ${i < 7 ? 'bg-white' : 'bg-white/30'}`}
        />
      ))}
    </ol>
  );
}

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
      ? 'Email Google kamu belum terdaftar untuk mengakses Bening Hub ini. Hubungi admin untuk didaftarkan.'
      : error
      ? 'Gagal login. Silakan coba lagi.'
      : '';

  function handleSignIn() {
    setLoading(true);
    signIn('google', { callbackUrl: '/' });
  }

  return (
    <>
      <Head>
        <title>Login - Bening Hub</title>
      </Head>
      <div className="min-h-screen flex bg-canvas">
        {/* Panel merek. Latarnya selalu biru tua (foto + lapisan), jadi teksnya putih tetap di kedua tema. */}
        <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-[#0C2D48]">
          <Image
            src="/wastewater-treatment-upd.webp"
            alt=""
            fill
            sizes="55vw"
            style={{ objectFit: 'cover', objectPosition: 'center' }}
            priority
            quality={70}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0C2D48]/95 via-[#0C2D48]/75 to-[#0C2D48]/95" />
          <div className="absolute inset-0 bp-grid opacity-40" aria-hidden="true" />

          <div className="relative z-10 flex flex-col justify-between h-full w-full p-12 xl:p-16 text-white">
            <img src="/logo-bening-hub-compact.png" alt="Bening Hub" className="h-10 w-auto self-start object-contain brightness-0 invert" />

            <div className="max-w-lg">
              <p className="font-data text-xs uppercase tracking-[0.2em] text-white/80 mb-4">PT Bening Khatulistiwa</p>
              <h1 className="font-display text-4xl xl:text-5xl font-bold leading-tight">
                Satu tempat untuk melihat posisi setiap project.
              </h1>
              <p className="text-white/85 text-base xl:text-lg mt-4 leading-relaxed">
                Dari PO sampai Hand Over: status, tenggat, dan siapa yang memegang bola, tanpa tanya satu per satu.
              </p>

              <div className="mt-8">
                <StageTrack />
                <div className="flex justify-between font-data text-xs text-white/80 mt-2">
                  <span>PO</span>
                  <span>Fabrikasi</span>
                  <span>Hand Over</span>
                </div>
              </div>
            </div>

            <ul className="flex flex-wrap gap-2" aria-label="Divisi pengguna">
              {DIVISIONS.map((d) => (
                <li key={d} className="text-xs font-medium rounded-full border border-white/30 bg-white/10 px-3 py-1.5">{d}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Panel masuk */}
        <main className="w-full lg:w-[45%] flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm">
            <img
              src="/logo-bening-hub-compact.png"
              alt="Bening Hub"
              className="h-10 w-auto object-contain mb-10 lg:hidden dark:brightness-0 dark:invert"
            />

            <h2 className="font-display text-3xl font-bold text-ink">Selamat datang</h2>
            <p className="text-inkmute text-sm mt-2">Masuk dengan akun Google kantor yang sudah didaftarkan untuk membuka Bening Hub.</p>

            {errorMessage && (
              <div role="alert" className="mt-6 flex items-start gap-2.5 bg-rust/10 border border-rust/30 text-rust text-sm p-3 rounded-lg font-medium">
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
              className="mt-6 w-full flex items-center justify-center gap-3 h-12 rounded-lg border border-line bg-panel hover:border-blueprint hover:shadow-md text-ink text-sm font-semibold transition-all shadow-sm disabled:opacity-60 disabled:cursor-wait"
            >
              <GoogleMark />
              {loading ? 'Mengalihkan ke Google...' : 'Masuk dengan Google'}
            </button>

            <div className="mt-8 rounded-lg border border-line bg-panel px-4 py-3 flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 text-blueprint mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <p className="text-xs text-inkmute leading-relaxed">
                Akses dibatasi. Hanya email yang didaftarkan admin yang bisa masuk. Kalau ditolak, hubungi Project Manager.
              </p>
            </div>

            <p className="text-xs text-inkmute mt-8 text-center lg:text-left">© PT Bening Khatulistiwa</p>
          </div>
        </main>
      </div>
    </>
  );
}
