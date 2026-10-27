import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useProjects from '../../lib/useProjects';
import RefreshStatus from '../../components/RefreshStatus';
import ProjectTable from '../../components/ProjectTable';
import ProjectFilters, { EMPTY_FILTERS, applyFilters, countActiveFilters } from '../../components/ProjectFilters';
import { SkeletonTable } from '../../components/Skeleton';
import PageHead from '../../components/PageHead';
import { useToast } from '../../components/Toast';
import { downloadProjectsCsv } from '../../lib/exportCsv';
import ProjectViews from '../../components/ProjectViews';
import PageHeader from '../../components/ui/PageHeader';
import SearchField from '../../components/ui/SearchField';
import EmptyState from '../../components/ui/EmptyState';
import { phaseOf, PHASE_LABEL } from '../../lib/projectHelpers';

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
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    // Dibuka dari Dashboard (klik tahap di "Posisi project di alur"): /projects?stage=<stage> -> filter tahap itu saja.
    const stage = typeof router.query.stage === 'string' ? router.query.stage : '';
    if (stage) {
      setQuery('');
      setFilters({ ...EMPTY_FILTERS, stage: [stage] });
      router.replace('/projects', undefined, { shallow: true });
      setRestored(true);
      return;
    }
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setQuery(saved.query || '');
        setFilters({ ...EMPTY_FILTERS, ...(saved.filters || {}) });
      }
    } catch (e) { /* abaikan: penyimpanan tidak tersedia */ }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

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

  const actions = (
    <>
      <RefreshStatus refreshing={refreshing} staleError={staleError} />
      <button
        type="button"
        onClick={handleExport}
        disabled={!projects || filtered.length === 0}
        title="Unduh daftar yang sedang tampil (sesuai pencarian dan filter) sebagai file CSV untuk Excel"
        className="btn btn-secondary"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Ekspor CSV
      </button>
      <Link href="/projects/new" className="btn btn-primary">+ Project baru</Link>
    </>
  );

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Project" />
        <PageHeader title="Project" actions={actions} nav={<ProjectViews active="list" />} />
        <div className="bg-panel border border-line rounded-xl p-6 text-rust" role="alert">{error}</div>
      </div>
    );
  }

  if (!projects) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Project" />
        <PageHeader title="Project" meta="Memuat daftar project..." actions={actions} nav={<ProjectViews active="list" />} />
        <div className="skeleton-shimmer rounded-xl h-[60px]" />
        <SkeletonTable rows={6} />
      </div>
    );
  }

  const count = (phase) => projects.filter((p) => phaseOf(p) === phase).length;
  const blockedCount = projects.filter((p) => p.blocker).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Project" />

      <PageHeader
        title="Project"
        nav={<ProjectViews active="list" />}
        meta={
          <span className="tnum">
            {projects.length} project: {count('Pre-Delivery')} {PHASE_LABEL['Pre-Delivery'].toLowerCase()}, {count('Delivered')} {PHASE_LABEL.Delivered.toLowerCase()}, {count('Completed')} {PHASE_LABEL.Completed.toLowerCase()}
            {blockedCount > 0 && <span className="text-rust font-medium">, {blockedCount} terhambat</span>}
          </span>
        }
        actions={actions}
      />

      {/* Pencarian + filter dalam satu baris alat */}
      <div className="bg-panel border border-line rounded-xl px-3 py-3 sm:px-4 flex flex-col gap-3 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start gap-3">
          <SearchField
            className="lg:w-80 shrink-0"
            value={query}
            onChange={setQuery}
            placeholder="Cari PO, project, client, PIC, atau catatan..."
            label="Cari project"
          />
          <div className="min-w-0 flex-1">
            <ProjectFilters base={searched} filters={filters} onChange={setFilters} />
          </div>
        </div>
      </div>

      {projects.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 -mb-1">
          <p className="text-sm text-inkmute" aria-live="polite">
            Menampilkan <span className="tnum font-semibold text-ink">{filtered.length}</span> dari <span className="tnum">{projects.length}</span> project
            {activeCount > 0 && <span> · {activeCount} filter aktif</span>}
          </p>
          {hasActiveFilter && (
            <button type="button" onClick={resetAll} className="tap text-sm font-medium text-blueprint hover:underline">Reset pencarian dan filter</button>
          )}
        </div>
      )}

      {projects.length === 0 ? (
        <EmptyState
          title="Belum ada project"
          action={<Link href="/projects/new" className="btn btn-primary">Tambah project pertama</Link>}
        >
          Tambahkan project pertama untuk mulai memantau progresnya.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Tidak ada project yang cocok"
          dashed={false}
          action={<button type="button" onClick={resetAll} className="btn btn-secondary">Reset pencarian dan filter</button>}
        >
          Ubah kata kunci atau kurangi filter yang aktif.
        </EmptyState>
      ) : (
        <ProjectTable projects={filtered} />
      )}
    </div>
  );
}
