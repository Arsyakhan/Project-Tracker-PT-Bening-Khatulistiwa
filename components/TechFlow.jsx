import { groupByPhase, moduleLabel, formatCapacity } from '../lib/techflow';

// Modul "inti" (proses pengolahan) tampil lebih tegas daripada pendukung (pompa, tangki, dosing).
const CORE = new Set(['clarifier', 'mmf', 'birm', 'acf', 'softener', 'uf', 'ro', 'mixedbed', 'chlorination']);

function Chevron() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="w-4 h-4 text-inkmute shrink-0 self-center" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4l6 6-6 6" />
    </svg>
  );
}

// Alur teknologi: modul urut dari air baku sampai air produk, dikelompokkan per fase.
// modules: [{ key, cap, unit, detail? }]
export default function TechFlow({ modules, selectedKey, onSelect, emptyText = 'Belum ada modul yang tercatat.' }) {
  const phases = groupByPhase(modules);
  if (phases.length === 0) {
    return <p className="text-sm text-inkmute">{emptyText}</p>;
  }
  const flat = [];
  phases.forEach((ph) => ph.items.forEach((m) => flat.push({ ph, m })));

  return (
    <ol className="flex flex-wrap items-stretch gap-y-4 gap-x-1" aria-label="Alur teknologi dari air baku ke air produk">
      {phases.map((ph, pi) => (
        <li key={ph.key} className="flex flex-col gap-1.5 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-inkmute px-0.5">{ph.label}</span>
          <div className="flex items-stretch gap-1">
            {ph.items.map((m, i) => {
              const cap = formatCapacity(m.cap, m.unit);
              const core = CORE.has(m.key);
              const selected = selectedKey === m.key;
              const body = (
                <>
                  <span className={`block text-sm leading-tight ${core ? 'font-semibold text-ink' : 'font-medium text-inkmute'}`}>{moduleLabel(m, true)}</span>
                  {cap && <span className={`block font-data tnum text-xs mt-0.5 ${core ? 'text-blueprint' : 'text-inkmute'}`}>{cap}</span>}
                </>
              );
              const cls = `rounded-lg border px-3 py-2 text-left min-w-[84px] ${core ? 'bg-blueprint/10 border-blueprint/40' : 'bg-canvas border-line'} ${selected ? 'ring-2 ring-blueprint' : ''}`;
              const isLast = pi === phases.length - 1 && i === ph.items.length - 1;
              return (
                <div key={m.key} className="flex items-stretch gap-1">
                  {onSelect ? (
                    <button type="button" onClick={() => onSelect(m.key)} aria-pressed={selected} className={`${cls} hover:border-blueprint transition-colors`}>
                      {body}
                    </button>
                  ) : (
                    <div className={cls}>{body}</div>
                  )}
                  {!isLast && <Chevron />}
                </div>
              );
            })}
          </div>
        </li>
      ))}
    </ol>
  );
}
