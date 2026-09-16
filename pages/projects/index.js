import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import ProjectTable from '../../components/ProjectTable';
import { SkeletonTable } from '../../components/Skeleton';

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

      <ProjectTable projects={filteredProjects} />

      {filteredProjects.length === 0 && (
        <div className="text-center text-inkmute py-8 bg-panel border border-line rounded-lg">
          Project tidak ditemukan.
        </div>
      )}
    </div>
  );
}
