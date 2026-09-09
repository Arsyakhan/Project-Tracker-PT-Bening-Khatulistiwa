import '../styles/globals.css';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const isLoginPage = router.pathname === '/login';

  const handleLogout = () => {
    // Paksa hapus cookie dan kembalikan ke halaman login
    document.cookie = "isLoggedIn=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-canvas">
      {!isLoginPage && (
        <header className="border-b border-line bg-panel">
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <Link href="/" className="font-display font-semibold text-lg text-ink">
              Bening Khatulistiwa <span className="text-blueprint">/ Project Tracker</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-5 text-sm">
              <Link href="/" className="text-inkmute hover:text-ink">Dashboard</Link>
              <Link href="/projects" className="text-inkmute hover:text-ink">Semua Project</Link>
              <Link href="/engineering-docs" className="text-inkmute hover:text-ink">Engineering Docs</Link>
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
  );
}
