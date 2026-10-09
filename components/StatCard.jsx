import Link from 'next/link';

// Kartu statistik.
// - Tanpa href/onClick : kartu biasa (hanya tampilan)
// - href               : tautan ke halaman lain
// - onClick            : tombol (mis. memilih tab); active = kartu sedang terpilih
export default function StatCard({ label, value, accent = 'rgb(var(--color-ink))', href, onClick, active = false, hint }) {
  const interactive = !!(href || onClick);

  const cls = [
    'bg-panel border rounded-lg p-5 flex flex-col gap-1 text-left w-full transition-all duration-150',
    active ? 'border-blueprint ring-1 ring-blueprint/40' : 'border-line',
    interactive
      ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-blueprint/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint'
      : '',
  ].join(' ');

  const content = (
    <>
      <span className="text-xs uppercase tracking-wide text-inkmute font-medium">{label}</span>
      <span className="text-3xl font-display font-semibold" style={{ color: accent }}>
        {value}
      </span>
      {hint && <span className="text-xs text-inkmute mt-0.5">{hint}</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
        {content}
      </button>
    );
  }
  return <div className={cls}>{content}</div>;
}
