import { useMemo, useState } from 'react';
import Link from 'next/link';
import useCachedResource from '../../../lib/useCachedResource';
import { gudangApi, USULAN_STATUS, nomorUsulan, fmtRupiah, fmtWaktu, tahapPengadaan } from '../../../lib/gudang';
import PageHead from '../../../components/PageHead';
import RefreshStatus from '../../../components/RefreshStatus';
import { SkeletonTable } from '../../../components/Skeleton';
import PageHeader from '../../../components/ui/PageHeader';
import Panel from '../../../components/ui/Panel';
import StatStrip from '../../../components/ui/StatStrip';
import SearchField from '../../../components/ui/SearchField';
import EmptyState from '../../../components/ui/EmptyState';
import StatusDot from '../../../components/gudang/StatusDot';

// Yang menunggu keputusan di atas, lalu draf, lalu yang sudah diputuskan; di dalamnya yang terbaru dulu.
const URUTAN = { diajukan: 0, draf: 1, disetujui: 2, ditolak: 3 };

// Daftar usulan pembelian: kekurangan stok dari BOM yang diterbitkan, diajukan ke Direksi sebelum W&P memesan.
export default function UsulanList() {
  const { data, error, staleError, refreshing } = useCachedResource('gudang-usulan', () => gudangApi.listUsulan());
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');

  const list = data?.usulan || [];
  const bisaMemutuskan = !!data?.bisaMemutuskan;
  const count = useMemo(() => {
    const c = { draf: 0, diajukan: 0, disetujui: 0, ditolak: 0 };
    list.forEach((u) => { c[u.status] = (c[u.status] || 0) + 1; });
    return c;
  }, [list]);

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return list
      .filter((u) => !status || u.status === status)
      .filter((u) => {
        if (!words.length) return true;
        const s = `${nomorUsulan(u.id)} ${u.project_nama} ${u.bom?.judul || ''}`.toLowerCase();
        return words.every((w) => s.includes(w));
      })
      .sort((a, b) => URUTAN[a.status] - URUTAN[b.status] || b.id - a.id);
  }, [list, status, query]);

  const pick = (key) => setStatus((s) => (s === key ? '' : key));

  const header = (
    <PageHeader
      title="Usulan Pembelian"
      meta="Kekurangan stok dari BOM yang diterbitkan. Engineering atau W&P mengajukan, lalu Direksi menyetujui sebelum barang dipesan."
      actions={<RefreshStatus refreshing={refreshing && !!data} staleError={staleError} />}
    />
  );

  if (error && !data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Usulan Pembelian" />
        {header}
        <div className="bg-panel border border-line rounded-xl p-6 text-rust" role="alert">Gagal memuat usulan pembelian: {error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Usulan Pembelian" />
        {header}
        <SkeletonTable rows={4} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Usulan Pembelian" />
      {header}

      <StatStrip
        label="Status usulan pembelian"
        items={[
          {
            key: 'diajukan', label: 'Menunggu persetujuan', value: count.diajukan, tone: 'blueprint', dim: !count.diajukan,
            hint: bisaMemutuskan && count.diajukan ? 'Perlu keputusan Anda' : 'Di Direksi', onClick: () => pick('diajukan'), active: status === 'diajukan',
          },
          { key: 'draf', label: 'Draf', value: count.draf, tone: 'amber', dim: !count.draf, hint: 'Belum diajukan', onClick: () => pick('draf'), active: status === 'draf' },
          { key: 'disetujui', label: 'Disetujui', value: count.disetujui, tone: 'teal', dim: !count.disetujui, hint: 'Siap dipesan W&P', onClick: () => pick('disetujui'), active: status === 'disetujui' },
          { key: 'ditolak', label: 'Ditolak', value: count.ditolak, tone: 'rust', dim: !count.ditolak, hint: 'Bisa diusulkan ulang dari BOM', onClick: () => pick('ditolak'), active: status === 'ditolak' },
        ]}
      />

      {list.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <SearchField className="w-full sm:w-80" value={query} onChange={setQuery} placeholder="Cari nomor, project, atau BOM..." label="Cari usulan pembelian" />
          {status && (
            <span className="text-sm text-inkmute">
              Status: <span className="text-ink">{USULAN_STATUS[status].label}</span>{' '}
              <button type="button" className="tap text-blueprint hover:underline" onClick={() => setStatus('')}>Lihat semua</button>
            </span>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState title="Belum ada usulan pembelian" action={<Link href="/gudang/bom" className="btn btn-secondary">Buka BOM Project</Link>}>
          Usulan dibuat dari BOM yang sudah diterbitkan: buka BOM-nya, lalu pilih "Sisihkan stok & usulkan pembelian". Stok yang
          tersedia disisihkan untuk project itu, dan kekurangannya menjadi usulan di sini.
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState title="Tidak ada usulan yang cocok">Ubah pencarian atau pilihan status di atas.</EmptyState>
      ) : (
        <Panel flush>
          <ul className="divide-y divide-line">
            {shown.map((u) => (
              <li key={u.id}>
                <Link href={`/gudang/usulan/${u.id}`} className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-1.5 px-5 py-3.5 hover:bg-canvas/50">
                  <span className="min-w-0 flex-1">
                    <span className="block text-ink font-medium truncate">
                      <span className="font-data text-inkmute font-normal mr-2">{nomorUsulan(u.id)}</span>
                      {u.project_nama}
                    </span>
                    <span className="block text-xs text-inkmute mt-0.5 truncate">
                      {u.bom ? `${u.bom.judul} Rev. ${u.bom.revisi}` : 'BOM'} · {u.jumlah_barang} barang ·{' '}
                      {u.status === 'diajukan'
                        ? `diajukan ${fmtWaktu(u.diajukan_pada)}`
                        : u.diputuskan_pada
                          ? `diputuskan ${fmtWaktu(u.diputuskan_pada)}`
                          : u.dikembalikan_pada
                            ? <span className="text-amberink">dikembalikan untuk dilengkapi {fmtWaktu(u.dikembalikan_pada)}</span>
                            : `diubah ${fmtWaktu(u.diubah_pada)}`}
                    </span>
                  </span>
                  <span className="flex items-center justify-between sm:justify-end gap-6">
                    <span className="text-sm tnum whitespace-nowrap sm:text-right">
                      {u.estimasi > 0 ? <span className="text-ink">{fmtRupiah(u.estimasi)}</span> : <span className="text-inkmute">Belum ada harga</span>}
                      {u.estimasi > 0 && u.tanpa_harga > 0 && <span className="block text-xs text-amberink">{u.tanpa_harga} barang tanpa harga</span>}
                    </span>
                    <span className="sm:w-48 flex flex-col items-end sm:items-start gap-0.5">
                      <StatusDot status={USULAN_STATUS[u.status]} />
                      {/* Usulan yang disetujui: tahap pemesanan dan penerimaan barang */}
                      {tahapPengadaan(u, u) && <StatusDot status={tahapPengadaan(u, u)} />}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
