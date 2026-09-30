import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useProjects from '../../lib/useProjects';
import RefreshStatus from '../../components/RefreshStatus';
import ProjectTable from '../../components/ProjectTable';
import ProjectFilters, { EMPTY_FILTERS, applyFilters, countActiveFilters } from '../../components/ProjectFilters';
import { SkeletonTable } from '../../components/Skeleton';
import PageHead from '../../components/PageHead';
import { useToast } from '../../components/Toast';
import { downloadProjectsCsv } from '../../lib/exportCsv';

// Pencarian & filter diingat selama tab browser terbuka, jadi setelah membuka
// detail project lalu kembali, daftar tetap seperti yang tadi.
const STORAGE_KEY = 'bh.projects.view.v1';

export default function ProjectsPage() {
  // Data terakhir langsung tampil (kalau ada), lalu disegarkan di belakang layar.
  const { projects, error, staleError, refreshing } = useProjects();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [restored, setRestored] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setQuery(saved.query || '');
        setFilters({ ...EMPTY_FILTERS, ...(saved.filters || {}) });
      }
    } catch (e) { /* abaikan: penyimpanan tidak tersedia */ }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ query, filters }));
    } catch (e) { /* abaikan */ }
  }, [query, filters, restored]);

  // Langkah 1: pencarian teks
  const searched = useMemo(() => {
    if (!projects) return [];
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      [p.poNumber, p.projectName, p.client, p.pic, p.technology, p.currentStage, p.status, p.remarks]
        .some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [projects, query]);

  // Langkah 2: filter checklist
  const filtered = useMemo(() => applyFilters(searched, filters), [searched, filters]);

  const activeCount = countActiveFilters(filters);
  const hasActiveFilter = activeCount > 0 || query.trim() !== '';

  function resetAll() {
    setQuery('');
    setFilters(EMPTY_FILTERS);
  }

  function handleExport() {
    if (filtered.length === 0) return;
    downloadProjectsCsv(filtered);
    showToast(`${filtered.length} project diekspor ke CSV`);
  }

  if (error) return <div className="bg-panel border border-line rounded-lg p-6 text-rust">{error}</div>;

  if (!projects) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Semua Project</h1>
        <SkeletonTable rows={6} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Semua Project" />

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Semua Project</h1>
          <p className="text-sm text-inkmute mt-1">
            <span className="tnum font-medium text-ink">{filtered.length}</span> dari <span className="tnum">{projects.length}</span> project
            {hasActiveFilter && ' sesuai pencarian & filter'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <RefreshStatus refreshing={refreshing} staleError={staleError} />
          <button
            type="button"
            onClick={handleExport}
            disabled={filtered.length === 0}
            title="Unduh daftar yang sedang tampil (sesuai pencarian & filter) sebagai file CSV untuk Excel"
            className="inline-flex items-center gap-1.5 h-9 border border-line rounded-md px-3 text-sm font-medium text-ink bg-panel hover:border-blueprint hover:text-blueprint disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Panel pencarian + filter */}
      <div className="bg-panel border border-line rounded-lg p-3 sm:p-4 flex flex-col gap-3 shadow-sm">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-inkmute" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Cari PO, project, client, PIC, atau catatan..."
            className="input !pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <ProjectFilters base={searched} filters={filters} onChange={setFilters} />
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-3 py-16 bg-panel border border-dashed border-line rounded-lg">
          <svg className="w-10 h-10 text-inkmute/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3.75-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />
          </svg>
          <div>
            <p className="text-ink font-medium">Belum ada project</p>
            <p className="text-inkmute text-sm mt-1">Mulai lacak project pertama kamu di sini.</p>
          </div>
          <Link
            href="/projects/new"
            className="mt-2 inline-flex items-center gap-2 bg-blueprint hover:bg-blueprintdark text-white font-medium text-sm rounded-lg px-4 py-2 shadow-sm transition-colors"
          >
            Tambah project pertama
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-2 py-12 bg-panel border border-line rounded-lg">
          <svg className="w-8 h-8 text-inkmute/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-ink font-medium">Tidak ada project yang cocok</p>
          <p className="text-inkmute text-sm">Longgarkan pencarian atau kurangi filter yang aktif.</p>
          <button onClick={resetAll} className="mt-1 text-blueprint text-sm font-medium hover:underline">
            Reset pencarian & filter
          </button>
        </div>
      ) : (
        <ProjectTable projects={filtered} />
      )}
    </div>
  );
}
