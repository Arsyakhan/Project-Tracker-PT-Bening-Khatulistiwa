import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { canWrite } from '../../../lib/roles';
import useCachedResource from '../../../lib/useCachedResource';
import { gudangApi, statusCekInfo, barangSearchText, fmtQty, reviewFlags, FLAG_PENAWARAN, addToKatalogCache } from '../../../lib/gudang';
import PageHead from '../../../components/PageHead';
import RefreshStatus from '../../../components/RefreshStatus';
import { SkeletonTable } from '../../../components/Skeleton';
import PageHeader from '../../../components/ui/PageHeader';
import StatStrip from '../../../components/ui/StatStrip';
import Panel from '../../../components/ui/Panel';
import Segmented from '../../../components/ui/Segmented';
import SearchField from '../../../components/ui/SearchField';
import EmptyState from '../../../components/ui/EmptyState';
import BarangBaruForm from '../../../components/gudang/BarangBaruForm';

const PAGE = 60;

const STATUS_FILTERS = [
  { key: 'belum', label: 'Belum dicek', hint: 'Urut dari yang paling sering dipakai', test: (b) => !b.status_cek, tone: 'amber' },
  { key: 'ok', label: 'OK', hint: 'Siap dipakai di BOM dan stok', test: (b) => b.status_cek === 'OK', tone: 'teal' },
  { key: 'tindak', label: 'Perlu tindakan', hint: 'Diubah, digabung, atau dihapus', test: (b) => ['Ubah', 'Gabung', 'Hapus'].includes(b.status_cek), tone: 'rust' },
];

const SCOPES = [
  { key: 'project', label: 'Pernah dipakai project', test: (b) => b.dipakai_project > 0 },
  { key: 'stok', label: 'Ada stok', test: (b) => Number(b.stok) !== 0 },
  { key: 'all', label: 'Semua', test: () => true },
  { key: 'flag', label: 'Ditandai saat impor', test: (b) => reviewFlags(b).length > 0 },
];

const TONE_TEXT = { muted: 'text-inkmute', teal: 'text-teal', amber: 'text-amberink', rust: 'text-rust' };
const TONE_DOT = { muted: 'bg-inkmute/50', teal: 'bg-teal', amber: 'bg-amber', rust: 'bg-rust' };

function StatusCek({ b }) {
  const s = statusCekInfo(b.status_cek);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap ${TONE_TEXT[s.tone]}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${TONE_DOT[s.tone]}`} aria-hidden="true" />
      {b.status_cek === 'Gabung' && b.gabung_ke ? `Gabung ke ${b.gabung_ke}` : s.label}
    </span>
  );
}

// Kolom "Dipakai": jumlah project lama, "penawaran" kalau hanya muncul di BOQ, "-" untuk barang baru dari web.
function usage(b) {
  if (b.dipakai_project > 0) return `${b.dipakai_project} project`;
  return (b.perlu_dicek || []).includes(FLAG_PENAWARAN) ? 'penawaran' : '-';
}

function detailLine(b) {
  return [b.spesifikasi, b.merek].filter(Boolean).join(' · ');
}

// Katalog barang (Supabase): daftar induk alat dan material dari semua BOM lama. Dicek W&P/Engineering lewat kolom
// "Status cek"; kodenya dipakai untuk BOM, stok, dan pengadaan.
export default function KatalogBarang() {
  const router = useRouter();
  const { data: session } = useSession();
  const writable = canWrite(session?.user?.role || 'admin'); // pengecekan sebenarnya di server
  const { data, error, staleError, refreshing, mutate } = useCachedResource('gudang-katalog', () => gudangApi.getKatalog());
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [kategori, setKategori] = useState('');
  const [scope, setScope] = useState('project');
  const [statusFilter, setStatusFilter] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const barang = data?.barang || [];
  const kategoriList = data?.kategori || [];
  const katNama = useMemo(() => Object.fromEntries(kategoriList.map((k) => [k.kode, k.nama])), [kategoriList]);

  const inScope = useMemo(() => {
    const t = SCOPES.find((s) => s.key === scope).test;
    return barang.filter((b) => t(b) && (!kategori || b.kategori_kode === kategori));
  }, [barang, scope, kategori]);

  const counts = useMemo(() => Object.fromEntries(STATUS_FILTERS.map((f) => [f.key, inScope.filter(f.test).length])), [inScope]);

  const rows = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const f = STATUS_FILTERS.find((x) => x.key === statusFilter);
    return inScope
      .filter((b) => !f || f.test(b))
      .filter((b) => {
        if (!words.length) return true;
        const t = barangSearchText(b);
        return words.every((w) => t.includes(w));
      })
      // Yang paling sering dipakai project di atas: paling penting dicek dan disiapkan stoknya.
      .sort((a, b) => (b.dipakai_project || 0) - (a.dipakai_project || 0) || a.kode.localeCompare(b.kode));
  }, [inScope, query, statusFilter]);

  const kategoriCounts = useMemo(() => {
    const t = SCOPES.find((s) => s.key === scope).test;
    const c = {};
    barang.forEach((b) => { if (t(b)) c[b.kategori_kode] = (c[b.kategori_kode] || 0) + 1; });
    return c;
  }, [barang, scope]);

  const resetLimit = (fn) => (v) => { fn(v); setLimit(PAGE); };

  const header = (
    <PageHeader
      title="Katalog Barang"
      meta="Daftar induk alat dan material dari semua BOM lama. Kode barang dipakai untuk BOM, stok gudang, dan pengadaan."
      actions={
        <>
          <RefreshStatus refreshing={refreshing && !!data} staleError={staleError} />
          {writable && data && !adding && (
            <button type="button" onClick={() => setAdding(true)} className="btn btn-secondary">Tambah barang</button>
          )}
        </>
      }
    />
  );

  if (error && !data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Katalog Barang" />
        {header}
        <div className="bg-panel border border-line rounded-xl p-6 text-rust" role="alert">Gagal memuat katalog: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Katalog Barang" />
        {header}
        <div className="skeleton-shimmer rounded-xl h-[84px]" />
        <SkeletonTable rows={8} />
      </div>
    );
  }

  const visible = rows.slice(0, limit);

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Katalog Barang" />
      {header}

      {adding && (
        <Panel>
          <BarangBaruForm
            kategori={kategoriList}
            katalog={barang}
            namaAwal={query}
            onCancel={() => setAdding(false)}
            onPickExisting={(b) => router.push(`/gudang/katalog/${b.kode}`)}
            onCreated={(b) => {
              addToKatalogCache(b);
              mutate((d) => (d ? { ...d, barang: [...d.barang, { ...b, stok: 0 }] } : d));
              router.push(`/gudang/katalog/${b.kode}`);
            }}
          />
        </Panel>
      )}

      <StatStrip
        label="Status pemeriksaan katalog"
        items={[
          { key: 'total', label: 'Barang ditampilkan', value: inScope.length, tone: 'ink', hint: `dari ${barang.length} di katalog` },
          ...STATUS_FILTERS.map((f) => ({
            key: f.key,
            label: f.label,
            value: counts[f.key],
            tone: f.tone,
            hint: statusFilter === f.key ? 'Klik lagi untuk semua status' : f.hint,
            active: statusFilter === f.key,
            dim: !!statusFilter && statusFilter !== f.key,
            onClick: () => { setStatusFilter((v) => (v === f.key ? '' : f.key)); setLimit(PAGE); },
          })),
        ]}
      />

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <SearchField
          className="w-full lg:w-80"
          value={query}
          onChange={resetLimit(setQuery)}
          placeholder="Cari kode, nama, ukuran, model..."
          label="Cari barang di katalog"
        />
        <select
          className="input lg:!w-64 !min-h-[36px] max-md:!min-h-[40px] !py-1"
          aria-label="Kategori barang"
          value={kategori}
          onChange={(e) => resetLimit(setKategori)(e.target.value)}
        >
          <option value="">Semua kategori</option>
          {kategoriList.map((k) => (
            <option key={k.kode} value={k.kode}>{k.nama} ({kategoriCounts[k.kode] || 0})</option>
          ))}
        </select>
        <Segmented
          label="Barang yang ditampilkan"
          className="max-md:flex-wrap"
          value={scope}
          onChange={resetLimit(setScope)}
          options={SCOPES.map((s) => ({ key: s.key, label: s.label }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Tidak ada barang yang cocok">
          Ubah pencarian, kategori, atau pilihan di atas. Barang yang hanya muncul di penawaran atau baru ditambahkan ada di pilihan &ldquo;Semua&rdquo;.
        </EmptyState>
      ) : (
        <Panel flush>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Daftar barang di katalog</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-inkmute">
                  <th scope="col" className="px-5 py-3 font-medium">Kode</th>
                  <th scope="col" className="px-3 py-3 font-medium min-w-[16rem]">Barang</th>
                  <th scope="col" className="px-3 py-3 font-medium">Ukuran</th>
                  <th scope="col" className="px-3 py-3 font-medium">Material</th>
                  <th scope="col" className="px-3 py-3 font-medium">Model</th>
                  <th scope="col" className="px-3 py-3 font-medium text-right" title="Jumlah project lama yang memakai barang ini di BOM-nya">Dipakai</th>
                  <th scope="col" className="px-3 py-3 font-medium text-right">Stok</th>
                  <th scope="col" className="px-5 py-3 font-medium">Status cek</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((b) => (
                  <tr key={b.kode} className="align-top hover:bg-canvas/50 transition-colors">
                    <td className="px-5 py-3 font-data text-xs text-inkmute whitespace-nowrap">{b.kode}</td>
                    <td className="px-3 py-3">
                      <Link href={`/gudang/katalog/${b.kode}`} className="font-medium text-ink hover:text-blueprint">
                        {b.nama}
                      </Link>
                      <span className="block text-xs text-inkmute mt-0.5 line-clamp-1 max-w-[28rem]">
                        {katNama[b.kategori_kode]}{detailLine(b) ? ` · ${detailLine(b)}` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{b.ukuran || <span className="text-inkmute">-</span>}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{b.material || <span className="text-inkmute">-</span>}</td>
                    <td className="px-3 py-3 font-data text-xs max-w-[12rem] truncate" title={b.model || ''}>{b.model || <span className="text-inkmute">-</span>}</td>
                    <td className="px-3 py-3 text-right tnum whitespace-nowrap">
                      {b.dipakai_project > 0 ? usage(b) : <span className="text-inkmute">{usage(b)}</span>}
                    </td>
                    <td className="px-3 py-3 text-right tnum whitespace-nowrap">
                      {b.stok ? `${fmtQty(b.stok)} ${b.satuan}` : <span className="text-inkmute">-</span>}
                    </td>
                    <td className="px-5 py-3"><StatusCek b={b} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden divide-y divide-line">
            {visible.map((b) => (
              <li key={b.kode}>
                <Link href={`/gudang/katalog/${b.kode}`} className="block px-4 py-3.5 hover:bg-canvas/50">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">{b.nama}</span>
                      <span className="block text-xs text-inkmute mt-0.5">
                        <span className="font-data">{b.kode}</span>
                        {[b.ukuran, b.material, b.model].filter(Boolean).length ? ` · ${[b.ukuran, b.material, b.model].filter(Boolean).join(' · ')}` : ''}
                      </span>
                    </span>
                    <span className="text-xs text-inkmute tnum whitespace-nowrap">
                      {usage(b)}
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-3 mt-2">
                    <StatusCek b={b} />
                    {b.stok ? <span className="text-xs tnum">Stok {fmtQty(b.stok)} {b.satuan}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-line text-sm text-inkmute">
            <span className="tnum" aria-live="polite">Menampilkan {visible.length} dari {rows.length} barang</span>
            {rows.length > limit && (
              <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="btn btn-secondary">
                Tampilkan {Math.min(PAGE, rows.length - limit)} lagi
              </button>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
