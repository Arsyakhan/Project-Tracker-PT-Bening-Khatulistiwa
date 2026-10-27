import Link from 'next/link';

// Kepala halaman yang sama di semua halaman kerja: (jejak navigasi) + judul + satu baris keterangan + tombol aksi.
// - crumbs  : [{ href, label }] jejak navigasi di atas judul (halaman detail)
// - title   : teks judul (h1) atau elemen (mis. judul yang bisa diedit)
// - meta    : satu baris keterangan singkat di bawah judul (angka, konteks)
// - actions : tombol di kanan (di HP turun ke bawah judul)
// - nav     : navigasi bagian (mis. tab Dokumen) di bawah judul
export default function PageHeader({ crumbs, eyebrow, title, meta, actions, nav, className = '' }) {
  return (
    <header className={`flex flex-col gap-4 ${className}`}>
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Jejak navigasi" className="flex items-center gap-1.5 text-xs text-inkmute min-w-0 -mb-1">
          {crumbs.map((c, i) => (
            <span key={`${c.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <span aria-hidden="true" className="text-line">/</span>}
              {c.href ? (
                <Link href={c.href} className="tap hover:text-blueprint transition-colors truncate">{c.label}</Link>
              ) : (
                <span aria-current="page" className="truncate">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="text-sm font-medium text-inkmute mb-1">{eyebrow}</p>}
          {typeof title === 'string' ? (
            <h1 className="font-display text-2xl sm:text-[28px] leading-tight font-semibold text-ink">{title}</h1>
          ) : (
            title
          )}
          {meta && <div className="text-sm text-inkmute mt-1.5 max-w-3xl">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0">{actions}</div>}
      </div>
      {nav}
    </header>
  );
}
