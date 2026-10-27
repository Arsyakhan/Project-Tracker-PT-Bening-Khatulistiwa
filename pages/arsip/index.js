import Link from 'next/link';
import { useMemo, useState } from 'react';
import PageHead from '../../components/PageHead';
import RefreshStatus from '../../components/RefreshStatus';
import { useSession } from 'next-auth/react';
import { canWrite } from '../../lib/roles';
import useArchive from '../../lib/useArchive';
import { FLOW_STEPS, chainText, formatCapacity, moduleLabel, sortModules } from '../../lib/techflow';
import PageHeader from '../../components/ui/PageHeader';
import SearchField from '../../components/ui/SearchField';
import EmptyState from '../../components/ui/EmptyState';

// Teknologi yang dijadikan filter (modul inti + beberapa pendukung yang sering dicari).
const FILTER_KEYS = ['ro', 'ro2', 'uf', 'softener', 'acf', 'mmf', 'birm', 'greensand', 'clarifier', 'mixedbed', 'ion_exchange', 'edi', 'chlorination', 'uv'];

function Chip({ active, onClick, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md border px-2.5 h-8 max-md:h-10 text-sm transition-colors ${active ? 'bg-blueprint text-onaccent border-blueprint' : 'bg-panel text-ink border-line hover:border-blueprint hover:text-blueprint'}`}
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
  const [showFilters, setShowFilters] = useState(false); // HP: pilihan filter dilipat

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

  const yearSpan = years.length ? `${years[years.length - 1][0]}-${years[0][0]}` : '';
  const resetFilters = () => { setQuery(''); setYear(''); setTechs([]); };

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Arsip Project" />

      <PageHeader
        title="Arsip Project Selesai"
        meta={
          data && all.length > 0
            ? <>Acuan teknologi dari <span className="tnum font-medium text-ink">{all.length}</span> project yang sudah rampung{yearSpan ? ` (${yearSpan})` : ''}. Cari yang mirip dengan project baru: kapasitas, urutan unit, dan spesifikasi peralatannya.</>
            : 'Acuan teknologi dari project yang sudah rampung: kapasitas, urutan unit, dan spesifikasi peralatannya.'
        }
        actions={
          <>
            <RefreshStatus refreshing={refreshing && !!data} staleError={staleError} />
            {writable && <Link href="/arsip/new" className="btn btn-primary">+ Tambah arsip</Link>}
          </>
        }
      />

      {error && !data ? (
        <div className="bg-panel border border-line rounded-xl p-5 text-sm text-rust" role="alert">
          Gagal memuat arsip: {error}
          {/Unknown action/i.test(error) && <span className="block text-inkmute mt-1">Backend belum diperbarui: tempel Archive.gs di Apps Script lalu deploy versi baru.</span>}
        </div>
      ) : !data ? (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6">
          <div className="skeleton-shimmer rounded-xl h-72 w-full" />
          <div className="skeleton-shimmer rounded-xl h-96 w-full" />
        </div>
      ) : all.length === 0 ? (
        <EmptyState title="Belum ada data arsip">
          Pastikan tab <b className="text-ink">[ARSIP] FINISHED PROJECT</b> terisi dan Archive.gs sudah terpasang.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start">
          {/* Panel filter: di layar lebar menempel di kiri saat digulir */}
          <aside className="bg-panel border border-line rounded-xl shadow-sm p-4 flex flex-col gap-4 lg:sticky lg:top-6" aria-label="Filter arsip">
            <SearchField value={query} onChange={setQuery} placeholder="Cari nama, teknologi, spesifikasi..." label="Cari arsip" />
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              aria-controls="arsip-filter"
              className="lg:hidden btn btn-secondary w-full justify-between"
            >
              Filter teknologi dan tahun{techs.length + (year ? 1 : 0) > 0 ? ` (${techs.length + (year ? 1 : 0)} aktif)` : ''}
              <svg className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            <div id="arsip-filter" className={`${showFilters ? 'flex' : 'hidden'} lg:flex flex-col gap-4`}>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-inkmute">Teknologi <span className="font-normal">(semua pilihan harus ada)</span></span>
              <div className="flex flex-wrap gap-1.5">
                {filterOptions.map((st) => (
                  <Chip key={st.key} active={techs.includes(st.key)} onClick={() => toggleTech(st.key)} count={techCount[st.key]}>{st.short}</Chip>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-inkmute">Tahun selesai</span>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={!year} onClick={() => setYear('')}>Semua</Chip>
                {years.map(([y, n]) => (
                  <Chip key={y} active={year === y} onClick={() => setYear(year === y ? '' : y)} count={n}>{y}</Chip>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-inkmute">Urutkan</span>
              <select className="input !min-h-[36px] max-md:!min-h-[40px] !py-1" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="terbaru">Terbaru</option>
                <option value="terlama">Terlama</option>
                <option value="nama">Nama A-Z</option>
              </select>
            </label>
            </div>
            {filtersActive && (
              <button type="button" onClick={resetFilters} className="btn btn-ghost w-full">Reset filter</button>
            )}
          </aside>

          <section className="flex flex-col gap-3 min-w-0" aria-label="Hasil arsip">
            <p className="text-sm text-inkmute" aria-live="polite">
              Menampilkan <b className="text-ink font-semibold tnum">{filtered.length}</b> dari <span className="tnum">{all.length}</span> project
            </p>
            {filtered.length === 0 ? (
              <EmptyState title="Tidak ada project yang cocok" dashed={false} action={<button type="button" onClick={resetFilters} className="btn btn-secondary">Reset filter</button>}>
                Kurangi pilihan teknologi atau ganti tahun.
              </EmptyState>
            ) : (
              <ul className="bg-panel border border-line rounded-xl shadow-sm divide-y divide-line overflow-hidden">
                {filtered.map((p) => {
                  const chain = chainText(p.modules, 6);
                  const main = ['ro', 'uf', 'softener', 'mmf', 'clarifier'].map((k) => p.modules.find((m) => m.key === k)).find((m) => m && formatCapacity(m.cap, m.unit));
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/arsip/${encodeURIComponent(p.id)}`}
                        className="group grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 px-5 py-4 hover:bg-canvas transition-colors"
                      >
                        <span className="min-w-0">
                          <span className="block font-medium text-ink group-hover:text-blueprint leading-snug">{p.name}</span>
                          <span className="block text-sm text-blueprint mt-1 truncate">{chain || 'Tidak ada modul proses tercatat'}</span>
                        </span>
                        <span className="flex flex-col items-end gap-1 shrink-0">
                          <span className="font-data tnum text-xs text-inkmute border border-line rounded-md px-1.5 leading-5">{p.year || '-'}</span>
                          {main && <span className="font-data tnum text-xs font-medium text-ink">{moduleLabel(main, true)} {formatCapacity(main.cap, main.unit)}</span>}
                        </span>
                        <span className="col-span-2 flex flex-wrap gap-1">
                          {sortModules(p.modules).map((m) => (
                            <span key={m.key} className="text-xs rounded-md bg-canvas border border-line text-inkmute px-1.5 leading-5">{moduleLabel(m, true)}</span>
                          ))}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
