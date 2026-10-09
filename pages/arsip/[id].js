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

      <nav aria-label="Navigasi" className="text-sm">
        <Link href="/arsip" className="text-blueprint hover:underline">← Arsip Project</Link>
      </nav>

      {error && !projects ? (
        <div className="bg-panel border border-line rounded-lg p-5 text-sm text-rust" role="alert">Gagal memuat arsip: {error}</div>
      ) : !projects ? (
        <div className="flex flex-col gap-3">
          <div className="skeleton-shimmer rounded-lg h-16 w-2/3" />
          <div className="skeleton-shimmer rounded-lg h-40 w-full" />
        </div>
      ) : !project ? (
        <div className="bg-panel border border-line rounded-lg p-8 text-center text-sm text-inkmute">
          Project arsip tidak ditemukan. <Link href="/arsip" className="text-blueprint hover:underline">Kembali ke daftar</Link>
        </div>
      ) : editing ? (
        <>
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Ubah arsip</h1>
            <p className="text-sm text-inkmute mt-1">{project.name}</p>
          </div>
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
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink">{project.name}</h1>
              <p className="text-sm text-inkmute mt-1">
                Selesai tahun <b className="text-ink font-data tnum">{project.year || '-'}</b> · {modules.length} modul tercatat
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <RefreshStatus refreshing={refreshing} staleError={staleError} />
              {writable && <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>Ubah</button>}
              {deletable && <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Hapus</button>}
            </div>
          </div>

          <section className="bg-panel border border-line rounded-lg p-4 sm:p-5 shadow-sm" aria-labelledby="alur-title">
            <h2 id="alur-title" className="font-display font-semibold text-ink mb-1">Alur teknologi</h2>
            <p className="text-xs text-inkmute mb-4">Urut dari air baku sampai air produk. Klik sebuah modul untuk melihat spesifikasinya.</p>
            <TechFlow modules={modules} selectedKey={selected} onSelect={setSelected} />
          </section>

          {sel && (
            <section className="bg-panel border border-line rounded-lg p-4 sm:p-5 shadow-sm" aria-live="polite">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display font-semibold text-ink">{moduleLabel(sel)}</h2>
                {formatCapacity(sel.cap, sel.unit) && (
                  <span className="font-data tnum text-blueprint font-semibold">{formatCapacity(sel.cap, sel.unit)}</span>
                )}
              </div>
              {sel.detail ? (
                <pre className="mt-3 whitespace-pre-wrap break-words font-data text-xs leading-relaxed text-ink bg-canvas border border-line rounded-md p-3">{sel.detail}</pre>
              ) : (
                <p className="text-sm text-inkmute mt-2">Belum ada detail spesifikasi untuk modul ini di arsip.</p>
              )}
            </section>
          )}

          <section className="bg-panel border border-line rounded-lg p-4 sm:p-5 shadow-sm" aria-labelledby="ringkas-title">
            <h2 id="ringkas-title" className="font-display font-semibold text-ink mb-3">Semua modul</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-inkmute border-b border-line">
                    <th className="py-2 pr-4 font-medium">Modul</th>
                    <th className="py-2 pr-4 font-medium">Kapasitas</th>
                    <th className="py-2 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((m) => (
                    <tr key={m.key} className="border-b border-line last:border-0 align-top">
                      <td className="py-2 pr-4 text-ink whitespace-nowrap">
                        <button type="button" onClick={() => setSelected(m.key)} className="text-left hover:text-blueprint hover:underline">{moduleLabel(m)}</button>
                      </td>
                      <td className="py-2 pr-4 font-data tnum text-ink whitespace-nowrap">{formatCapacity(m.cap, m.unit) || <span className="text-inkmute">-</span>}</td>
                      <td className="py-2 text-inkmute">{m.detail ? m.detail.split('\n')[0] : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {similar.length > 0 && (
            <section aria-labelledby="mirip-title">
              <h2 id="mirip-title" className="font-display font-semibold text-ink mb-3">Project arsip yang mirip</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {similar.map(({ project: p, score }) => (
                  <li key={p.id}>
                    <Link href={`/arsip/${encodeURIComponent(p.id)}`} className="block bg-panel border border-line rounded-lg p-3 hover:border-blueprint transition-colors">
                      <span className="block text-sm font-medium text-ink">{p.name}</span>
                      <span className="block text-xs text-inkmute mt-0.5">{p.year} · kemiripan {Math.round(score * 100)}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ConfirmModal
        open={confirmDelete}
        title="Hapus project arsip ini?"
        description={project ? `"${project.name}" akan dihapus dari tab [ARSIP] di spreadsheet. Isinya masih tercatat di tab Aktivitas, tapi tidak bisa dipulihkan dari web.` : ''}
        confirmText="Ya, hapus"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
