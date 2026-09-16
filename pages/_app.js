import '../styles/globals.css';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { SessionProvider, useSession, signOut } from 'next-auth/react';

function Shell({ Component, pageProps }) {
  const router = useRouter();
  const { data: session } = useSession();
  const isLoginPage = router.pathname === '/login';

  const handleLogout = () => {
    signOut({ callbackUrl: '/login' });
  };

  // Fungsi pintar untuk mendeteksi apakah URL saat ini sama dengan link menu
  const isActive = (path) => router.pathname === path;

  return (
    <>
      <Head>
        <link rel="icon" href="/logo-bk2.png" />
        <title>Project Tracker - Bening Khatulistiwa</title>
      </Head>
      <div className="min-h-screen bg-canvas">
        {!isLoginPage && (
          <header className="border-b border-line bg-panel sticky top-0 z-50 shadow-sm">
            {/* Mengubah max-w-6xl menjadi 7xl agar tabel di bawahnya punya ruang lebih lebar */}
            <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">

              {/* Bagian Logo */}
              <Link href="/" className="flex items-center gap-3 group">
                <img
                  src="/logo-bk2.png"
                  alt="Logo Bening Khatulistiwa"
                  className="h-8 w-auto object-contain mix-blend-multiply group-hover:opacity-80 transition-opacity"
                />
                <span className="font-display font-semibold text-lg text-blueprint border-l-2 border-line pl-3">
                  Project Tracker
                </span>
              </Link>

              {/* Navigasi Utama */}
              <nav className="flex flex-wrap items-center gap-1.5 text-sm">

                {/* Menu dengan deteksi Active State */}
                <Link
                  href="/"
                  className={`px-3 py-2 rounded-md font-medium transition-all duration-200 ${isActive('/') ? 'bg-blueprint/10 text-blueprint' : 'text-inkmute hover:bg-canvas hover:text-ink'}`}
                >
                  Dashboard
                </Link>

                <Link
                  href="/projects"
                  className={`px-3 py-2 rounded-md font-medium transition-all duration-200 ${isActive('/projects') ? 'bg-blueprint/10 text-blueprint' : 'text-inkmute hover:bg-canvas hover:text-ink'}`}
                >
                  Semua Project
                </Link>

                <Link
                  href="/engineering-docs"
                  className={`px-3 py-2 rounded-md font-medium transition-all duration-200 ${isActive('/engineering-docs') ? 'bg-blueprint/10 text-blueprint' : 'text-inkmute hover:bg-canvas hover:text-ink'}`}
                >
                  Engineering Docs
                </Link>

                {/* Garis Pembatas */}
                <div className="w-px h-5 bg-line mx-2 hidden md:block"></div>

                {/* Tombol Project Baru (Desain Solid Button dengan Ikon Plus) */}
                <Link
                  href="/projects/new"
                  className="flex items-center gap-1.5 px-4 py-2 bg-blueprint hover:bg-blueprintdark text-white font-medium rounded-md shadow-sm transition-all duration-200 mr-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Project Baru
                </Link>

                {/* Info user yang sedang login */}
                {session?.user?.email && (
                  <span className="hidden lg:flex items-center gap-2 px-3 py-2 text-inkmute text-xs">
                    {session.user.image && (
                      <img src={session.user.image} alt="" className="w-5 h-5 rounded-full" />
                    )}
                    {session.user.email}
                  </span>
                )}

                {/* Tombol Keluar (Desain Teks Merah dengan Ikon Logout) */}
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 text-rust hover:bg-rust/10 font-medium rounded-md transition-all duration-200 flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
                  Keluar
                </button>
              </nav>
            </div>
          </header>
        )}

        <main className={isLoginPage ? "" : "max-w-7xl mx-auto px-6 py-8"}>
          <Component {...pageProps} />
        </main>
      </div>
    </>
  );
}

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <Shell Component={Component} pageProps={pageProps} />
    </SessionProvider>
  );
}
