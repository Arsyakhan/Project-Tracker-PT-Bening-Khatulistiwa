import { useState } from 'react';

// Warna disamakan dengan kartu statistik di atas (Pre-Delivery, Delivered, Completed),
// supaya mata tidak perlu "menerjemahkan" dua palet berbeda.
const COLORS = { pre: 'rgb(var(--color-blueprint))', del: 'rgb(var(--color-teal))', com: 'rgb(var(--color-inkmute))' };

export default function StatusPie({ dashboard }) {
  const [hovered, setHovered] = useState(null);

  if (!dashboard) return null;

  const total = dashboard.total || 0;
  const base = total || 1; // hindari pembagian dengan nol
  const preDelivery = dashboard.preDelivery || 0;
  const delivered = dashboard.delivered || 0;
  const completed = dashboard.completed || 0;

  const prePct = (preDelivery / base) * 100;
  const delPct = (delivered / base) * 100;
  const comPct = (completed / base) * 100;

  // offset dihitung supaya potongan tersusun berurutan mengelilingi donut
  const slices = [
    { id: 'pre', label: 'Pre-Delivery', count: preDelivery, pct: prePct, color: COLORS.pre, offset: 0 },
    { id: 'del', label: 'Delivered', count: delivered, pct: delPct, color: COLORS.del, offset: 100 - prePct },
    { id: 'com', label: 'Completed', count: completed, pct: comPct, color: COLORS.com, offset: 100 - prePct - delPct },
  ];

  const swatch = (color) => ({
    backgroundColor: color,
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  });

  return (
    <div className="bg-panel border border-line rounded-lg p-6 h-full flex flex-col shadow-sm">
      <h3 className="text-xs font-semibold text-inkmute mb-2 uppercase tracking-wider">Distribusi status project</h3>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-[250px]">
        <div className="w-44 h-44 relative flex items-center justify-center">
          <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90 absolute inset-0" role="img" aria-label={`Total ${total} project: ${preDelivery} pre-delivery, ${delivered} delivered, ${completed} completed`}>
            <circle cx="21" cy="21" r="15.91549431" fill="transparent" strokeWidth="5" style={{ stroke: 'rgb(var(--color-line))' }} />
            {slices.map(
              (slice) =>
                slice.pct > 0 && (
                  <circle
                    key={slice.id}
                    cx="21"
                    cy="21"
                    r="15.91549431"
                    fill="transparent"
                    strokeWidth={hovered?.id === slice.id ? '6' : '5'}
                    strokeDasharray={`${slice.pct} ${100 - slice.pct}`}
                    strokeDashoffset={slice.offset}
                    style={{ stroke: slice.color }}
                    className="transition-all duration-300 cursor-pointer outline-none"
                    onMouseEnter={() => setHovered(slice)}
                    onMouseLeave={() => setHovered(null)}
                  />
                )
            )}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {hovered ? (
              <>
                <span className="text-3xl font-display font-bold tnum" style={{ color: hovered.color }}>{hovered.count}</span>
                <span className="text-[11px] text-inkmute mt-0.5 text-center leading-tight">
                  {hovered.label}
                  <br />
                  {Math.round(hovered.pct)}%
                </span>
              </>
            ) : (
              <>
                <span className="text-3xl font-display font-bold text-ink tnum">{total}</span>
                <span className="text-[11px] text-inkmute mt-0.5">Total project</span>
              </>
            )}
          </div>
        </div>

        {/* Legenda: warna + nama + jumlah + persen */}
        <ul className="w-full max-w-[260px] flex flex-col gap-1.5 text-sm">
          {slices.map((slice) => (
            <li
              key={slice.id}
              className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-opacity duration-200 cursor-default ${
                hovered && hovered.id !== slice.id ? 'opacity-40' : 'opacity-100'
              }`}
              onMouseEnter={() => setHovered(slice)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="w-3 h-3 rounded-sm shrink-0" style={swatch(slice.color)} />
              <span className="flex-1 text-ink">{slice.label}</span>
              <span className="font-data tnum font-semibold text-ink">{slice.count}</span>
              <span className="font-data tnum text-xs text-inkmute w-10 text-right">{Math.round(slice.pct)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
