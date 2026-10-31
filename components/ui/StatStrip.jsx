import Link from 'next/link';

// Satu panel angka kunci yang dipisah garis rambut (seperti layar panel kontrol), dipakai di Hari Ini, Dashboard,
// Pengadaan, Notulensi, dan Arsip. Warna hanya pada titik status dan angka yang memang berarti (terlambat, selesai).
// items: [{ key, label, value, tone, hint, onClick, href, active, dim }]
//   tone: 'rust' | 'amber' | 'teal' | 'blueprint' | 'ink' | 'muted'
const TONE = {
  rust: { dot: 'bg-rust', text: 'text-rust' },
  amber: { dot: 'bg-amber', text: 'text-amberink' },
  teal: { dot: 'bg-teal', text: 'text-teal' },
  blueprint: { dot: 'bg-blueprint', text: 'text-blueprint' },
  ink: { dot: 'bg-ink', text: 'text-ink' },
  muted: { dot: 'bg-inkmute', text: 'text-ink' },
};

const COLS = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 lg:grid-cols-5',
};
// Jumlah ganjil di HP: kotak terakhir dibuat selebar dua kolom supaya tidak ada sel kosong.
const LAST_SPAN = { 3: 'max-sm:col-span-2', 5: 'max-lg:col-span-2' };

export default function StatStrip({ items, label = 'Ringkasan', className = '' }) {
  const n = items.length;
  return (
    <dl
      aria-label={label}
      className={`grid ${COLS[n] || COLS[4]} bg-panel border border-line rounded-xl shadow-sm overflow-hidden ${className}`}
      style={{ gap: 1, background: 'rgb(var(--color-line))' }}
    >
      {items.map((it, idx) => {
        const t = TONE[it.tone] || TONE.ink;
        const span = idx === n - 1 ? LAST_SPAN[n] || '' : '';
        const body = (
          <>
            <dt className="flex items-center gap-2 text-xs font-medium text-inkmute">
              <span className={`w-2 h-2 rounded-full shrink-0 ${t.dot} ${it.dim ? 'opacity-30' : ''}`} aria-hidden="true" />
              {/* Di HP (dua kolom sempit) label boleh dua baris, bukan dipotong */}
              <span className="leading-snug sm:truncate">{it.label}</span>
            </dt>
            <dd className={`font-display text-[28px] leading-none font-semibold tnum mt-2.5 ${it.dim ? 'text-ink' : t.text}`}>{it.value}</dd>
            {it.hint && <dd className="text-xs text-inkmute mt-2 leading-snug sm:truncate">{it.hint}</dd>}
          </>
        );
        const base = `relative bg-panel px-5 py-4 min-w-0 text-left ${span}`;
        const interactive = 'transition-colors hover:bg-canvas focus-visible:bg-canvas';
        const activeCls = it.active ? 'shadow-[inset_0_-2px_0_rgb(var(--color-blueprint))]' : '';
        if (it.href) {
          return <Link key={it.key || it.label} href={it.href} className={`${base} ${interactive} ${activeCls}`}>{body}</Link>;
        }
        if (it.onClick) {
          return (
            <button key={it.key || it.label} type="button" onClick={it.onClick} aria-pressed={!!it.active} className={`${base} ${interactive} ${activeCls}`}>
              {body}
            </button>
          );
        }
        return <div key={it.key || it.label} className={base}>{body}</div>;
      })}
    </dl>
  );
}
