import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { canWrite, MSG_VIEWER } from '../../../lib/roles';
import {
  gudangApi, USULAN_STATUS, nomorUsulan, ringkasUsulan, barangLabel, fmtQty, fmtRupiah, fmtRupiahRingkas, fmtWaktu,
} from '../../../lib/gudang';
import { clearCache } from '../../../lib/persistedCache';
import { downloadCsv } from '../../../lib/exportCsv';
import PageHead from '../../../components/PageHead';
import ConfirmModal from '../../../components/ConfirmModal';
import { useToast } from '../../../components/Toast';
import PageHeader from '../../../components/ui/PageHeader';
import Panel from '../../../components/ui/Panel';
import StatStrip from '../../../components/ui/StatStrip';
import EmptyState from '../../../components/ui/EmptyState';
import StatusDot from '../../../components/gudang/StatusDot';

const hasHarga = (l) => l.harga_satuan !== null && l.harga_satuan !== undefined;
const subtotal = (l) => (hasHarga(l) ? Number(l.qty_beli) * Number(l.harga_satuan) : null);
const fmtHargaInput = (v) => (v === null || v === undefined ? '' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 }));

function barangSub(l) {
  const b = l.barang || {};
  return [[b.merek, b.model].filter(Boolean).join(' · '), l.catatan].filter(Boolean).join(' · ');
}

// Form satu baris: jumlah beli, estimasi harga satuan, catatan.
function LineForm({ line, onSave, onCancel, busy, error }) {
  const [qty, setQty] = useState(String(line.qty_beli));
  const [harga, setHarga] = useState(fmtHargaInput(line.harga_satuan));
  const [catatan, setCatatan] = useState(line.catatan || '');
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ qty_beli: qty, harga_satuan: harga, catatan }); }} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-[9rem_12rem_minmax(0,1fr)] gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-inkmute font-medium">Jumlah beli ({line.satuan})</span>
          <input ref={ref} className="input !text-lg font-semibold tnum" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} required autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-inkmute font-medium">Estimasi harga satuan (Rp)</span>
          <input className="input tnum" inputMode="decimal" value={harga} onChange={(e) => setHarga(e.target.value)} placeholder="mis. 1.500.000" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm col-span-2 sm:col-span-1">
          <span className="text-inkmute font-medium">Catatan (opsional)</span>
          <input className="input" value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={300} placeholder="mis. dibulatkan ke kemasan 6 m" />
        </label>
      </div>
      <p className="text-xs text-inkmute -mt-2">
        Kebutuhan BOM {fmtQty(line.qty_butuh)} {line.satuan}, sudah disisihkan dari stok {fmtQty(line.qty_disisihkan)}. Harga boleh dikosongkan jika belum ada penawaran.
      </p>
      {error && <p className="text-sm text-rust -mt-2" role="alert">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn btn-ghost" disabled={busy}>Batal</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan baris'}</button>
      </div>
    </form>
  );
}

// Satu kalimat status di bawah kepala halaman: apa keadaannya dan apa langkah berikutnya.
function StatusNote({ u, bomBerlaku, canEdit, bisaMemutuskan }) {
  if (!bomBerlaku && (u.status === 'draf' || u.status === 'diajukan')) {
    return (
      <p className="text-sm text-amberink">
        BOM usulan ini sudah diganti revisi baru, jadi usulan ini tidak bisa {u.status === 'draf' ? 'diajukan' : 'disetujui'}.{' '}
        <Link href={`/gudang/bom/${u.bom_id}`} className="underline">Buka BOM</Link> untuk melihat revisi terbaru.
      </p>
    );
  }
  if (u.status === 'draf') {
    return <p className="text-sm text-inkmute">{canEdit ? 'Periksa jumlah beli dan isi estimasi harga, lalu ajukan ke Direksi.' : 'Draf ini belum diajukan ke Direksi.'}</p>;
  }
  if (u.status === 'diajukan') {
    return (
      <p className="text-sm text-blueprint">
        {bisaMemutuskan ? 'Usulan ini menunggu keputusan Anda.' : `Menunggu keputusan Direksi sejak ${fmtWaktu(u.diajukan_pada)}.`}
      </p>
    );
  }
  if (u.status === 'disetujui') {
    return (
      <p className="text-sm text-teal">
        Disetujui {fmtWaktu(u.diputuskan_pada)} oleh {u.diputuskan_oleh}. W&P dapat memesan barang di usulan ini.
        {u.catatan_keputusan ? ` Catatan: ${u.catatan_keputusan}` : ''}
      </p>
    );
  }
  return (
    <p className="text-sm text-rust">
      Ditolak {fmtWaktu(u.diputuskan_pada)} oleh {u.diputuskan_oleh}. Alasan: {u.catatan_keputusan}{' '}
      {bomBerlaku && <Link href={`/gudang/bom/${u.bom_id}`} className="underline">Buka BOM untuk mengusulkan ulang</Link>}
    </p>
  );
}

export default function UsulanDetail() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const { data: session } = useSession();
  const writable = canWrite(session?.user?.role || 'admin'); // pengecekan sebenarnya di server
  const { showToast } = useToast();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // id baris yang sedang diubah
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: 'ajukan' | 'hapus' | 'line' | 'setujui' | 'tolak', line }
  const [acting, setActing] = useState(false);
  const [keputusan, setKeputusan] = useState('');
  const [info, setInfo] = useState(null); // catatan usulan saat diubah

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setData(await gudangApi.getUsulan(id));
      setError(null);
    } catch (e) {
      setError({ message: e.message, notFound: e.status === 404 });
    }
  }, [id]);
  useEffect(() => { setData(null); load(); }, [load]);

  const lines = data?.baris || [];
  const sum = useMemo(() => ringkasUsulan(lines), [lines]);
  const nSebagian = lines.filter((l) => Number(l.qty_disisihkan) > 0).length;

  async function saveLine(values) {
    if (!editing || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const line = await gudangApi.saveUsulanLine({ usulan_id: data.usulan.id, id: editing, ...values });
      setData((d) => ({ ...d, baris: d.baris.map((l) => (l.id === line.id ? line : l)) }));
      clearCache('gudang-usulan');
      showToast(`${line.barang_kode} diperbarui`);
      setEditing(null);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveInfo(e) {
    e.preventDefault();
    if (acting) return;
    setActing(true);
    try {
      const usulan = await gudangApi.updateUsulan({ id: data.usulan.id, catatan: info });
      setData((d) => ({ ...d, usulan: { ...d.usulan, ...usulan } }));
      setInfo(null);
      clearCache('gudang-usulan');
      showToast('Catatan usulan disimpan');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActing(false);
    }
  }

  async function runConfirm() {
    if (!confirm || acting) return;
    setActing(true);
    const c = confirm;
    const nomor = nomorUsulan(data.usulan.id);
    try {
      if (c.kind === 'line') {
        await gudangApi.deleteUsulanLine({ usulan_id: data.usulan.id, id: c.line.id });
        setData((d) => ({ ...d, baris: d.baris.filter((l) => l.id !== c.line.id) }));
        showToast(`${c.line.barang_kode} dihapus dari usulan`);
      } else if (c.kind === 'hapus') {
        await gudangApi.deleteUsulan({ id: data.usulan.id });
        clearCache('gudang-usulan');
        showToast(`Draf ${nomor} dihapus`);
        router.push('/gudang/usulan');
        return;
      } else if (c.kind === 'ajukan') {
        await gudangApi.ajukanUsulan({ id: data.usulan.id });
        showToast(`${nomor} diajukan ke Direksi`);
        await load();
      } else if (c.kind === 'setujui' || c.kind === 'tolak') {
        await gudangApi.putuskanUsulan({ id: data.usulan.id, setuju: c.kind === 'setujui', catatan: keputusan });
        showToast(c.kind === 'setujui' ? `${nomor} disetujui` : `${nomor} ditolak`);
        setKeputusan('');
        await load();
      }
      clearCache('gudang-usulan');
      setConfirm(null);
    } catch (e) {
      showToast(e.message, 'error');
      setConfirm(null);
      load();
    } finally {
      setActing(false);
    }
  }

  function exportCsv() {
    const u = data.usulan;
    const safe = `${nomorUsulan(u.id)} ${u.project_nama}`.replace(/[^A-Za-z0-9 _.-]+/g, '').trim().replace(/\s+/g, '_');
    downloadCsv(`Usulan_Pembelian_${safe}.csv`, [
      ['No', (l) => l._no],
      ['Kode', (l) => l.barang_kode],
      ['Nama barang', (l) => l.barang?.nama],
      ['Ukuran', (l) => l.barang?.ukuran],
      ['Material', (l) => l.barang?.material],
      ['Merek', (l) => l.barang?.merek],
      ['Model', (l) => l.barang?.model],
      ['Kebutuhan BOM', (l) => Number(l.qty_butuh)],
      ['Disisihkan dari stok', (l) => Number(l.qty_disisihkan)],
      ['Jumlah beli', (l) => Number(l.qty_beli)],
      ['Satuan', (l) => l.satuan],
      ['Estimasi harga satuan (Rp)', (l) => (hasHarga(l) ? Number(l.harga_satuan) : '')],
      ['Subtotal (Rp)', (l) => (hasHarga(l) ? subtotal(l) : '')],
      ['Catatan', (l) => l.catatan],
    ], lines.map((l, i) => ({ ...l, _no: i + 1 })));
  }

  const crumbs = [{ href: '/gudang/usulan', label: 'Usulan Pembelian' }, { label: data ? nomorUsulan(data.usulan.id) : '...' }];

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Usulan Pembelian" />
        <PageHeader crumbs={crumbs} title="Usulan Pembelian" />
        <div className="bg-panel border border-line rounded-xl p-6 flex flex-col gap-3" role="alert">
          <p className="text-rust text-sm">{error.message}</p>
          <div>
            {error.notFound ? (
              <Link href="/gudang/usulan" className="btn btn-secondary">Kembali ke Usulan Pembelian</Link>
            ) : (
              <button type="button" onClick={load} className="btn btn-secondary">Coba lagi</button>
            )}
          </div>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Usulan Pembelian" />
        <PageHeader crumbs={crumbs} title="Usulan Pembelian" meta="Memuat usulan..." />
        <div className="skeleton-shimmer rounded-xl h-[84px]" />
        <div className="skeleton-shimmer rounded-xl h-64" />
      </div>
    );
  }

  const { usulan: u, riwayat, bisaMemutuskan } = data;
  const nomor = nomorUsulan(u.id);
  const bomBerlaku = u.bom?.status === 'final';
  const canEdit = writable && u.status === 'draf';
  const bisaPutus = bisaMemutuskan && u.status === 'diajukan';

  const editCell = (l) => canEdit && (
    <span className="flex gap-4 sm:gap-3 text-sm">
      <button type="button" className="tap font-medium text-blueprint hover:underline" onClick={() => { setSaveError(null); setEditing(l.id); }}>Ubah</button>
      <button type="button" className="tap font-medium text-rust hover:underline" onClick={() => setConfirm({ kind: 'line', line: l })}>Hapus</button>
    </span>
  );
  const lineForm = (l) => (
    <LineForm line={l} onSave={saveLine} onCancel={() => setEditing(null)} busy={saving} error={saveError} />
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHead title={`${nomor} ${u.project_nama}`} />
      <PageHeader
        crumbs={crumbs}
        title={`${nomor} · ${u.project_nama}`}
        meta={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusDot status={USULAN_STATUS[u.status]} />
            <span>
              dari <Link href={`/gudang/bom/${u.bom_id}`} className="text-blueprint hover:underline">{u.bom ? `${u.bom.judul} Rev. ${u.bom.revisi}` : 'BOM'}</Link>
            </span>
            <span>·</span>
            <Link href={`/projects/${encodeURIComponent(u.project_id)}`} className="text-blueprint hover:underline">Buka project</Link>
          </span>
        }
        actions={
          <>
            <button type="button" onClick={exportCsv} className="btn btn-ghost" disabled={!lines.length}>Unduh CSV</button>
            {canEdit && (
              <>
                <button type="button" onClick={() => setConfirm({ kind: 'hapus' })} className="btn btn-ghost">Hapus draf</button>
                <button type="button" onClick={() => setConfirm({ kind: 'ajukan' })} className="btn btn-primary" disabled={!lines.length || !bomBerlaku}>
                  Ajukan ke Direksi
                </button>
              </>
            )}
            {bisaPutus && (
              <>
                <button type="button" onClick={() => { setKeputusan(''); setConfirm({ kind: 'tolak' }); }} className="btn btn-secondary">Tolak</button>
                <button type="button" onClick={() => { setKeputusan(''); setConfirm({ kind: 'setujui' }); }} className="btn btn-primary" disabled={!bomBerlaku}>
                  Setujui
                </button>
              </>
            )}
          </>
        }
      />

      <div className="-mt-2 flex flex-col gap-1">
        <StatusNote u={u} bomBerlaku={bomBerlaku} canEdit={canEdit} bisaMemutuskan={bisaMemutuskan} />
        {!writable && <p className="text-sm text-inkmute">{MSG_VIEWER}</p>}
      </div>

      <StatStrip
        label="Ringkasan usulan"
        items={[
          { key: 'n', label: 'Barang diusulkan', value: lines.length, tone: 'ink', hint: 'Kode barang yang kurang' },
          { key: 'sisih', label: 'Sebagian dari stok', value: nSebagian, tone: 'teal', dim: nSebagian === 0, hint: 'Sisanya dibeli' },
          { key: 'harga', label: 'Tanpa estimasi harga', value: sum.tanpa_harga, tone: 'amber', dim: sum.tanpa_harga === 0, hint: sum.tanpa_harga ? 'Lengkapi sebelum diajukan' : 'Semua sudah berharga' },
          {
            key: 'total', label: 'Estimasi total', value: sum.estimasi > 0 ? fmtRupiahRingkas(sum.estimasi) : '-', tone: 'ink',
            hint: sum.estimasi > 0 ? (sum.tanpa_harga ? `Belum termasuk ${sum.tanpa_harga} barang` : fmtRupiah(sum.estimasi)) : 'Belum ada harga',
          },
        ]}
      />

      {lines.length === 0 ? (
        <EmptyState title="Usulan ini kosong">
          Semua barang sudah dihapus dari usulan. {canEdit ? 'Hapus draf ini, atau buat ulang dari halaman BOM.' : ''}
        </EmptyState>
      ) : (
        <Panel
          title="Barang yang diusulkan dibeli"
          hint="Jumlah beli = kebutuhan BOM dikurangi stok yang sudah disisihkan untuk project ini. Sesuaikan jika perlu, mis. kelipatan kemasan."
          flush
        >
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Barang yang diusulkan dibeli</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-inkmute">
                  <th scope="col" className="px-5 py-3 font-medium">Barang</th>
                  <th scope="col" className="px-3 py-3 font-medium text-right">Kebutuhan</th>
                  <th scope="col" className="px-3 py-3 font-medium text-right">Disisihkan</th>
                  <th scope="col" className="px-3 py-3 font-medium text-right">Beli</th>
                  <th scope="col" className="px-3 py-3 font-medium text-right">Harga satuan</th>
                  <th scope="col" className="px-5 py-3 font-medium text-right">Subtotal</th>
                  {canEdit && <th scope="col" className="px-5 py-3"><span className="sr-only">Aksi</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lines.map((l) => (editing === l.id ? (
                  <tr key={l.id} className="bg-canvas/40">
                    <td colSpan={canEdit ? 7 : 6} className="px-5 py-4">
                      <p className="font-medium text-ink mb-3">{barangLabel(l.barang || { nama: l.barang_kode })} <span className="font-data text-xs text-inkmute font-normal">{l.barang_kode}</span></p>
                      {lineForm(l)}
                    </td>
                  </tr>
                ) : (
                  <tr key={l.id}>
                    <td className="px-5 py-3">
                      <Link href={`/gudang/katalog/${l.barang_kode}`} className="text-ink hover:text-blueprint">{barangLabel(l.barang || { nama: l.barang_kode })}</Link>
                      <span className="block text-xs text-inkmute">
                        <span className="font-data">{l.barang_kode}</span>{barangSub(l) ? ` · ${barangSub(l)}` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tnum whitespace-nowrap text-inkmute">{fmtQty(l.qty_butuh)}</td>
                    <td className="px-3 py-3 text-right tnum whitespace-nowrap text-inkmute">{Number(l.qty_disisihkan) ? fmtQty(l.qty_disisihkan) : '-'}</td>
                    <td className="px-3 py-3 text-right tnum whitespace-nowrap font-semibold text-ink">{fmtQty(l.qty_beli)} <span className="font-normal text-inkmute">{l.satuan}</span></td>
                    <td className="px-3 py-3 text-right tnum whitespace-nowrap">{hasHarga(l) ? fmtRupiah(l.harga_satuan) : <span className="text-amberink">Belum ada</span>}</td>
                    <td className="px-5 py-3 text-right tnum whitespace-nowrap">{hasHarga(l) ? fmtRupiah(subtotal(l)) : '-'}</td>
                    {canEdit && <td className="px-5 py-3 text-right">{editCell(l)}</td>}
                  </tr>
                )))}
              </tbody>
              {sum.estimasi > 0 && (
                <tfoot>
                  <tr className="border-t border-line">
                    <th scope="row" colSpan={5} className="px-3 py-3 text-right text-xs font-medium text-inkmute">Estimasi total{sum.tanpa_harga ? ` (${sum.tanpa_harga} barang tanpa harga)` : ''}</th>
                    <td className="px-5 py-3 text-right tnum whitespace-nowrap font-semibold text-ink">{fmtRupiah(sum.estimasi)}</td>
                    {canEdit && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <ul className="md:hidden divide-y divide-line">
            {lines.map((l) => (
              <li key={l.id} className="px-4 py-3 flex flex-col gap-1.5">
                <span className="text-ink">{barangLabel(l.barang || { nama: l.barang_kode })}</span>
                <span className="text-xs text-inkmute"><span className="font-data">{l.barang_kode}</span>{barangSub(l) ? ` · ${barangSub(l)}` : ''}</span>
                {editing === l.id ? (
                  <div className="mt-2">{lineForm(l)}</div>
                ) : (
                  <>
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-xs text-inkmute">butuh {fmtQty(l.qty_butuh)} · disisihkan {fmtQty(l.qty_disisihkan)}</span>
                      <span className="font-semibold tnum text-ink whitespace-nowrap">Beli {fmtQty(l.qty_beli)} <span className="font-normal text-inkmute text-sm">{l.satuan}</span></span>
                    </span>
                    <span className="flex items-baseline justify-between gap-3 text-xs">
                      <span className={hasHarga(l) ? 'text-inkmute' : 'text-amberink'}>{hasHarga(l) ? `${fmtRupiah(l.harga_satuan)} / ${l.satuan}` : 'Belum ada harga'}</span>
                      {hasHarga(l) && <span className="tnum text-ink">{fmtRupiah(subtotal(l))}</span>}
                    </span>
                    {editCell(l)}
                  </>
                )}
              </li>
            ))}
            {sum.estimasi > 0 && (
              <li className="px-4 py-3 flex justify-between text-sm">
                <span className="text-inkmute">Estimasi total</span>
                <span className="font-semibold tnum text-ink">{fmtRupiah(sum.estimasi)}</span>
              </li>
            )}
          </ul>
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel
          title="Catatan usulan"
          hint="Untuk Direksi, mis. alasan pembelian atau pemasok yang disarankan."
          aside={canEdit && info === null && (
            <button type="button" className="tap text-sm font-medium text-blueprint hover:underline" onClick={() => setInfo(u.catatan || '')}>Ubah</button>
          )}
        >
          {info !== null ? (
            <form onSubmit={saveInfo} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="sr-only">Catatan usulan</span>
                <textarea className="input min-h-[96px]" value={info} onChange={(e) => setInfo(e.target.value)} maxLength={1000} autoFocus />
              </label>
              <div className="flex justify-end gap-3">
                <button type="button" className="btn btn-ghost" onClick={() => setInfo(null)} disabled={acting}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={acting}>{acting ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-ink whitespace-pre-line">{u.catatan || <span className="text-inkmute">Belum ada catatan.</span>}</p>
          )}
        </Panel>

        <Panel title="Riwayat">
          <ol className="flex flex-col gap-3 text-sm">
            <li>
              <span className="block text-xs text-inkmute">Dibuat dari BOM</span>
              <span className="text-ink">{fmtWaktu(u.dibuat_pada)} oleh {u.dibuat_oleh}</span>
            </li>
            {u.diajukan_pada && (
              <li>
                <span className="block text-xs text-inkmute">Diajukan ke Direksi</span>
                <span className="text-ink">{fmtWaktu(u.diajukan_pada)} oleh {u.diajukan_oleh}</span>
              </li>
            )}
            {u.diputuskan_pada && (
              <li>
                <span className="block text-xs text-inkmute">{u.status === 'disetujui' ? 'Disetujui' : 'Ditolak'}</span>
                <span className="text-ink">{fmtWaktu(u.diputuskan_pada)} oleh {u.diputuskan_oleh}</span>
                {u.catatan_keputusan && <span className="block text-inkmute whitespace-pre-line mt-0.5">{u.catatan_keputusan}</span>}
              </li>
            )}
            {riwayat.length > 0 && (
              <li>
                <span className="block text-xs text-inkmute">Usulan lain dari BOM ini</span>
                {riwayat.map((r) => (
                  <Link key={r.id} href={`/gudang/usulan/${r.id}`} className="block text-blueprint hover:underline">
                    {nomorUsulan(r.id)} ({USULAN_STATUS[r.status]?.label})
                  </Link>
                ))}
              </li>
            )}
          </ol>
        </Panel>
      </div>

      <ConfirmModal
        open={confirm?.kind === 'ajukan'}
        title={`Ajukan ${nomor} ke Direksi?`}
        description={`${lines.length} barang${sum.estimasi > 0 ? `, estimasi ${fmtRupiah(sum.estimasi)}` : ''}. Sesudah diajukan, isi usulan terkunci sampai Direksi memutuskan.${sum.tanpa_harga ? ` ${sum.tanpa_harga} barang belum punya estimasi harga.` : ''}`}
        confirmText={acting ? 'Mengajukan...' : 'Ajukan'}
        danger={false}
        onConfirm={runConfirm}
        onCancel={() => !acting && setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.kind === 'setujui'}
        title={`Setujui ${nomor}?`}
        description={`${lines.length} barang untuk ${u.project_nama}${sum.estimasi > 0 ? `, estimasi ${fmtRupiah(sum.estimasi)}` : ''}. Sesudah disetujui, W&P dapat memesan barangnya.`}
        confirmText={acting ? 'Menyimpan...' : 'Setujui'}
        danger={false}
        onConfirm={runConfirm}
        onCancel={() => !acting && setConfirm(null)}
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-inkmute font-medium">Catatan (opsional)</span>
          <textarea className="input min-h-[72px]" value={keputusan} onChange={(e) => setKeputusan(e.target.value)} maxLength={1000} />
        </label>
      </ConfirmModal>
      <ConfirmModal
        open={confirm?.kind === 'tolak'}
        title={`Tolak ${nomor}?`}
        description="Pengusul dapat membuat usulan baru dari BOM yang sama sesudah menyesuaikannya."
        confirmText={acting ? 'Menyimpan...' : 'Tolak usulan'}
        confirmDisabled={!keputusan.trim()}
        onConfirm={runConfirm}
        onCancel={() => !acting && setConfirm(null)}
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-inkmute font-medium">Alasan penolakan</span>
          <textarea className="input min-h-[72px]" value={keputusan} onChange={(e) => setKeputusan(e.target.value)} maxLength={1000} required autoFocus />
        </label>
      </ConfirmModal>
      <ConfirmModal
        open={confirm?.kind === 'hapus'}
        title={`Hapus draf ${nomor}?`}
        description="Stok yang sudah disisihkan untuk BOM ini tetap disisihkan. Usulan baru bisa dibuat lagi dari halaman BOM."
        confirmText={acting ? 'Menghapus...' : 'Hapus draf'}
        onConfirm={runConfirm}
        onCancel={() => !acting && setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.kind === 'line'}
        title="Hapus barang ini dari usulan?"
        description={confirm?.line ? `${barangLabel(confirm.line.barang || { nama: confirm.line.barang_kode })} (${confirm.line.barang_kode}) tidak akan diajukan untuk dibeli.` : ''}
        confirmText={acting ? 'Menghapus...' : 'Hapus'}
        onConfirm={runConfirm}
        onCancel={() => !acting && setConfirm(null)}
      />
    </div>
  );
}
