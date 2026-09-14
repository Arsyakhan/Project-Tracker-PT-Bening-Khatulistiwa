import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image'; // Memanggil fitur kompresi pintar dari Next.js

export default function Login() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'admin123') {
      document.cookie = "isLoggedIn=true; path=/";
      router.push('/');
    } else {
      setError('Password salah! Silakan coba lagi.');
    }
  };

  return (
    <>
      <Head>
        <title>Login - Bening Khatulistiwa Tracker</title>
      </Head>
      <div className="min-h-screen flex bg-canvas">
        
        {/* Sisi Kiri: Gambar Background yang sudah dikompres otomatis oleh Next.js */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
          <Image 
            src="/wastewater-treatment-upd.webp"
            alt="Water Treatment Background"
            fill
            style={{ objectFit: 'cover', objectPosition: 'center' }}
            priority={true} // Perintah khusus agar gambar ini didownload paling pertama (anti lelet)
            quality={70} // Kompresi kualitas gambar ke 70% agar ukurannya jauh lebih kecil
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0C2D48] via-[#0C2D48]/60 to-transparent z-10"></div>
          
          <div className="relative z-20 flex flex-col justify-end p-12 text-white h-full w-full">
            <h1 className="font-display text-4xl font-bold mb-3 drop-shadow-md">Water Treatment Excellence</h1>
            <p className="text-white/90 text-lg max-w-md drop-shadow-md font-medium">
              Sistem manajemen terintegrasi untuk melacak progress fabrikasi, engineering, dan delivery project.
            </p>
          </div>
        </div>

        {/* Sisi Kanan: Form Login dengan Logo */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-20">
          <div className="w-full max-w-sm">
            <div className="text-center lg:text-left mb-8 flex flex-col items-center lg:items-start">
              <img src="/logo-bk2.png" alt="Logo PT Bening Khatulistiwa" className="h-10 w-auto mb-4 object-contain mix-blend-multiply" />
              <h2 className="font-display text-3xl font-bold text-ink">Project Tracker</h2>
              <p className="text-inkmute text-sm mt-1">Silakan masuk untuk melanjutkan</p>
            </div>
            
            {error && (
              <div className="bg-rust/10 text-rust text-sm p-3 rounded-md mb-5 text-center font-medium">
                {error}
              </div>
            )}
            
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Masukkan kata sandi..."
                  className="border border-line rounded-md px-4 py-3 pr-12 text-sm outline-none focus:border-blueprint w-full bg-panel"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-inkmute hover:text-blueprint focus:outline-none"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
              </div>
              <button
                type="submit"
                className="bg-blueprint hover:bg-blueprintdark text-white rounded-md py-3 text-sm font-medium transition-colors shadow-sm"
              >
                Masuk Portal
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
