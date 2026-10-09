import Link from 'next/link';
import { roleLabel } from '../lib/roles';

// Ikon garis 24x24 (gaya Heroicons outline). Satu path per ikon supaya daftar menu tetap ringkas.
function Icon({ d, className = 'w-[18px] h-[18px]', strokeWidth = 1.8 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const ICONS = {
  today: 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z',
  dashboard: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6',
  projects: 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
  board: 'M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z',
  eng: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  proc: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12',
  docs: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z',
  archive: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25M12 13.875V7.5M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  activity: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  plus: 'M12 4.5v15m7.5-7.5h-15',
  moon: 'M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z',
  logout: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75',
  close: 'M6 18L18 6M6 6l12 12',
};

// Dikelompokkan menurut cara PM bekerja: harian, mengelola project, lalu dokumen & arsip.
export const NAV_GROUPS = [
  {
    label: 'Harian',
    items: [
      { href: '/', label: 'Hari Ini', icon: 'today' },
      { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    ],
  },
  {
    label: 'Project',
    items: [
      { href: '/projects', label: 'Semua Project', icon: 'projects' },
      { href: '/board', label: 'Papan Kanban', icon: 'board' },
      { href: '/engineering-docs', label: 'Engineering Docs', icon: 'eng' },
      { href: '/procurement', label: 'Pengadaan', icon: 'proc' },
    ],
  },
  {
    label: 'Dokumen & Arsip',
    items: [
      { href: '/documents', label: 'Dokumen', icon: 'docs' },
      { href: '/arsip', label: 'Arsip', icon: 'archive' },
      { href: '/activity', label: 'Aktivitas', icon: 'activity' },
    ],
  },
];

// Inisial dua huruf dari email, dipakai kalau akun Google tidak punya foto.
function initials(email) {
  const name = String(email || '').split('@')[0].replace(/[^a-zA-Z]+/g, ' ').trim();
  if (!name) return '?';
  const parts = name.split(' ');
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

// pathname '/projects/[id]' juga menyalakan menu "Semua Project"; '/' hanya cocok persis.
function isCurrent(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({ pathname, session, recentProjects, isDark, onNavigate, onSearch, onToggleTheme, onLogout, onClose }) {
  const user = session?.user;
  const viewer = user?.role === 'viewer';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <Link href="/" onClick={onNavigate} className="flex items-center group" aria-label="Bening Hub, ke beranda">
          <img
            src="/logo-bening-hub-compact.png"
            alt="Bening Hub"
            className="h-9 w-auto object-contain flex-shrink-0 group-hover:opacity-80 transition-opacity dark:brightness-0 dark:invert"
          />
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Tutup menu" className="md:hidden p-2 -mr-2 rounded-md text-inkmute hover:bg-canvas hover:text-ink">
            <Icon d={ICONS.close} className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="px-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={onSearch}
          className="w-full flex items-center gap-2.5 px-3 h-10 rounded-lg border border-line bg-canvas hover:border-blueprint/50 text-inkmute text-sm transition-colors"
        >
          <Icon d={ICONS.search} className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
          <span className="flex-1 text-left">Cari project...</span>
          <kbd className="hidden md:inline text-[10px] font-data border border-line rounded px-1.5 py-0.5 bg-panel">Ctrl K</kbd>
        </button>

        <Link
          href="/projects/new"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 h-10 bg-blueprint hover:bg-blueprintdark text-onaccent font-medium text-sm rounded-lg shadow-sm transition-colors"
        >
          <Icon d={ICONS.plus} className="w-4 h-4" strokeWidth={2.5} />
          Project Baru
        </Link>
      </div>

      <nav aria-label="Menu utama" className="flex-1 overflow-y-auto px-3 pt-4 pb-2 flex flex-col gap-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <span className="px-3 pb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-inkmute">{group.label}</span>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isCurrent(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex items-center gap-3 px-3 h-10 rounded-lg text-sm transition-colors ${
                        active ? 'bg-blueprint/10 text-blueprint font-semibold' : 'text-inkmute font-medium hover:bg-canvas hover:text-ink'
                      }`}
                    >
                      {active && <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-blueprint" aria-hidden="true" />}
                      <Icon d={ICONS[item.icon]} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {recentProjects.length > 0 && (
          <div>
            <span className="px-3 pb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-inkmute">Terakhir dibuka</span>
            <ul className="flex flex-col gap-0.5">
              {recentProjects.map((p) => {
                const href = `/projects/${encodeURIComponent(p.id)}`;
                return (
                  <li key={p.id}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      title={p.projectName}
                      className="flex items-center gap-2.5 px-3 h-8 rounded-md text-xs text-inkmute hover:bg-canvas hover:text-ink transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blueprint/60 flex-shrink-0" aria-hidden="true" />
                      <span className="truncate">{p.projectName || p.poNumber}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>

      <div className="px-3 pt-3 pb-4 border-t border-line flex flex-col gap-2">
        {user?.email && (
          <div className="flex items-center gap-3 px-2.5 py-2 rounded-lg bg-canvas border border-line">
            {user.image ? (
              <img src={user.image} alt="" className="w-9 h-9 rounded-full flex-shrink-0 ring-2 ring-panel" />
            ) : (
              <span className="w-9 h-9 rounded-full flex-shrink-0 bg-blueprint text-onaccent text-xs font-semibold flex items-center justify-center" aria-hidden="true">
                {initials(user.email)}
              </span>
            )}
            <div className="min-w-0">
              <span className="block text-xs text-ink font-medium truncate" title={user.email}>{user.email}</span>
              {user.role && (
                <span className={`inline-block mt-0.5 text-[10px] leading-4 px-1.5 rounded ${viewer ? 'bg-amber/15 text-amberink font-semibold' : 'bg-blueprint/10 text-blueprint font-medium'}`}>
                  {roleLabel(user.role)}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-pressed={isDark}
            className="flex items-center justify-center gap-2 h-9 rounded-lg border border-line text-inkmute hover:bg-canvas hover:text-ink text-xs font-medium transition-colors"
          >
            <Icon d={isDark ? ICONS.today : ICONS.moon} className="w-4 h-4" />
            {isDark ? 'Terang' : 'Gelap'}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center justify-center gap-2 h-9 rounded-lg border border-line text-rust hover:bg-rust/10 hover:border-rust/30 text-xs font-medium transition-colors"
          >
            <Icon d={ICONS.logout} className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </div>
    </div>
  );
}
