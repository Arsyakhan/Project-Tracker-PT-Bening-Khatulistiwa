import Link from 'next/link';
import { useMemo, useState } from 'react';
import PageHead from '../../components/PageHead';
import RefreshStatus from '../../components/RefreshStatus';
import { useSession } from 'next-auth/react';
import { canWrite } from '../../lib/roles';
import useArchive from '../../lib/useArchive';
import { FLOW_STEPS, chainText, formatCapacity, moduleLabel, sortModules } from '../../lib/techflow';

// Teknologi yang dijadikan filter (modul inti + beberapa pendukung yang sering dicari).
const FILTER_KEYS = ['ro', 'uf', 'softener', 'acf', 'mmf', 'birm', 'clarifier', 'mixedbed', 'chlorination'];

function Chip({ active, onClick, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 h-8 text-sm transition-colors ${active ? 'bg-blueprint text-onaccent border-blueprint' : 'bg-panel text-ink border-line hover:border-blueprint hover:text-blueprint'}`}
    >
      {children}
      {count !== undefined && <span className={`ml-1.5 font-data tnum text-xs ${active ? 'text-onaccent' : 'text-inkmute'}`}>{count}</span>}
    </button>
  );
}

export default function ArsipPage() {
  const { projects: data, error, staleError, refreshing } = useArchive();
  const { data: session } = useSession();
  const writable = canWrite(session?.user?.role || 'admin'); // pengecekan sebenarnya di server
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('');
  const [techs, setTechs] = useState([]);
  const [sort, setSort] = useState('terbaru');

  const all = data || [];
  const years = useMemo(() => {
    const m = {};
    all.forEach((p) => { if (p.year) m[p.year] = (m[p.year] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0]));
  }, [all]);
  const techCount = useMemo(() => {
    const m = {};
    all.forEach((p) => p.modules.forEach((x) => { m[x.key] = (m[x.key] || 0) + 1; }));
    return m;
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = all.filter((p) => {
      if (year && p.year !== year) return false;
      if (techs.length && !techs.every((k) => p.modules.some((m) => m.key === k))) return false;
      if (q) {
        const hay = `${p.name} ${p.year} ${p.modules.map((m) => `${moduleLabel(m)} ${m.detail}`).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const num = (p) => Number(p.no) || 0;
    list.sort((a, b) => {
      if (sort === 'nama') return a.name.localeCompare(b.name);
      if (sort === 'terlama') return a.year.localeCompare(b.year) || num(a) - num(b);
      return b.year.localeCompare(a.year) || num(b) - num(a);
    });
    return list;
  }, [all, query, year, techs, sort]);

  const toggleTech = (k) => setTechs((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const filtersActive = query || year || techs.length > 0;
  const filterOptions = FLOW_STEPS.filter((s) => FILTER_KEYS.includes(s.key) && techCount[s.key]);

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Arsip Project" />

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Arsip Project Selesai</h1>
          <p className="text-sm text-inkmute mt-1 max-w-2xl">
            Acuan teknologi dari project yang sudah rampung. Cari yang mirip dengan project baru: kapasitas, urutan unit, dan spesifikasi peralatannya.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RefreshStatus refreshing={refreshing && !!data} staleError={staleError} />
          {writable && <Link href="/arsip/new" className="btn btn-primary">+ Tambah arsip</Link>}
        </div>
      </div>

      {error && !data ? (
        <div className="bg-panel border border-line rounded-lg p-5 text-sm text-rust" role="alert">
          Gagal memuat arsip: {error}
          {/Unknown action/i.test(error) && <span className="block text-inkmute mt-1">Backend belum diperbarui: tempel Archive.gs di Apps Script lalu deploy versi baru.</span>}
        </div>
      ) : !data ? (
        <div className="flex flex-col gap-3">
          <div className="skeleton-shimmer rounded-lg h-24 w-full" />
          <div className="skeleton-shimmer rounded-lg h-56 w-full" />
        </div>
      ) : all.length === 0 ? (
        <div className="bg-panel border border-line rounded-lg p-8 text-center text-sm text-inkmute">
          Belum ada data. Pastikan tab <b className="text-ink">[ARSIP] FINISHED PROJECT</b> terisi dan Archive.gs sudah terpasang.
        </div>
      ) : (
        <>
          <div className="bg-panel border border-line rounded-lg p-3 sm:p-4 flex flex-col gap-3 shadow-sm">
            <input type="search" className="input" placeholder="Cari nama project, teknologi, atau isi spesifikasi..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Cari arsip" />
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-inkmute">Teknologi (pilih beberapa = harus ada semua)</span>
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((s) => (
                  <Chip key={s.key} active={techs.includes(s.key)} onClick={() => toggleTech(s.key)} count={techCount[s.key]}>{s.short}</Chip>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-inkmute">Tahun</span>
              <div className="flex flex-wrap gap-2">
                <Chip active={!year} onClick={() => setYear('')}>Semua</Chip>
                {years.map(([y, n]) => (
                  <Chip key={y} active={year === y} onClick={() => setYear(year === y ? '' : y)} count={n}>{y}</Chip>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-line">
              <p className="text-sm text-inkmute" aria-live="polite">
                <b className="text-ink font-data tnum">{filtered.length}</b> dari {all.length} project
              </p>
              <div className="flex items-center gap-2">
                {filtersActive && (
                  <button type="button" onClick={() => { setQuery(''); setYear(''); setTechs([]); }} className="btn btn-ghost">Reset filter</button>
                )}
                <select className="input !w-auto !min-h-[36px] !py-1" aria-label="Urutkan" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="terbaru">Terbaru dulu</option>
                  <option value="terlama">Terlama dulu</option>
                  <option value="nama">Nama A-Z</option>
                </select>
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-panel border border-line rounded-lg p-8 text-center text-sm text-inkmute">Tidak ada project yang cocok dengan filter ini.</div>
          ) : (
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filtered.map((p) => {
                const chain = chainText(p.modules, 5);
                const ro = p.modules.find((m) => m.key === 'ro');
                return (
                  <li key={p.id}>
                    <Link
                      href={`/arsip/${encodeURIComponent(p.id)}`}
                      className="block h-full bg-panel border border-line rounded-lg p-4 shadow-sm hover:border-blueprint transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="font-display font-semibold text-ink leading-snug">{p.name}</h2>
                        <span className="font-data tnum text-xs text-inkmute border border-line rounded px-1.5 py-0.5 shrink-0">{p.year || '-'}</span>
                      </div>
                      <p className="text-sm text-blueprint font-medium mt-2 min-h-[1.25rem]">{chain || 'Tidak ada modul proses tercatat'}</p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {sortModules(p.modules).map((m) => (
                          <span key={m.key} className="text-[11px] rounded-full bg-canvas border border-line text-inkmute px-2 py-0.5">{moduleLabel(m, true)}</span>
                        ))}
                      </div>
                      {ro && formatCapacity(ro.cap, ro.unit) && <span className="sr-only">Kapasitas RO {formatCapacity(ro.cap, ro.unit)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
