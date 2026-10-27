import { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { STAGE_WEIGHTS } from '../../lib/stages';
import { stageChangePatch } from '../../lib/projectRules';
import useProjects from '../../lib/useProjects';
import RefreshStatus from '../../components/RefreshStatus';
import KanbanBoard from '../../components/KanbanBoard';
import PageHead from '../../components/PageHead';
import { SkeletonPanel } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import ProjectViews from '../../components/ProjectViews';
import PageHeader from '../../components/ui/PageHeader';
import SearchField from '../../components/ui/SearchField';

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
    const oldStatus = project.status;
    const oldPriority = project.priority;
    const weight = STAGE_WEIGHTS[newStage];
    // Status dan Prioritas yang sedang mengikuti aturan ikut menyesuaikan stage baru (lib/projectRules.js);
    // yang diatur manual dibiarkan.
    const patch = stageChangePatch(project, newStage);

    // Optimistic update: kartu langsung pindah, lalu disimpan di belakang layar.
    setProjects((list) =>
      list.map((p) =>
        p.id === project.id
          ? { ...p, ...patch, stageProgress: weight !== undefined ? weight : p.stageProgress }
          : p
      )
    );
    setSavingId(project.id);

    try {
      await api.updateProject({ projectId: project.id, ...patch });
      const ikut = [patch.status && `Status ${patch.status}`, patch.priority && `Prioritas ${patch.priority}`].filter(Boolean);
      showToast(`"${project.projectName}" dipindah ke ${newStage}${ikut.length ? ` (${ikut.join(', ')})` : ''}`);
    } catch (err) {
      // Gagal simpan -> kembalikan kartu ke stage semula.
      setProjects((list) =>
        list.map((p) =>
          p.id === project.id ? { ...p, currentStage: oldStage, stageProgress: oldProgress, status: oldStatus, priority: oldPriority } : p
        )
      );
      showToast(err.message || 'Gagal memindahkan project', 'error');
    } finally {
      setSavingId(null);
    }
  }

  const blocked = (projects || []).filter((p) => p.blocker).length;
  const header = (
    <PageHeader
      title="Project"
      nav={<ProjectViews active="kanban" />}
      meta={
        <>
          <span className="hidden md:inline">Seret kartu ke tahap tujuan, atau pakai menu tahap di kartu. </span>
          <span className="md:hidden">Pindahkan tahap lewat menu di setiap kartu. </span>
          Perubahan langsung tersimpan ke spreadsheet dan tercatat di Aktivitas.
        </>
      }
      actions={
        <SearchField
          className="w-full sm:w-72"
          value={query}
          onChange={setQuery}
          placeholder="Cari PO, project, client, PIC..."
          label="Cari project di papan"
        />
      }
    />
  );

  if (error) {
    return (
      <div className="flex flex-col gap-5">
        <PageHead title="Kanban Project" />
        {header}
        <div className="bg-panel border border-line rounded-xl p-6 text-rust" role="alert">Gagal memuat data: {error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Kanban Project" />
      {header}

      {!projects ? (
        <div className="grid grid-cols-1 md:grid-cols-2 min-[1340px]:grid-cols-4 gap-3" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonPanel key={i} className="h-72" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 -mb-1">
            <p className="text-sm text-inkmute" aria-live="polite">
              Menampilkan <span className="tnum font-semibold text-ink">{filtered.length}</span> dari <span className="tnum">{projects.length}</span> project
              {blocked > 0 && <span className="text-rust font-medium">, {blocked} terhambat</span>}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-inkmute">
              <RefreshStatus refreshing={refreshing} staleError={staleError} />
              <span className="inline-flex items-center gap-1.5">Garis tepi kartu = prioritas:</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-[3px] h-3 rounded bg-rust" aria-hidden="true" />High</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-[3px] h-3 rounded bg-amber" aria-hidden="true" />Medium</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-[3px] h-3 rounded bg-line border border-inkmute/30" aria-hidden="true" />Low</span>
            </div>
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
