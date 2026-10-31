import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { canWrite } from '../../../lib/roles';
import useCachedResource from '../../../lib/useCachedResource';
import { clearCache } from '../../../lib/persistedCache';
import { gudangApi, nomorSerahTerima } from '../../../lib/gudang';
import PageHead from '../../../components/PageHead';
import RefreshStatus from '../../../components/RefreshStatus';
import { SkeletonTable } from '../../../components/Skeleton';
import PageHeader from '../../../components/ui/PageHeader';
import Panel from '../../../components/ui/Panel';
import SearchField from '../../../components/ui/SearchField';
import EmptyState from '../../../components/ui/EmptyState';
import StokTabs from '../../../components/gudang/StokTabs';
import SerahTerimaForm from '../../../components/gudang/SerahTerimaForm';

const fmtTgl = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

// Daftar serah terima barang ke teknisi (barang keluar dari gudang untuk project). ?baru=1&project=prj_xxx membuka form.
export default function SerahTerimaList() {
  const router = useRouter();
  const { data: session } = useSession();
  const writable = canWrite(session?.user?.role || 'admin'); // pengecekan sebenarnya di server
  const { data, error, staleError, refreshing } = useCachedResource('gudang-serah-terima', () => gudangApi.listSerahTerima());
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (router.isReady && router.query.baru === '1' && writable) setCreating(true);
  }, [router.isReady, router.query.baru, writable]);

  const list = data || [];
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const project = typeof router.query.project === 'string' ? router.query.project : '';
    return list
      .filter((s) => !project || s.project_id === project)
      .filter((s) => !words.length || words.every((w) => `${nomorSerahTerima(s.id)} ${s.project_nama} ${s.penerima}`.toLowerCase().includes(w)));
  }, [list, query, router.query.project]);

  const header = (
    <PageHeader
      title="Stok Gudang"
      meta="Serahkan barang yang sudah disisihkan untuk project ke teknisi. Bisa bertahap; tanggung jawab barang ada di W&P sampai diserahkan."
      nav={<StokTabs active="serah" />}
      actions={
        <>
          <RefreshStatus refreshing={refreshing && !!data} staleError={staleError} />
          {writable && data && !creating && <button type="button" onClick={() => setCreating(true)} className="btn btn-primary">Buat serah terima</button>}
        </>
      }
    />
  );

  if (error && !data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Serah Terima" />
        {header}
        <div className="bg-panel border border-line rounded-xl p-6 text-rust" role="alert">Gagal memuat serah terima: {error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Serah Terima" />
        {header}
        <SkeletonTable rows={4} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Serah Terima" />
      {header}

      {creating && (
        <SerahTerimaForm
          defaultProject={typeof router.query.project === 'string' ? router.query.project : ''}
          onCancel={() => setCreating(false)}
          onCreated={(id) => { clearCache('gudang-serah-terima'); clearCache('gudang-katalog'); router.push(`/gudang/serah-terima/${id}`); }}
        />
      )}

      {list.length > 0 && (
        <SearchField className="w-full sm:w-80" value={query} onChange={setQuery} placeholder="Cari nomor, project, atau teknisi..." label="Cari serah terima" />
      )}

      {list.length === 0 ? (
        <EmptyState title="Belum ada serah terima">
          Barang yang bisa diserahkan adalah yang sudah disisihkan untuk project: lewat tombol &ldquo;Sisihkan stok&rdquo; di halaman BOM,
          atau otomatis saat barang dari usulan pembelian diterima di gudang.
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState title="Tidak ada serah terima yang cocok">Ubah pencarian di atas.</EmptyState>
      ) : (
        <Panel flush>
          <ul className="divide-y divide-line">
            {shown.map((s) => (
              <li key={s.id}>
                <Link href={`/gudang/serah-terima/${s.id}`} className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-1 px-5 py-3.5 hover:bg-canvas/50">
                  <span className="min-w-0 flex-1">
                    <span className="block text-ink font-medium truncate">
                      <span className="font-data text-inkmute font-normal mr-2">{nomorSerahTerima(s.id)}</span>
                      {s.project_nama}
                    </span>
                    <span className="block text-xs text-inkmute mt-0.5">Diterima {s.penerima} · {fmtTgl(s.tanggal)}{s.catatan ? ` · ${s.catatan}` : ''}</span>
                  </span>
                  <span className="text-sm tnum text-ink whitespace-nowrap">{s.jumlah_barang} barang</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
