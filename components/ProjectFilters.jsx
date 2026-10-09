import { useEffect, useMemo, useRef, useState } from 'react';
import { STAGES } from '../lib/stages';
import { PHASES, FLAG, phaseOf, flagsOf, techTypes, yearOf } from '../lib/projectHelpers';

// Definisi filter. `get` mengembalikan daftar nilai milik sebuah project
// (bisa lebih dari satu, mis. project dengan RO + UF).
// Aturan: pilihan DI DALAM satu filter = ATAU, ANTAR filter = DAN.
export const FACETS = [
  { key: 'phase', label: 'Fase', get: (p) => [phaseOf(p)], order: PHASES },
  { key: 'status', label: 'Status', get: (p) => [p.status || 'Tanpa status'], order: ['Not Started', 'In Progress', 'On Hold', 'Completed'] },
  { key: 'stage', label: 'Stage', get: (p) => [p.currentStage || 'Tanpa stage'], order: STAGES },
  { key: 'priority', label: 'Priority', get: (p) => [p.priority || 'Tanpa priority'], order: ['High', 'Medium', 'Low'] },
  { key: 'pic', label: 'PIC', get: (p) => [p.pic || 'Tanpa PIC'] },
  { key: 'client', label: 'Client', get: (p) => [p.client || 'Tanpa client'], searchable: true },
  { key: 'tech', label: 'Teknologi', get: techTypes },
  { key: 'year', label: 'Tahun PO', get: (p) => [yearOf(p)], desc: true },
  { key: 'flag', label: 'Kondisi', get: flagsOf, order: Object.values(FLAG), alwaysShowOrder: true },
];

export const EMPTY_FILTERS = Object.fromEntries(FACETS.map((f) => [f.key, []]));

export function applyFilters(list, filters, skipKey) {
  const active = FACETS.filter((f) => f.key !== skipKey && filters[f.key] && filters[f.key].length);
  if (active.length === 0) return list;
  return list.filter((p) =>
    active.every((f) => {
      const vals = f.get(p);
      return filters[f.key].some((sel) => vals.includes(sel));
    })
  );
}

export function countActiveFilters(filters) {
  return FACETS.reduce((n, f) => n + ((filters[f.key] && filters[f.key].length) || 0), 0);
}

function Chevron() {
  return (
    <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function FacetDropdown({ facet, options, selected, open, onToggleOpen, onToggleValue, onClear }) {
  const [q, setQ] = useState('');
  useEffect(() => { if (!open) setQ(''); }, [open]);

  const showSearch = facet.searchable || options.length > 8;
  const visible = q ? options.filter((o) => o.value.toLowerCase().includes(q.trim().toLowerCase())) : options;
  const hasSelection = selected.length > 0;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm font-medium transition-colors ${
          hasSelection
            ? 'border-blueprint/40 bg-blueprint/10 text-blueprint'
            : 'border-line bg-panel text-ink hover:border-blueprint/50'
        }`}
      >
        {facet.label}
        {hasSelection && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-blueprint text-onaccent text-[10px] font-bold flex items-center justify-center">
            {selected.length}
          </span>
        )}
        <Chevron />
      </button>

      {open && (
        <>
          <div className="sm:hidden fixed inset-0 z-40 bg-black/40" onClick={onToggleOpen} />
          <div
            role="dialog"
            aria-label={`Filter ${facet.label}`}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] rounded-t-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:w-72 sm:max-h-none sm:rounded-lg bg-panel border border-line shadow-xl flex flex-col"
          >
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <span className="text-sm font-semibold text-ink">{facet.label}</span>
              <button
                type="button"
                onClick={onClear}
                disabled={!hasSelection}
                className="text-xs font-medium text-blueprint hover:underline disabled:text-inkmute/50 disabled:no-underline disabled:cursor-not-allowed"
              >
                Hapus pilihan
              </button>
            </div>

            {showSearch && (
              <div className="px-3 pb-2">
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={`Cari ${facet.label.toLowerCase()}...`}
                  className="input !min-h-[34px] !py-1.5 text-sm"
                  autoFocus
                />
              </div>
            )}

            <div className="overflow-y-auto sm:max-h-64 border-t border-line/70">
              {visible.length === 0 ? (
                <p className="px-3 py-4 text-sm text-inkmute text-center">Tidak ada pilihan.</p>
              ) : (
                visible.map((o) => {
                  const checked = selected.includes(o.value);
                  return (
                    <label
                      key={o.value}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-canvas transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-blueprint"
                        checked={checked}
                        onChange={() => onToggleValue(o.value)}
                      />
                      <span className={`flex-1 truncate ${o.count === 0 && !checked ? 'text-inkmute' : 'text-ink'}`}>
                        {o.value}
                      </span>
                      <span className="text-xs font-data tnum text-inkmute">{o.count}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="sm:hidden p-3 border-t border-line">
              <button
                type="button"
                onClick={onToggleOpen}
                className="w-full h-10 rounded-md bg-blueprint text-onaccent text-sm font-medium"
              >
                Selesai
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// base    : daftar project setelah pencarian teks (belum kena filter checklist)
// filters : { phase: [], status: [], ... }
export default function ProjectFilters({ base, filters, onChange }) {
  const [openKey, setOpenKey] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpenKey(null);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpenKey(null);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Opsi tiap filter + jumlahnya. Jumlah dihitung dengan memperhitungkan filter LAIN
  // yang sedang aktif, jadi angkanya selalu menunjukkan berapa project yang akan tampil.
  const optionsByFacet = useMemo(() => {
    const out = {};
    FACETS.forEach((f) => {
      const counts = new Map();
      base.forEach((p) => f.get(p).forEach((v) => { if (!counts.has(v)) counts.set(v, 0); }));
      if (f.alwaysShowOrder) f.order.forEach((v) => { if (!counts.has(v)) counts.set(v, 0); });
      applyFilters(base, filters, f.key).forEach((p) =>
        f.get(p).forEach((v) => counts.set(v, (counts.get(v) || 0) + 1))
      );
      (filters[f.key] || []).forEach((v) => { if (!counts.has(v)) counts.set(v, 0); });

      const opts = Array.from(counts, ([value, count]) => ({ value, count }));
      if (f.order) {
        const idx = (v) => { const i = f.order.indexOf(v); return i === -1 ? 999 : i; };
        opts.sort((a, b) => idx(a.value) - idx(b.value) || a.value.localeCompare(b.value));
      } else if (f.desc) {
        opts.sort((a, b) => b.value.localeCompare(a.value));
      } else {
        opts.sort((a, b) => a.value.localeCompare(b.value, 'id', { numeric: true }));
      }
      out[f.key] = opts;
    });
    return out;
  }, [base, filters]);

  function toggleValue(key, value) {
    const cur = filters[key] || [];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    onChange({ ...filters, [key]: next });
  }

  const activeCount = countActiveFilters(filters);

  return (
    <div ref={wrapRef} className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 overflow-x-auto sm:overflow-visible sm:flex-wrap pb-1 sm:pb-0 -mx-1 px-1">
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-inkmute mr-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
          </svg>
          Filter
        </span>
        {FACETS.map((f) => (
          <FacetDropdown
            key={f.key}
            facet={f}
            options={optionsByFacet[f.key]}
            selected={filters[f.key] || []}
            open={openKey === f.key}
            onToggleOpen={() => setOpenKey(openKey === f.key ? null : f.key)}
            onToggleValue={(v) => toggleValue(f.key, v)}
            onClear={() => onChange({ ...filters, [f.key]: [] })}
          />
        ))}
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {FACETS.flatMap((f) =>
            (filters[f.key] || []).map((v) => (
              <button
                key={`${f.key}:${v}`}
                type="button"
                onClick={() => toggleValue(f.key, v)}
                title="Klik untuk menghapus filter ini"
                className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-2 rounded-full bg-blueprint/10 border border-blueprint/25 text-blueprint text-xs font-medium hover:bg-blueprint/20 transition-colors"
              >
                <span className="text-inkmute font-normal">{f.label}:</span>
                {v}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-xs font-medium text-inkmute hover:text-rust px-2 h-7"
          >
            Reset semua
          </button>
        </div>
      )}
    </div>
  );
}
