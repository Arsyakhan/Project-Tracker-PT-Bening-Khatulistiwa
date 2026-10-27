import Link from 'next/link';

// Pilihan bersegmen (tab ringan) dengan jumlah opsional. Dipakai untuk tab daftar di Dashboard, status di Pengadaan,
// tab detail project, dan bagian Dokumen.
// options: [{ key, label, count, href, tone }]  - href = tautan (navigasi), selain itu tombol (onChange)
// size: 'md' (bawaan) | 'sm'
export default function Segmented({ options, value, onChange, label, size = 'md', className = '', stretch = false }) {
  const h = size === 'sm' ? 'h-8 max-md:h-10 px-3 text-[13px]' : 'h-9 max-md:h-10 px-3.5 text-sm';
  return (
    <div
      role={options.some((o) => o.href) ? undefined : 'group'}
      aria-label={label}
      className={`inline-flex max-w-full items-center gap-0.5 p-0.5 rounded-lg bg-line/50 border border-line overflow-x-auto ${stretch ? 'w-full' : ''} ${className}`}
    >
      {options.map((o) => {
        const active = o.key === value;
        const cls = `${h} ${stretch ? 'flex-1 justify-center' : ''} inline-flex items-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors ${
          active ? 'bg-panel text-ink shadow-sm' : 'text-inkmute hover:text-ink'
        }`;
        const count = o.count !== undefined && o.count !== null && (
          <span
            className={`font-data tnum text-xs leading-5 rounded px-1.5 ${
              o.tone === 'rust' && o.count > 0 ? 'bg-rust/10 text-rust' : active ? 'bg-canvas text-inkmute' : 'text-inkmute'
            }`}
          >
            {o.count}
          </span>
        );
        if (o.href) {
          return (
            <Link key={o.key} href={o.href} aria-current={active ? 'page' : undefined} className={cls}>
              {o.label}
              {count}
            </Link>
          );
        }
        return (
          <button key={o.key} type="button" aria-pressed={active} onClick={() => onChange && onChange(o.key)} className={cls}>
            {o.label}
            {count}
          </button>
        );
      })}
    </div>
  );
}
