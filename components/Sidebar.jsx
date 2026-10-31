import Link from 'next/link';
import { roleLabel } from '../lib/roles';
import BeningLogo from './brand/BeningLogo';
import useRouteBusy from '../lib/useRouteBusy';

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
  doc: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  proc: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12',
  archive: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25M12 13.875V7.5M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  bom: 'M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122',
  usulan: 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z',
  katalog: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9',
  opname: 'M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75',
  activity: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  meeting: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  plus: 'M12 4.5v15m7.5-7.5h-15',
  moon: 'M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z',
  logout: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75',
  close: 'M6 18L18 6M6 6l12 12',
};

// Dikelompokkan mengikuti alur kerja: pekerjaan harian, menjalankan project, material & gudang, lalu referensi.
// Aktivitas (log perubahan, untuk audit) ada di bagian bawah, bukan di daftar utama.
export const NAV_GROUPS = [
  {
    label: 'Harian',
    items: [
      { href: '/', label: 'Hari Ini', icon: 'today' },
      { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { href: '/meetings', label: 'Rapat', icon: 'meeting' },
    ],
  },
  {
    label: 'Project',
    items: [
      { href: '/projects', label: 'Project', icon: 'projects' },
      { href: '/documents', label: 'Dokumen', icon: 'doc' },
    ],
  },
  {
    label: 'Material & Gudang',
    items: [
      { href: '/gudang/bom', label: 'BOM Project', icon: 'bom' },
      { href: '/gudang/usulan', label: 'Usulan Pembelian', icon: 'usulan' },
      { href: '/procurement', label: 'Pengadaan', icon: 'proc' },
      { href: '/gudang/katalog', label: 'Katalog Barang', icon: 'katalog' },
      // Stok Gudang = Stock opname + Serah terima (tab di halamannya)
      { href: '/gudang/opname', label: 'Stok Gudang', icon: 'opname', match: ['/gudang/serah-terima'] },
    ],
  },
  {
    label: 'Referensi',
    items: [{ href: '/arsip', label: 'Arsip', icon: 'archive' }],
  },
];

export const NAV_FOOTER = [{ href: '/activity', label: 'Aktivitas', icon: 'activity' }];

// Inisial dua huruf dari email, dipakai kalau akun Google tidak punya foto.
function initials(email) {
  const name = String(email || '').split('@')[0].replace(/[^a-zA-Z]+/g, ' ').trim();
  if (!name) return '?';
  const parts = name.split(' ');
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

// pathname '/projects/[id]' dan '/projects/kanban' juga menyalakan menu "Project"; '/' hanya cocok persis.
function isCurrent(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({ item, active, onNavigate }) {
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={`relative flex items-center gap-3 px-3 h-9 max-lg:h-10 rounded-lg text-sm transition-colors ${
          active ? 'bg-blueprint/10 text-blueprint font-semibold' : 'text-inkmute font-medium hover:bg-canvas hover:text-ink'
        }`}
      >
        {active && <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-blueprint" aria-hidden="true" />}
        <Icon d={ICONS[item.icon]} />
        {item.label}
      </Link>
    </li>
  );
}

export default function Sidebar({ pathname, session, recentProjects, isDark, onNavigate, onSearch, onToggleTheme, onLogout, onClose }) {
  const user = session?.user;
  const viewer = user?.role === 'viewer';
  const busy = useRouteBusy();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        {/* Logo bergerak: tetesnya surut dan bergelombang selama halaman dimuat (useRouteBusy) */}
        <Link href="/" onClick={onNavigate} className="flex items-center -m-1 p-1 rounded-lg" aria-label="Bening Hub, ke beranda">
          <BeningLogo height={15} tagline="Super App" busy={busy} intro />
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Tutup menu" autoFocus className="lg:hidden p-2.5 -mr-2.5 rounded-md text-inkmute hover:bg-canvas hover:text-ink">
            <Icon d={ICONS.close} className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Cari + Project baru dalam satu baris, supaya menu muat di layar laptop 768 px (tombol besar "Project baru" ada di
          kepala halaman Hari Ini dan Project). */}
      <div className="px-3 flex gap-2">
        <button
          type="button"
          onClick={onSearch}
          className="flex-1 min-w-0 flex items-center gap-2 px-2.5 h-9 max-lg:h-10 rounded-lg border border-line bg-canvas hover:border-blueprint/50 text-inkmute text-[13px] transition-colors"
        >
          <Icon d={ICONS.search} className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
          <span className="flex-1 text-left truncate">Cari project</span>
          <kbd className="hidden lg:inline text-[10px] font-data border border-line rounded px-1.5 py-0.5 bg-panel">Ctrl K</kbd>
        </button>
        <Link
          href="/projects/new"
          onClick={onNavigate}
          aria-label="Project baru"
          title="Project baru"
          className="flex-shrink-0 flex items-center justify-center w-9 h-9 max-lg:w-10 max-lg:h-10 bg-blueprint hover:bg-blueprintdark text-onaccent rounded-lg shadow-sm transition-colors"
        >
          <Icon d={ICONS.plus} className="w-4 h-4" strokeWidth={2.5} />
        </Link>
      </div>

      <nav aria-label="Menu utama" className="scroll-shadow flex-1 overflow-y-auto px-3 pt-3 pb-2 flex flex-col gap-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <span className="px-3 pb-1 block text-xs font-semibold text-inkmute">{group.label}</span>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavItem key={item.href} item={item} active={isCurrent(pathname, item.href) || (item.match || []).some((h) => isCurrent(pathname, h))} onNavigate={onNavigate} />
              ))}
            </ul>
          </div>
        ))}

        {recentProjects.length > 0 && (
          <div>
            <span className="px-3 pb-1 block text-xs font-semibold text-inkmute">Terakhir dibuka</span>
            <ul className="flex flex-col gap-0.5">
              {recentProjects.map((p) => {
                const href = `/projects/${encodeURIComponent(p.id)}`;
                return (
                  <li key={p.id}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      title={p.projectName}
                      className="flex items-center gap-2.5 px-3 h-8 max-lg:h-10 rounded-md text-xs max-lg:text-sm text-inkmute hover:bg-canvas hover:text-ink transition-colors"
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

      {/* Akun, tema, dan keluar dalam satu baris (hemat tinggi supaya semua menu muat di layar laptop). */}
      <div className="px-3 pt-2 pb-3 border-t border-line flex flex-col gap-2">
        <ul aria-label="Menu lainnya" className="flex flex-col gap-0.5">
          {NAV_FOOTER.map((item) => (
            <NavItem key={item.href} item={item} active={isCurrent(pathname, item.href) || (item.match || []).some((h) => isCurrent(pathname, h))} onNavigate={onNavigate} />
          ))}
        </ul>
        <div className="flex items-center gap-2 pl-2 pr-1 py-1.5 rounded-lg bg-canvas border border-line">
          {user?.image ? (
            <img src={user.image} alt="" className="w-8 h-8 rounded-full flex-shrink-0 ring-2 ring-panel" />
          ) : (
            <span className="w-8 h-8 rounded-full flex-shrink-0 bg-blueprint text-onaccent text-xs font-semibold flex items-center justify-center" aria-hidden="true">
              {initials(user?.email)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <span className="block text-xs text-ink font-medium truncate" title={user?.email}>{user?.email || 'Belum masuk'}</span>
            {user?.role && (
              <span className={`inline-block mt-0.5 text-xs leading-4 px-1.5 rounded ${viewer ? 'bg-amber/15 text-amberink font-semibold' : 'bg-blueprint/10 text-blueprint font-medium'}`}>
                {roleLabel(user.role)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-pressed={isDark}
            aria-label={isDark ? 'Pakai tema terang' : 'Pakai tema gelap'}
            title={isDark ? 'Tema terang' : 'Tema gelap'}
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 max-lg:w-10 max-lg:h-10 rounded-md text-inkmute hover:bg-panel hover:text-ink transition-colors"
          >
            <Icon d={isDark ? ICONS.today : ICONS.moon} className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Keluar"
            title="Keluar"
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 max-lg:w-10 max-lg:h-10 rounded-md text-rust hover:bg-rust/10 transition-colors"
          >
            <Icon d={ICONS.logout} className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
