import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { STAGE_WEIGHTS } from '../lib/stages';
import KanbanBoard from '../components/KanbanBoard';
import PageHead from '../components/PageHead';
import { SkeletonPanel } from '../components/Skeleton';
import { useToast } from '../components/Toast';

export default function BoardPage() {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [savingId, setSavingId] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    api.getProjects().then(setProjects).catch((e) => setError(e.message));
  }, []);

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
            Seret kartu ke kolom stage baru, atau pakai dropdown di kartu. Perubahan langsung tersimpan ke
            spreadsheet dan tercatat di Aktivitas.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-inkmute" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Cari PO, project, client, PIC..."
            className="border border-line rounded-md pl-9 pr-4 py-2 text-sm bg-panel outline-none focus:border-blueprint w-full"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {!projects ? (
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-64 flex-shrink-0">
              <SkeletonPanel className="h-72" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="text-xs text-inkmute">
            Menampilkan {filtered.length} dari {projects.length} project
          </p>
          <KanbanBoard projects={filtered} busy={!!savingId} onMove={handleMove} />
        </>
      )}
    </div>
  );
}
