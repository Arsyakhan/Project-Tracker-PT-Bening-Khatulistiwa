import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';

export default function Login() {
  const router = useRouter();
  const { error } = router.query;

  const errorMessage =
    error === 'AccessDenied'
      ? 'Email Google kamu belum terdaftar untuk mengakses Project Tracker ini. Hubungi admin untuk didaftarkan.'
      : error
      ? 'Gagal login. Silakan coba lagi.'
      : '';

  return (
    <>
      <Head>
        <title>Login - Bening Khatulistiwa Tracker</title>
      </Head>
      <div className="min-h-screen flex bg-canvas">

        {/* Sisi Kiri: Gambar Background */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
          <Image
            src="/wastewater-treatment-upd.webp"
            alt="Water Treatment Background"
            fill
            style={{ objectFit: 'cover', objectPosition: 'center' }}
            priority={true}
            quality={70}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0C2D48] via-[#0C2D48]/60 to-transparent z-10"></div>

          <div className="relative z-20 flex flex-col justify-end p-12 text-white h-full w-full">
            <h1 className="font-display text-4xl font-bold mb-3 drop-shadow-md">Water Treatment Excellence</h1>
            <p className="text-white/90 text-lg max-w-md drop-shadow-md font-medium">
              Sistem manajemen terintegrasi untuk melacak progress fabrikasi, engineering, dan delivery project.
            </p>
          </div>
        </div>

        {/* Sisi Kanan: Login pakai Google */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-20">
          <div className="w-full max-w-sm">
            <div className="text-center lg:text-left mb-8 flex flex-col items-center lg:items-start">
              <img src="/logo-bk2.png" alt="Logo PT Bening Khatulistiwa" className="h-10 w-auto mb-4 object-contain mix-blend-multiply" />
              <h2 className="font-display text-3xl font-bold text-ink">Project Tracker</h2>
              <p className="text-inkmute text-sm mt-1">Masuk pakai akun Google yang terdaftar</p>
            </div>

            {errorMessage && (
              <div className="bg-rust/10 text-rust text-sm p-3 rounded-md mb-5 text-center font-medium">
                {errorMessage}
              </div>
            )}

            <button
              onClick={() => signIn('google', { callbackUrl: '/' })}
              className="w-full flex items-center justify-center gap-3 border border-line bg-white hover:bg-canvas text-ink rounded-md py-3 text-sm font-medium transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
              </svg>
              Masuk dengan Google
            </button>

            <p className="text-inkmute text-xs mt-5 text-center lg:text-left">
              Hanya email yang sudah didaftarkan admin yang bisa mengakses dashboard ini.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
