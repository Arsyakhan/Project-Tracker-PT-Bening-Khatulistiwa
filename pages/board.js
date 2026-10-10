import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { STAGE_WEIGHTS } from '../lib/stages';
import useProjects from '../lib/useProjects';
import RefreshStatus from '../components/RefreshStatus';
import KanbanBoard from '../components/KanbanBoard';
import PageHead from '../components/PageHead';
import { SkeletonPanel } from '../components/Skeleton';
import { useToast } from '../components/Toast';

export default function BoardPage() {
  // mutate = ubah data lokal (update optimis). Setelah itu, hasil penyegaran yang datang
  // belakangan tidak menimpa kartu yang baru dipindah.
  const { projects, mutate: setProjects, error, staleError, refreshing } = useProjects();
  const [query, setQuery] = useState('');
  const [savingId, setSavingId] = useState(null);
  const { showToast } = useToast();

  const filtered = useMemo(() => {
    if (!projects) return [];
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        String(p.projectName || '').toLowerCase().includes(q) ||
        String(p.poNumber || '').toLowerCase().includes(q) ||
        String(p.client || '').toLowerCase().includes(q) ||
        String(p.pic || '').toLowerCase().includes(q)
    );
  }, [projects, query]);

  async function handleMove(project, newStage) {
    if (!newStage || newStage === project.currentStage || savingId) return;

    const oldStage = project.currentStage;
    const oldProgress = project.stageProgress;
    const weight = STAGE_WEIGHTS[newStage];

    // Optimistic update: kartu langsung pindah, lalu disimpan di belakang layar.
    setProjects((list) =>
      list.map((p) =>
        p.id === project.id
          ? { ...p, currentStage: newStage, stageProgress: weight !== undefined ? weight : p.stageProgress }
          : p
      )
    );
    setSavingId(project.id);

    try {
      await api.updateProject({ projectId: project.id, currentStage: newStage });
      showToast(`"${project.projectName}" dipindah ke ${newStage}`);
    } catch (err) {
      // Gagal simpan -> kembalikan kartu ke stage semula.
      setProjects((list) =>
        list.map((p) =>
          p.id === project.id ? { ...p, currentStage: oldStage, stageProgress: oldProgress } : p
        )
      );
      showToast(err.message || 'Gagal memindahkan project', 'error');
    } finally {
      setSavingId(null);
    }
  }

  if (error) {
    return <div className="bg-panel border border-line rounded-lg p-6 text-rust">Gagal memuat data: {error}</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Papan Kanban" />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Papan Kanban</h1>
          <p className="text-sm text-inkmute mt-1">
            <span className="hidden md:inline">Seret kartu ke tahap baru, atau pakai menu tahap di kartu. </span>
            <span className="md:hidden">Ubah tahap lewat menu di tiap kartu. </span>
            Perubahan langsung tersimpan ke spreadsheet dan tercatat di Aktivitas.
          </p>
        </div>

        <div className="relative w-full sm:w-72 sm:flex-shrink-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-inkmute" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Cari PO, project, client, PIC..."
            aria-label="Cari project di papan"
            className="border border-line rounded-md pl-9 pr-4 py-2 text-sm max-md:text-base bg-panel outline-none focus:border-blueprint w-full"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {!projects ? (
        <div className="grid grid-cols-1 md:grid-cols-2 min-[1340px]:grid-cols-4 gap-3" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonPanel key={i} className="h-72" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-inkmute">
              Menampilkan {filtered.length} dari {projects.length} project
            </p>
            <RefreshStatus refreshing={refreshing} staleError={staleError} />
          </div>
          {query.trim() && filtered.length === 0 && (
            <p className="text-sm text-inkmute">Tidak ada project yang cocok dengan &ldquo;{query.trim()}&rdquo;.</p>
          )}
          <KanbanBoard projects={filtered} busy={!!savingId} onMove={handleMove} />
        </>
      )}
    </div>
  );
}
