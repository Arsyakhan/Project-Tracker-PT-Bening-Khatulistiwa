import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import ProjectTable from '../../components/ProjectTable';
import { SkeletonTable } from '../../components/Skeleton';
import PageHead from '../../components/PageHead';

export default function ProjectsPage() {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  useEffect(() => {
    api.getProjects().then(setProjects).catch((e) => setError(e.message));
  }, []);

  const { statusOptions, priorityOptions } = useMemo(() => {
    if (!projects) return { statusOptions: [], priorityOptions: [] };
    return {
      statusOptions: Array.from(new Set(projects.map((p) => p.status).filter(Boolean))).sort(),
      priorityOptions: Array.from(new Set(projects.map((p) => p.priority).filter(Boolean))).sort(),
    };
  }, [projects]);

  if (error) return <div className="bg-panel border border-line rounded-lg p-6 text-rust">{error}</div>;

  if (!projects) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Semua Project</h1>
        <SkeletonTable rows={6} />
      </div>
    );
  }

  // Logika Pencarian + Filter
  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (p.poNumber || '').toLowerCase().includes(q) ||
      (p.projectName || '').toLowerCase().includes(q) ||
      (p.client || '').toLowerCase().includes(q) ||
      (p.pic || '').toLowerCase().includes(q) ||
      (p.status || '').toLowerCase().includes(q);
    const matchesStatus = !statusFilter || p.status === statusFilter;
    const matchesPriority = !priorityFilter || p.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const hasActiveFilter = searchQuery || statusFilter || priorityFilter;

  function resetFilters() {
    setSearchQuery('');
    setStatusFilter('');
    setPriorityFilter('');
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Semua Project" />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <h1 className="font-display text-2xl font-semibold text-ink">Semua Project</h1>

        <div className="relative w-full sm:w-80">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-inkmute" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Cari PO, Project, Client, atau PIC..."
            className="border border-line rounded-md pl-9 pr-4 py-2 text-sm bg-panel outline-none focus:border-blueprint w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Filter cepat by Status & Priority */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="border border-line rounded-md px-3 py-2 text-sm bg-panel outline-none focus:border-blueprint text-ink"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Semua Status</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          className="border border-line rounded-md px-3 py-2 text-sm bg-panel outline-none focus:border-blueprint text-ink"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="">Semua Priority</option>
          {priorityOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        {hasActiveFilter && (
          <button
            onClick={resetFilters}
            className="text-xs text-inkmute hover:text-rust font-medium px-2 py-1"
          >
            Reset filter
          </button>
        )}

        <span className="text-xs text-inkmute ml-auto">
          Menampilkan {filteredProjects.length} dari {projects.length} project
        </span>
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
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Tambah project pertama
          </Link>
        </div>
      ) : (
        <>
          <ProjectTable projects={filteredProjects} />
          {filteredProjects.length === 0 && (
            <div className="flex flex-col items-center text-center gap-2 py-10 bg-panel border border-line rounded-lg">
              <svg className="w-8 h-8 text-inkmute/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-inkmute text-sm">Project tidak ditemukan untuk filter ini.</p>
              <button onClick={resetFilters} className="text-blueprint text-sm font-medium hover:underline">
                Reset filter
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
