import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import useCachedResource from '../../../lib/useCachedResource';
import useProjects from '../../../lib/useProjects';
import { canWrite } from '../../../lib/roles';
import { gudangApi, BOM_STATUS, fmtWaktu } from '../../../lib/gudang';
import PageHead from '../../../components/PageHead';
import RefreshStatus from '../../../components/RefreshStatus';
import { SkeletonTable } from '../../../components/Skeleton';
import PageHeader from '../../../components/ui/PageHeader';
import Panel from '../../../components/ui/Panel';
import Segmented from '../../../components/ui/Segmented';
import SearchField from '../../../components/ui/SearchField';
import EmptyState from '../../../components/ui/EmptyState';
import StatusDot from '../../../components/gudang/StatusDot';
import BomCreateForm from '../../../components/gudang/BomCreateForm';

const SCOPES = [
  { key: 'aktif', label: 'Aktif', test: (b) => b.status !== 'diganti' },
  { key: 'draf', label: 'Draf', test: (b) => b.status === 'draf' },
  { key: 'final', label: 'Diterbitkan', test: (b) => b.status === 'final' },
  { key: 'semua', label: 'Semua revisi', test: () => true },
];

// Daftar BOM per project. BOM yang diterbitkan menjadi dasar cek stok (dan nanti usulan pembelian).
export default function BomList() {
  const router = useRouter();
  const { data: session } = useSession();
  const writable = canWrite(session?.user?.role || 'admin'); // pengecekan sebenarnya di server
  const { data, error, staleError, refreshing } = useCachedResource('gudang-bom', () => gudangApi.listBom());
  const { projects } = useProjects();
  const [scope, setScope] = useState('aktif');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [projectFilter, setProjectFilter] = useState('');

  // ?project=prj_xxx menyaring per project; ?baru=1 langsung membuka form (mis. dari halaman project).
  useEffect(() => {
    if (!router.isReady) return;
    const p = typeof router.query.project === 'string' ? router.query.project : '';
    setProjectFilter(p);
    if (router.query.baru === '1' && writable) setCreating(true);
  }, [router.isReady, router.query.project, router.query.baru, writable]);

  const list = data || [];
  const groups = useMemo(() => {
    const t = SCOPES.find((s) => s.key === scope).test;
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const g = new Map();
    list
      .filter((b) => t(b) && (!projectFilter || b.project_id === projectFilter))
      .filter((b) => {
        if (!words.length) return true;
        const s = `${b.project_nama} ${b.judul}`.toLowerCase();
        return words.every((w) => s.includes(w));
      })
      .forEach((b) => {
        if (!g.has(b.project_id)) g.set(b.project_id, { id: b.project_id, nama: b.project_nama, items: [], latest: '' });
        const grp = g.get(b.project_id);
        grp.items.push(b);
        if (b.diubah_pada > grp.latest) grp.latest = b.diubah_pada;
      });
    return Array.from(g.values())
      .map((grp) => ({ ...grp, items: grp.items.sort((a, b) => a.judul.localeCompare(b.judul) || b.revisi - a.revisi) }))
      .sort((a, b) => String(b.latest).localeCompare(String(a.latest)));
  }, [list, scope, query, projectFilter]);

  const filteredProjectName = projectFilter
    ? list.find((b) => b.project_id === projectFilter)?.project_nama || (projects || []).find((p) => p.id === projectFilter)?.projectName || projectFilter
    : '';

  const header = (
    <PageHeader
      title="BOM Project"
      meta="Daftar material per project. Setiap barang memakai kode Katalog Barang, jadi stok gudang langsung terlihat cukup atau kurang."
      actions={
        <>
          <RefreshStatus refreshing={refreshing && !!data} staleError={staleError} />
          {writable && data && !creating && (
            <button type="button" onClick={() => setCreating(true)} className="btn btn-primary">Buat BOM</button>
          )}
        </>
      }
    />
  );

  if (error && !data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="BOM Project" />
        {header}
        <div className="bg-panel border border-line rounded-xl p-6 text-rust" role="alert">Gagal memuat BOM: {error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="BOM Project" />
        {header}
        <SkeletonTable rows={5} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="BOM Project" />
      {header}

      {creating && (
        <BomCreateForm
          projects={projects}
          boms={list}
          defaultProjectId={projectFilter}
          onCancel={() => setCreating(false)}
          onCreated={(id) => router.push(`/gudang/bom/${id}`)}
        />
      )}

      {list.length > 0 && (
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <SearchField className="w-full lg:w-80" value={query} onChange={setQuery} placeholder="Cari project atau judul BOM..." label="Cari BOM" />
          <Segmented label="BOM yang ditampilkan" className="max-md:flex-wrap" value={scope} onChange={setScope} options={SCOPES.map(({ key, label }) => ({ key, label }))} />
          {projectFilter && (
            <span className="text-sm text-inkmute">
              Project: <span className="text-ink">{filteredProjectName}</span>{' '}
              <button type="button" className="tap text-blueprint hover:underline" onClick={() => { setProjectFilter(''); router.replace('/gudang/bom', undefined, { shallow: true }); }}>
                Lihat semua
              </button>
            </span>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          title="Belum ada BOM"
          action={writable && !creating && <button type="button" onClick={() => setCreating(true)} className="btn btn-primary">Buat BOM pertama</button>}
        >
          BOM bisa dimulai dari salinan BOM lama project yang mirip (semua BOM di Dropbox sudah diimpor), lalu disesuaikan.
        </EmptyState>
      ) : groups.length === 0 ? (
        <EmptyState title="Tidak ada BOM yang cocok">Ubah pencarian atau pilihan di atas.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <Panel
              key={g.id}
              title={g.nama}
              aside={<Link href={`/projects/${encodeURIComponent(g.id)}`} className="tap text-sm font-medium text-blueprint hover:underline">Buka project</Link>}
              flush
            >
              <ul className="divide-y divide-line">
                {g.items.map((b) => (
                  <li key={b.id}>
                    <Link href={`/gudang/bom/${b.id}`} className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-1.5 px-5 py-3.5 hover:bg-canvas/50">
                      <span className="min-w-0 flex-1">
                        <span className="block text-ink font-medium">{b.judul} <span className="text-inkmute font-normal">· Rev. {b.revisi}</span></span>
                        <span className="block text-xs text-inkmute mt-0.5 truncate">{b.sumber || '-'} · diubah {fmtWaktu(b.diubah_pada)}</span>
                      </span>
                      <span className="flex items-center justify-between sm:justify-end gap-6">
                        <span className="text-sm tnum text-ink whitespace-nowrap">{b.jumlah_baris} baris</span>
                        <span className="sm:w-40"><StatusDot status={BOM_STATUS[b.status]} /></span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
