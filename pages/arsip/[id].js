import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import ArchiveEditor from '../../components/ArchiveEditor';
import ConfirmModal from '../../components/ConfirmModal';
import PageHead from '../../components/PageHead';
import RefreshStatus from '../../components/RefreshStatus';
import TechFlow from '../../components/TechFlow';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { clearCache } from '../../lib/persistedCache';
import { canDelete, canWrite } from '../../lib/roles';
import { findSimilar, formatCapacity, moduleLabel, sortModules } from '../../lib/techflow';
import useArchive from '../../lib/useArchive';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import EmptyState from '../../components/ui/EmptyState';

export default function ArsipDetailPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role || 'admin'; // pengecekan sebenarnya di server; ini hanya cerminan tampilan
  const writable = canWrite(role);
  const deletable = canDelete(role);
  const { showToast } = useToast();

  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const { projects, schema, error, staleError, refreshing, reload } = useArchive();
  const project = useMemo(() => (projects || []).find((p) => p.id === id) || null, [projects, id]);
  const modules = useMemo(() => sortModules(project?.modules || []), [project]);
  const [selected, setSelected] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const similar = useMemo(
    () => (project ? findSimilar(project.modules, (projects || []).filter((p) => p.id !== project.id), 4) : []),
    [project, projects]
  );

  // Pilih modul pertama yang punya detail supaya panel spesifikasi langsung terisi.
  useEffect(() => {
    if (!project) return;
    const withDetail = modules.find((m) => m.detail);
    setSelected((cur) => (cur && modules.some((m) => m.key === cur) ? cur : (withDetail || modules[modules.length - 1] || {}).key || ''));
  }, [project, modules]);

  const sel = modules.find((m) => m.key === selected) || null;

  async function handleSave(form) {
    setSaving(true);
    setSaveError('');
    try {
      await api.saveArchiveProject({ ...form, id: project.id, baseRev: project.rev });
      clearCache('archive');
      await reload(true);
      showToast('Perubahan arsip disimpan.', 'success');
      setEditing(false);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setConfirmDelete(false);
    try {
      await api.deleteArchiveProject({ id: project.id });
      clearCache('archive');
      showToast('Project arsip dihapus.', 'success');
      router.push('/arsip');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead title={project ? project.name : 'Arsip Project'} />

      {error && !projects ? (
        <>
          <PageHeader crumbs={[{ href: '/arsip', label: 'Arsip Project' }]} title="Arsip Project" />
          <div className="bg-panel border border-line rounded-xl p-5 text-sm text-rust" role="alert">Gagal memuat arsip: {error}</div>
        </>
      ) : !projects ? (
        <div className="flex flex-col gap-3">
          <div className="skeleton-shimmer rounded-lg h-4 w-40" />
          <div className="skeleton-shimmer rounded-lg h-10 w-2/3" />
          <div className="skeleton-shimmer rounded-xl h-40 w-full" />
        </div>
      ) : !project ? (
        <>
          <PageHeader crumbs={[{ href: '/arsip', label: 'Arsip Project' }]} title="Arsip Project" />
          <EmptyState title="Project arsip tidak ditemukan" action={<Link href="/arsip" className="btn btn-secondary">Kembali ke daftar</Link>}>
            Mungkin sudah dihapus atau namanya berubah di spreadsheet.
          </EmptyState>
        </>
      ) : editing ? (
        <>
          <PageHeader
            crumbs={[{ href: '/arsip', label: 'Arsip Project' }, { label: project.name }]}
            title="Ubah arsip"
            meta={project.name}
          />
          <ArchiveEditor
            schema={schema}
            initial={{ name: project.name, year: project.year, modules: project.modules }}
            saving={saving}
            error={saveError}
            submitLabel="Simpan perubahan"
            onSubmit={handleSave}
            onCancel={() => { setEditing(false); setSaveError(''); }}
          />
        </>
      ) : (
        <>
          <PageHeader
            crumbs={[{ href: '/arsip', label: 'Arsip Project' }, { label: project.name }]}
            title={project.name}
            meta={<>Selesai tahun <b className="text-ink font-semibold tnum">{project.year || '-'}</b> · <span className="tnum">{modules.length}</span> modul tercatat · <span className="tnum">{modules.filter((m) => m.detail).length}</span> dengan detail spesifikasi</>}
            actions={
              <>
                <RefreshStatus refreshing={refreshing} staleError={staleError} />
                {deletable && <button type="button" className="btn btn-ghost text-rust" onClick={() => setConfirmDelete(true)}>Hapus</button>}
                {writable && <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>Ubah arsip</button>}
              </>
            }
          />

          <Panel title="Alur teknologi" hint="Urut dari air baku sampai air produk. Klik sebuah modul untuk melihat spesifikasinya.">
            <TechFlow modules={modules} selectedKey={selected} onSelect={setSelected} />
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6 items-start">
            <Panel title="Semua modul" flush>
              <ul className="divide-y divide-line" role="listbox" aria-label="Pilih modul">
                {modules.map((m) => {
                  const on = m.key === selected;
                  const cap = formatCapacity(m.cap, m.unit);
                  return (
                    <li key={m.key}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={on}
                        onClick={() => setSelected(m.key)}
                        className={`w-full text-left grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-5 py-2.5 transition-colors ${on ? 'bg-blueprint/[0.06] shadow-[inset_3px_0_0_rgb(var(--color-blueprint))]' : 'hover:bg-canvas'}`}
                      >
                        <span className="min-w-0">
                          <span className={`block text-sm truncate ${on ? 'font-semibold text-blueprint' : 'font-medium text-ink'}`}>{moduleLabel(m)}</span>
                          <span className="block text-xs text-inkmute truncate mt-0.5">{m.detail ? m.detail.split('\n')[0] : 'Tanpa detail'}</span>
                        </span>
                        <span className="font-data tnum text-xs text-ink self-center">{cap || <span className="text-inkmute">-</span>}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            <div className="lg:sticky lg:top-6" aria-live="polite">
              {sel ? (
                <Panel
                  title={moduleLabel(sel)}
                  aside={formatCapacity(sel.cap, sel.unit) && <span className="font-data tnum text-sm font-semibold text-blueprint">{formatCapacity(sel.cap, sel.unit)}</span>}
                >
                  {sel.detail ? (
                    <pre className="whitespace-pre-wrap break-words font-data text-xs leading-relaxed text-ink bg-canvas border border-line rounded-lg p-4">{sel.detail}</pre>
                  ) : (
                    <p className="text-sm text-inkmute">Belum ada detail spesifikasi untuk modul ini di arsip.</p>
                  )}
                </Panel>
              ) : (
                <EmptyState title="Pilih modul">Klik modul di alur atau di daftar untuk melihat spesifikasinya.</EmptyState>
              )}
            </div>
          </div>

          {similar.length > 0 && (
            <Panel title="Project arsip yang mirip" hint="Berdasarkan kesamaan modul teknologi." flush>
              <ul className="divide-y divide-line">
                {similar.map(({ project: p, score }) => (
                  <li key={p.id}>
                    <Link href={`/arsip/${encodeURIComponent(p.id)}`} className="group flex items-center justify-between gap-4 px-5 py-3 hover:bg-canvas transition-colors">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink group-hover:text-blueprint truncate">{p.name}</span>
                        <span className="block text-xs text-inkmute mt-0.5 tnum">{p.year}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="w-16 h-1.5 rounded-full bg-line/70 overflow-hidden" aria-hidden="true">
                          <span className="block h-full rounded-full bg-blueprint" style={{ width: `${Math.round(score * 100)}%` }} />
                        </span>
                        <span className="font-data tnum text-xs text-ink w-9 text-right">{Math.round(score * 100)}%</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}

      <ConfirmModal
        open={confirmDelete}
        title="Hapus project arsip ini?"
        description={project ? `"${project.name}" akan dihapus dari tab [ARSIP] di spreadsheet. Isinya tetap tercatat di tab Aktivitas, tetapi tidak dapat dipulihkan dari web.` : ''}
        confirmText="Ya, hapus"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
