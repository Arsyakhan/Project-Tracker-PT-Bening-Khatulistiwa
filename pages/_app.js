import { useState } from 'react';
import '../styles/globals.css';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { SessionProvider, useSession, signOut } from 'next-auth/react';
import { ToastProvider } from '../components/Toast';

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    href: '/projects',
    label: 'Semua Project',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    href: '/engineering-docs',
    label: 'Engineering Docs',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    href: '/activity',
    label: 'Aktivitas',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

function Shell({ Component, pageProps }) {
  const router = useRouter();
  const { data: session } = useSession();
  const isLoginPage = router.pathname === '/login';
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleLogout = () => {
    signOut({ callbackUrl: '/login' });
  };

  const isActive = (path) => router.pathname === path;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <Link
        href="/"
        className="flex items-center gap-2.5 px-5 py-5 border-b border-line group"
        onClick={() => setMobileNavOpen(false)}
      >
        <img
          src="/logo-bk2.png"
          alt="Logo Bening Khatulistiwa"
          className="h-8 w-8 object-contain mix-blend-multiply flex-shrink-0 group-hover:opacity-80 transition-opacity"
        />
        <span className="font-display font-bold text-[15px] text-blueprint leading-none whitespace-nowrap tracking-tight">
          Project Tracker
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5 px-3 pt-4 flex-1">
        <span className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-inkmute/60">Menu</span>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileNavOpen(false)}
            className={`flex items-center gap-3 pl-3 pr-3 py-2.5 border-l-[3px] font-medium text-sm transition-all duration-150 ${
              isActive(item.href)
                ? 'border-blueprint bg-blueprint/[0.06] text-blueprint'
                : 'border-transparent text-inkmute hover:bg-canvas hover:text-ink'
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}

        <Link
          href="/projects/new"
          onClick={() => setMobileNavOpen(false)}
          className="flex items-center justify-center gap-2 px-3 py-2.5 mt-4 mx-1 bg-blueprint hover:bg-blueprintdark text-white font-medium text-sm rounded-lg shadow-sm transition-all duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Project Baru
        </Link>
      </nav>

      <div className="px-3 py-4 border-t border-line flex flex-col gap-2">
        {session?.user?.email && (
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-canvas border border-line/60">
            {session.user.image && (
              <img src={session.user.image} alt="" className="w-7 h-7 rounded-full flex-shrink-0 ring-2 ring-white" />
            )}
            <span className="text-xs text-ink font-medium truncate">{session.user.email}</span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 text-rust hover:bg-rust/10 font-medium text-sm rounded-lg transition-all duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          Keluar
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Head>
        <link rel="icon" href="/logo-bk2.png" />
        <title>Project Tracker - Bening Khatulistiwa</title>
      </Head>

      {isLoginPage ? (
        <Component {...pageProps} />
      ) : (
        <div className="min-h-screen bg-canvas md:flex">
          {/* Sidebar - desktop: selalu tampil & fixed; mobile: panel geser dari kiri */}
          <aside className="hidden md:flex md:flex-col md:w-60 md:flex-shrink-0 md:fixed md:inset-y-0 md:left-0 bg-panel border-r border-line shadow-[1px_0_6px_-2px_rgba(12,45,72,0.08)] z-30">
            {sidebarContent}
          </aside>

          {mobileNavOpen && (
            <div className="md:hidden fixed inset-0 z-40 flex">
              <div className="w-64 bg-panel border-r border-line shadow-xl">{sidebarContent}</div>
              <div className="flex-1 bg-ink/40 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
            </div>
          )}

          {/* Top bar mobile - cuma logo + tombol hamburger */}
          <header className="md:hidden sticky top-0 z-20 bg-panel border-b border-line flex items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo-bk2.png" alt="Logo" className="h-7 w-auto object-contain mix-blend-multiply" />
              <span className="font-display font-bold text-blueprint text-[15px] tracking-tight">Project Tracker</span>
            </Link>
            <button onClick={() => setMobileNavOpen(true)} className="p-2 text-ink" aria-label="Buka menu">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </header>

          <main className="flex-1 md:pl-60 min-w-0">
            <div className="max-w-6xl mx-auto px-5 py-6 md:px-10 md:py-10">
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
