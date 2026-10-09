import { useEffect, useState } from 'react';
import '../styles/globals.css';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { SessionProvider, useSession, signOut } from 'next-auth/react';
import { ToastProvider } from '../components/Toast';
import CommandPalette from '../components/CommandPalette';
import TopLoadingBar from '../components/TopLoadingBar';
import { setStoredTheme } from '../lib/theme';
import { getRecentProjects } from '../lib/recentlyViewed';
import Sidebar from '../components/Sidebar';

function Shell({ Component, pageProps }) {
  const router = useRouter();
  const { data: session } = useSession();
  const isLoginPage = router.pathname === '/login';
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [recentProjects, setRecentProjects] = useState([]);

  useEffect(() => {
    if (isLoginPage) return;
    function handleShortcut(e) {
      const isK = e.key === 'k' || e.key === 'K';
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [isLoginPage]);

  // Sinkronkan status ikon dark mode dengan class yang sudah diterapkan _document.js
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  // Panel menu di HP: Esc menutupnya, dan halaman di belakangnya tidak ikut tergulir.
  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setMobileNavOpen(false);
    }
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileNavOpen]);

  function toggleTheme() {
    const next = isDark ? 'light' : 'dark';
    setStoredTheme(next);
    setIsDark(next === 'dark');
  }

  // Recently viewed: baca dari localStorage, refresh tiap ada project baru dibuka
  useEffect(() => {
    function refresh() {
      setRecentProjects(getRecentProjects());
    }
    refresh();
    window.addEventListener('recentProjectsUpdated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('recentProjectsUpdated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const handleLogout = () => {
    signOut({ callbackUrl: '/login' });
  };

  const closeNav = () => setMobileNavOpen(false);
  const sidebarContent = (onClose) => (
    <Sidebar
      pathname={router.pathname}
      session={session}
      recentProjects={recentProjects}
      isDark={isDark}
      onNavigate={closeNav}
      onSearch={() => { closeNav(); setPaletteOpen(true); }}
      onToggleTheme={toggleTheme}
      onLogout={handleLogout}
      onClose={onClose}
    />
  );

  return (
    <>
      <Head>
        <link rel="icon" href="/favicon-32.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0C2D48" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Bening Hub" />
        <title>Bening Hub - Bening Khatulistiwa</title>
      </Head>

      <a href="#konten" className="skip-link">Lompat ke konten</a>
      <TopLoadingBar />
      {!isLoginPage && <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />}

      {isLoginPage ? (
        <Component {...pageProps} />
      ) : (
        <div className="min-h-screen bg-canvas md:flex">
          {/* Sidebar - desktop: selalu tampil & fixed; mobile: panel geser dari kiri */}
          <aside className="hidden md:flex md:flex-col md:w-64 md:flex-shrink-0 md:fixed md:inset-y-0 md:left-0 bg-panel border-r border-line z-30">
            {sidebarContent()}
          </aside>

          {mobileNavOpen && (
            <div role="dialog" aria-modal="true" aria-label="Menu navigasi" className="md:hidden fixed inset-0 z-40 flex">
              <div className="w-72 max-w-[85vw] bg-panel border-r border-line shadow-xl">{sidebarContent(closeNav)}</div>
              <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
            </div>
          )}

          {/* Top bar mobile - cuma logo + tombol hamburger */}
          <header className="md:hidden sticky top-0 z-20 bg-panel border-b border-line flex items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center py-1.5 -my-1.5">
              <img src="/logo-bening-hub-compact.png" alt="Bening Hub" className="h-7 w-auto object-contain dark:brightness-0 dark:invert" />
            </Link>
            <button onClick={() => setMobileNavOpen(true)} className="p-2 text-ink" aria-label="Buka menu">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </header>

          <main id="konten" tabIndex={-1} className="flex-1 md:pl-64 min-w-0 outline-none">
            <div className="max-w-6xl mx-auto px-5 py-6 md:px-10 md:py-10">
              {session?.user?.role === 'viewer' && (
                <div role="status" className="mb-6 flex items-start gap-3 bg-amber/10 border border-amber/30 border-l-4 border-l-amber rounded-lg px-4 py-3 text-sm text-ink">
                  <svg className="w-5 h-5 text-amberink shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span><b>Mode lihat saja.</b> Akun Anda berstatus Viewer, jadi perubahan tidak akan tersimpan. Hubungi admin kalau perlu akses ubah.</span>
                </div>
              )}
              <Component {...pageProps} />
            </div>
          </main>
        </div>
      )}
    </>
  );
}

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <ToastProvider>
        <Shell Component={Component} pageProps={pageProps} />
      </ToastProvider>
    </SessionProvider>
  );
}
