import '../styles/globals.css';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const isLoginPage = router.pathname === '/login';

  const handleLogout = () => {
    document.cookie = "isLoggedIn=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push('/login');
  };

  return (
    <>
      <Head>
        {/* Nama file logo sudah disesuaikan menjadi logo-bk2.png */}
        <link rel="icon" href="/logo-bk2.png" />
        <title>Project Tracker - Bening Khatulistiwa</title>
      </Head>
      <div className="min-h-screen bg-canvas">
        {!isLoginPage && (
          <header className="border-b border-line bg-panel sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              
              {/* Bagian Logo di Navbar */}
              <Link href="/" className="flex items-center gap-3 group">
                {/* Nama file logo sudah disesuaikan menjadi logo-bk2.png */}
                <img 
                  src="/logo-bk2.png" 
                  alt="Logo Bening Khatulistiwa" 
                  className="h-7 w-auto object-contain mix-blend-multiply group-hover:opacity-80 transition-opacity"
                />
                <span className="font-display font-medium text-lg text-blueprint border-l-2 border-line pl-3">
                  Project Tracker
                </span>
              </Link>

              <nav className="flex flex-wrap items-center gap-5 text-sm">
                <Link href="/" className="text-inkmute hover:text-ink transition-colors">Dashboard</Link>
                <Link href="/projects" className="text-inkmute hover:text-ink transition-colors">Semua Project</Link>
                <Link href="/engineering-docs" className="text-inkmute hover:text-ink transition-colors">Engineering Docs</Link>
                <Link href="/projects/new" className="text-blueprint font-medium hover:underline">+ Project Baru</Link>
                
                <div className="w-px h-4 bg-line hidden md:block"></div>
                
                <button onClick={handleLogout} className="text-rust font-medium hover:underline">
                  Keluar
                </button>
              </nav>
            </div>
          </header>
        )}
        
        <main className={isLoginPage ? "" : "max-w-6xl mx-auto px-6 py-8"}>
          <Component {...pageProps} />
        </main>
      </div>
    </>
  );
}
