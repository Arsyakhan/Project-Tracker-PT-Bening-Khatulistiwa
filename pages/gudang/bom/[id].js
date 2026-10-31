import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import useCachedResource from '../../../lib/useCachedResource';
import { canWrite, MSG_VIEWER } from '../../../lib/roles';
import {
  gudangApi, BOM_STATUS, USULAN_STATUS, USULAN_BERJALAN, SATUAN_UMUM, nomorUsulan, searchKatalog, barangLabel, fmtQty, fmtWaktu, addToKatalogCache,
} from '../../../lib/gudang';
import { clearCache } from '../../../lib/persistedCache';
import { downloadCsv } from '../../../lib/exportCsv';
import PageHead from '../../../components/PageHead';
import ConfirmModal from '../../../components/ConfirmModal';
import { useToast } from '../../../components/Toast';
import PageHeader from '../../../components/ui/PageHeader';
import Panel from '../../../components/ui/Panel';
import StatStrip from '../../../components/ui/StatStrip';
import Segmented from '../../../components/ui/Segmented';
import SearchField from '../../../components/ui/SearchField';
import EmptyState from '../../../components/ui/EmptyState';
import StatusDot from '../../../components/gudang/StatusDot';
import BarangBaruForm from '../../../components/gudang/BarangBaruForm';

const SEARCH_ID = 'bom-cari';
const VIEWS = [
  { key: 'daftar', label: 'Daftar BOM' },
  { key: 'stok', label: 'Cek stok' },
];

const r3 = (n) => Math.round(n * 1000) / 1000;

// Kebutuhan per barang (jumlah semua baris dengan kode yang sama) dibandingkan dengan stok tersedia = stok gudang semua
// lokasi dikurangi yang sudah disisihkan untuk BOM lain. ownCounted: penyisihan BOM ini ikut terhitung di `disisihkan`
// (view stok_tersedia hanya menghitung BOM final), jadi dikurangkan kembali supaya tidak terhitung dua kali.
function stockCheck(lines, stokOf, ownOf, ownCounted) {
  const m = new Map();
  lines.forEach((l) => {
    const cur = m.get(l.barang_kode) || { kode: l.barang_kode, barang: l.barang, satuan: l.satuan, butuh: 0, kosong: 0, baris: 0 };
    cur.baris += 1;
    if (l.qty === null || l.qty === undefined) cur.kosong += 1;
    else cur.butuh += Number(l.qty);
    m.set(l.barang_kode, cur);
  });
  return Array.from(m.values()).map((r) => {
    const s = stokOf[r.kode] || { stok: 0, disisihkan: 0 };
    const sisih = ownOf[r.kode] || 0;
    const lain = Math.max(0, r3(s.disisihkan - (ownCounted ? sisih : 0)));
    const tersedia = Math.max(0, r3(s.stok - lain));
    const kurang = Math.max(0, r3(r.butuh - tersedia));
    return { ...r, stok: s.stok, lain, tersedia, sisih, kurang, cukup: kurang === 0 };
  });
}

function StockBadge({ s }) {
  if (!s) return null;
  if (s.sisih > 0 && s.sisih >= s.butuh) return <span className="text-xs text-teal whitespace-nowrap">Disisihkan {fmtQty(s.sisih)}</span>;
  if (s.cukup) return <span className="text-xs text-teal whitespace-nowrap">Tersedia {fmtQty(s.tersedia)}</span>;
  return <span className="text-xs text-rust whitespace-nowrap">Kurang {fmtQty(s.kurang)}{s.tersedia ? ` (tersedia ${fmtQty(s.tersedia)})` : ''}</span>;
}

// Form satu baris BOM: jumlah, satuan, bagian, catatan.
function LineForm({ barang, initial, bagianList, lastBagian, onSave, onCancel, busy, existing }) {
  const [qty, setQty] = useState(initial?.qty !== undefined && initial?.qty !== null ? String(initial.qty) : '');
  const [satuan, setSatuan] = useState(initial?.satuan || barang.satuan || 'pcs');
  const [bagian, setBagian] = useState(initial ? initial.bagian || '' : lastBagian || '');
  const [catatan, setCatatan] = useState(initial?.catatan || '');
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.closest('section')?.scrollIntoView({ block: 'nearest' });
  }, []);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ qty, satuan, bagian, catatan }); }} className="flex flex-col gap-4">
      <div>
        <p className="font-medium text-ink">{barangLabel(barang)}</p>
        <p className="text-xs text-inkmute mt-0.5">
          <span className="font-data">{barang.kode}</span>
          {[barang.merek, barang.model].filter(Boolean).length ? ` · ${[barang.merek, barang.model].filter(Boolean).join(' · ')}` : ''}
        </p>
        {!initial && existing.length > 0 && (
          <p className="text-xs text-amberink mt-1">
            Barang ini sudah ada di BOM ({existing.map((l) => `${l.bagian || 'tanpa bagian'}: ${l.qty === null ? 'jumlah kosong' : fmtQty(l.qty)}`).join('; ')}). Menyimpan akan menambah baris baru.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-[9rem_8rem_minmax(0,1fr)] gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-inkmute font-medium">Jumlah</span>
          <input ref={ref} className="input !text-xl font-semibold tnum" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-inkmute font-medium">Satuan</span>
          <input className="input" list="bom-satuan" value={satuan} onChange={(e) => setSatuan(e.target.value)} required maxLength={30} />
          <datalist id="bom-satuan">{SATUAN_UMUM.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label className="flex flex-col gap-1.5 text-sm col-span-2 sm:col-span-1">
          <span className="text-inkmute font-medium">Bagian</span>
          <input className="input" list="bom-bagian" value={bagian} onChange={(e) => setBagian(e.target.value)} maxLength={120} placeholder="mis. Fitting list, Electrical" />
          <datalist id="bom-bagian">{bagianList.map((b) => <option key={b} value={b} />)}</datalist>
        </label>
        <label className="flex flex-col gap-1.5 text-sm col-span-2 sm:col-span-3">
          <span className="text-inkmute font-medium">Catatan (opsional)</span>
          <input className="input" value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={300} placeholder="mis. untuk jalur reject" />
        </label>
      </div>
      <p className="text-xs text-inkmute -mt-2">Jumlah boleh dikosongkan dulu, tetapi BOM baru bisa diterbitkan setelah semua jumlah terisi.</p>
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn btn-ghost" disabled={busy}>Batal</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan...' : initial ? 'Simpan perubahan' : 'Tambah ke BOM'}</button>
      </div>
    </form>
  );
}

export default function BomDetail() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const { data: session } = useSession();
  const writable = canWrite(session?.user?.role || 'admin'); // pengecekan sebenarnya di server
  const { showToast } = useToast();
  const katalog = useCachedResource('gudang-katalog', () => gudangApi.getKatalog());

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState('daftar');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null); // { barang, line? }
  const [adding, setAdding] = useState(false);
  const [lastBagian, setLastBagian] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [lineQuery, setLineQuery] = useState('');
  const [confirm, setConfirm] = useState(null); // { kind: 'terbit' | 'hapus' | 'line', line }
  const [acting, setActing] = useState(false);
  const [info, setInfo] = useState(null); // { judul, catatan } saat mengubah keterangan

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const d = await gudangApi.getBom(id);
      setData(d);
      setError(null);
    } catch (e) {
      setError({ message: e.message, notFound: e.status === 404 });
    }
  }, [id]);
  useEffect(() => { setData(null); load(); }, [load]);

  const barangList = katalog.data?.barang || [];
  const byKode = useMemo(() => Object.fromEntries(barangList.map((b) => [b.kode, b])), [barangList]);
  const lines = data?.baris || [];
  const stokOf = useMemo(() => Object.fromEntries((data?.stok || []).map((s) => [s.kode, s])), [data]);
  // Penyisihan BOM yang sudah diganti revisi baru tidak berlaku lagi (lihat view stok_tersedia).
  const ownOf = useMemo(
    () => Object.fromEntries((data?.bom?.status === 'final' ? data.penyisihan || [] : []).map((p) => [p.barang_kode, p.qty])),
    [data]
  );
  const check = useMemo(() => stockCheck(lines, stokOf, ownOf, data?.bom?.status === 'final'), [lines, stokOf, ownOf, data]);
  const checkOf = useMemo(() => Object.fromEntries(check.map((c) => [c.kode, c])), [check]);
  const bagianList = useMemo(() => Array.from(new Set(lines.map((l) => l.bagian).filter(Boolean))), [lines]);
  const results = useMemo(() => (editing || adding ? [] : searchKatalog(barangList, query, 8)), [barangList, query, editing, adding]);

  const groups = useMemo(() => {
    const words = lineQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const g = new Map();
    lines
      .filter((l) => {
        if (!words.length) return true;
        const b = l.barang || {};
        const t = [l.barang_kode, b.nama, b.ukuran, b.material, b.merek, b.model, l.bagian, l.catatan].filter(Boolean).join(' ').toLowerCase();
        return words.every((w) => t.includes(w));
      })
      .forEach((l) => {
        const k = l.bagian || 'Tanpa bagian';
        if (!g.has(k)) g.set(k, []);
        g.get(k).push(l);
      });
    return Array.from(g.entries());
  }, [lines, lineQuery]);

  const nKosong = lines.filter((l) => l.qty === null || l.qty === undefined).length;
  const nKurang = check.filter((c) => !c.cukup && c.butuh > 0).length;
  const nCukup = check.filter((c) => c.cukup && c.butuh > 0).length;
  const nAda = check.filter((c) => c.butuh > 0 && c.tersedia > 0).length;

  function startAdd(b) {
    if (b.status_cek === 'Gabung' && b.gabung_ke && byKode[b.gabung_ke]) {
      showToast(`${b.kode} sudah digabung ke ${b.gabung_ke}; baris memakai ${b.gabung_ke}`, 'info');
      b = byKode[b.gabung_ke];
    }
    setAdding(false);
    setSaveError(null);
    setEditing({ barang: b });
  }

  function resetEntry() {
    setEditing(null);
    setAdding(false);
    setQuery('');
    setSaveError(null);
    setTimeout(() => document.getElementById(SEARCH_ID)?.focus(), 0);
  }

  async function saveLine(values) {
    if (!editing || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const line = await gudangApi.saveBomLine({ bom_id: data.bom.id, id: editing.line?.id, barang_kode: editing.barang.kode, ...values });
      setData((d) => ({
        ...d,
        baris: editing.line ? d.baris.map((l) => (l.id === line.id ? line : l)) : [...d.baris, line],
      }));
      setLastBagian(values.bagian || '');
      showToast(editing.line ? `${line.barang_kode} diperbarui` : `${line.barang_kode} ditambahkan ke BOM`);
      clearCache('gudang-bom');
      resetEntry();
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
      const bom = await gudangApi.updateBom({ id: data.bom.id, judul: info.judul, catatan: info.catatan });
      setData((d) => ({ ...d, bom }));
      setInfo(null);
      clearCache('gudang-bom');
      showToast('Keterangan BOM disimpan');
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
    try {
      if (c.kind === 'line') {
        await gudangApi.deleteBomLine({ bom_id: data.bom.id, id: c.line.id });
        setData((d) => ({ ...d, baris: d.baris.filter((l) => l.id !== c.line.id) }));
        showToast(`Baris ${c.line.barang_kode} dihapus`);
      } else if (c.kind === 'hapus') {
        await gudangApi.deleteBom({ id: data.bom.id });
        clearCache('gudang-bom');
        showToast('Draf BOM dihapus');
        router.push('/gudang/bom');
        return;
      } else if (c.kind === 'terbit') {
        await gudangApi.terbitkanBom({ id: data.bom.id });
        clearCache('gudang-bom');
        showToast(`BOM Rev. ${data.bom.revisi} diterbitkan`);
        await load();
      } else if (c.kind === 'sisihkan') {
        const r = await gudangApi.buatUsulan({ bom_id: data.bom.id });
        clearCache('gudang-usulan');
        if (r.usulan_id) {
          showToast(`Stok disisihkan; ${nomorUsulan(r.usulan_id)} dibuat untuk ${r.kurang} kode barang yang kurang`);
          router.push(`/gudang/usulan/${r.usulan_id}`);
          return;
        }
        showToast(r.kode ? 'Semua kebutuhan tersedia di gudang dan sudah disisihkan untuk project ini' : 'Tidak ada kebutuhan yang perlu disisihkan');
        await load();
      } else if (c.kind === 'revisi') {
        const r = await gudangApi.revisiBom({ id: data.bom.id });
        clearCache('gudang-bom');
        showToast(`Draf Rev. ${data.bom.revisi + 1} dibuat`);
        router.push(`/gudang/bom/${r.id}`);
        return;
      }
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
    const b = data.bom;
    const safe = `${b.project_nama} ${b.judul} Rev${b.revisi}`.replace(/[^A-Za-z0-9 _.-]+/g, '').trim().replace(/\s+/g, '_');
    downloadCsv(`BOM_${safe}.csv`, [
      ['No', (l) => l._no],
      ['Bagian', (l) => l.bagian || ''],
      ['Kode', (l) => l.barang_kode],
      ['Nama barang', (l) => l.barang?.nama],
      ['Ukuran', (l) => l.barang?.ukuran],
      ['Material', (l) => l.barang?.material],
      ['Merek', (l) => l.barang?.merek],
      ['Model', (l) => l.barang?.model],
      ['Jumlah', (l) => (l.qty === null ? '' : Number(l.qty))],
      ['Satuan', (l) => l.satuan],
      ['Catatan', (l) => l.catatan],
      ['Stok gudang (semua baris kode ini)', (l) => checkOf[l.barang_kode]?.stok ?? 0],
      ['Disisihkan BOM lain', (l) => checkOf[l.barang_kode]?.lain ?? 0],
      ['Disisihkan BOM ini', (l) => checkOf[l.barang_kode]?.sisih ?? 0],
      ['Kurang (semua baris kode ini)', (l) => checkOf[l.barang_kode]?.kurang ?? 0],
    ], lines.map((l, i) => ({ ...l, _no: i + 1 })));
  }

  const crumbs = [{ href: '/gudang/bom', label: 'BOM Project' }, { label: data?.bom?.project_nama || '...' }];

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="BOM Project" />
        <PageHeader crumbs={crumbs} title="BOM Project" />
        <div className="bg-panel border border-line rounded-xl p-6 flex flex-col gap-3" role="alert">
          <p className="text-rust text-sm">{error.message}</p>
          <div>
            {error.notFound ? (
              <Link href="/gudang/bom" className="btn btn-secondary">Kembali ke BOM Project</Link>
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
        <PageHead title="BOM Project" />
        <PageHeader crumbs={crumbs} title="BOM Project" meta="Memuat BOM..." />
        <div className="skeleton-shimmer rounded-xl h-[84px]" />
        <div className="skeleton-shimmer rounded-xl h-64" />
      </div>
    );
  }

  const { bom, terkait } = data;
  const draf = bom.status === 'draf';
  const canEdit = draf && writable;
  const newer = (terkait || []).filter((t) => t.revisi > bom.revisi);
  const older = (terkait || []).filter((t) => t.revisi < bom.revisi);
  const draftRevision = newer.find((t) => t.status === 'draf');
  const usulanList = data.usulan || [];
  const usulanBerjalan = usulanList.find((u) => USULAN_BERJALAN.includes(u.status));
  const penyisihan = bom.status === 'final' ? data.penyisihan || [] : [];
  const terakhirDisisihkan = penyisihan.reduce((a, p) => (p.dibuat_pada > (a?.dibuat_pada || '') ? p : a), null);

  return (
    <div className="flex flex-col gap-5">
      <PageHead title={`${bom.judul} Rev. ${bom.revisi}`} />
      <PageHeader
        crumbs={crumbs}
        title={`${bom.judul} · Rev. ${bom.revisi}`}
        meta={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={`/projects/${encodeURIComponent(bom.project_id)}`} className="text-blueprint hover:underline">{bom.project_nama}</Link>
            <StatusDot status={BOM_STATUS[bom.status]} />
            <span>
              {bom.status === 'draf'
                ? `diubah ${fmtWaktu(bom.diubah_pada)}${bom.diubah_oleh ? ` oleh ${bom.diubah_oleh}` : ''}`
                : `diterbitkan ${fmtWaktu(bom.diterbitkan_pada)}${bom.diterbitkan_oleh ? ` oleh ${bom.diterbitkan_oleh}` : ''}`}
            </span>
          </span>
        }
        actions={
          <>
            <button type="button" onClick={exportCsv} className="btn btn-ghost" disabled={!lines.length}>Unduh CSV</button>
            {canEdit && (
              <>
                <button type="button" onClick={() => setConfirm({ kind: 'hapus' })} className="btn btn-ghost">Hapus draf</button>
                <button type="button" onClick={() => setConfirm({ kind: 'terbit' })} className="btn btn-primary" disabled={!lines.length}>Terbitkan</button>
              </>
            )}
            {bom.status === 'final' && (
              usulanBerjalan ? (
                <Link href={`/gudang/usulan/${usulanBerjalan.id}`} className="btn btn-secondary">
                  {nomorUsulan(usulanBerjalan.id)} · {USULAN_STATUS[usulanBerjalan.status]?.label}
                </Link>
              ) : (
                writable && (
                  <button type="button" onClick={() => setConfirm({ kind: 'sisihkan' })} className="btn btn-primary">Sisihkan stok & usulkan pembelian</button>
                )
              )
            )}
            {writable && bom.status === 'final' && (
              draftRevision ? (
                <Link href={`/gudang/bom/${draftRevision.id}`} className="btn btn-secondary">Lanjutkan draf Rev. {draftRevision.revisi}</Link>
              ) : (
                <button type="button" onClick={() => setConfirm({ kind: 'revisi' })} className="btn btn-secondary">Buat revisi</button>
              )
            )}
          </>
        }
      />

      {!writable && <p className="text-sm text-inkmute -mt-2">{MSG_VIEWER}</p>}
      {(bom.sumber || older.length > 0 || newer.length > 0) && (
        <p className="text-sm text-inkmute -mt-2">
          {bom.sumber}
          {older.map((t) => <span key={t.id}> · <Link href={`/gudang/bom/${t.id}`} className="text-blueprint hover:underline">Rev. {t.revisi} sebelumnya</Link></span>)}
          {newer.map((t) => (
            <span key={t.id}> · <Link href={`/gudang/bom/${t.id}`} className="text-blueprint hover:underline">Rev. {t.revisi} ({(BOM_STATUS[t.status] || {}).label})</Link></span>
          ))}
        </p>
      )}
      {bom.status === 'diganti' && (
        <p className="text-sm text-amberink -mt-2">Revisi ini sudah diganti revisi yang lebih baru. Pakai revisi terbaru untuk cek stok dan pengadaan.</p>
      )}
      {bom.status === 'final' && (
        <p className="text-sm text-inkmute -mt-2">
          {terakhirDisisihkan
            ? `Stok disisihkan untuk BOM ini: ${penyisihan.length} kode barang (${fmtWaktu(terakhirDisisihkan.dibuat_pada)} oleh ${terakhirDisisihkan.dibuat_oleh}).`
            : usulanBerjalan
              ? 'Belum ada stok gudang yang bisa disisihkan untuk BOM ini; semua kebutuhan masuk usulan pembelian.'
              : 'Langkah berikutnya: sisihkan stok gudang yang tersedia untuk project ini. Kekurangannya menjadi usulan pembelian yang disetujui Direksi.'}
          {usulanList.filter((u) => u !== usulanBerjalan).map((u) => (
            <span key={u.id}> · <Link href={`/gudang/usulan/${u.id}`} className="text-blueprint hover:underline">{nomorUsulan(u.id)} ({USULAN_STATUS[u.status]?.label})</Link></span>
          ))}
        </p>
      )}

      <StatStrip
        label="Ringkasan BOM"
        items={[
          { key: 'n', label: 'Baris', value: lines.length, tone: 'ink', hint: `${check.length} kode barang` },
          { key: 'kosong', label: 'Jumlah belum diisi', value: nKosong, tone: 'amber', dim: nKosong === 0, hint: draf ? 'Wajib sebelum terbit' : 'Semua terisi' },
          { key: 'cukup', label: 'Stok cukup', value: nCukup, tone: 'teal', dim: nCukup === 0, hint: penyisihan.length ? `${penyisihan.length} kode disisihkan` : 'Kode barang', onClick: () => setView('stok') },
          { key: 'kurang', label: 'Stok kurang', value: nKurang, tone: 'rust', dim: nKurang === 0, hint: 'Lihat Cek stok', onClick: () => setView('stok') },
        ]}
      />

      {lines.length > 0 && (data.stok || []).length === 0 && (
        <p className="text-sm text-amberink -mt-1">
          Belum ada stok gudang yang tercatat untuk barang di BOM ini, jadi semuanya terhitung kurang. Stok terisi setelah{' '}
          <Link href="/gudang/opname" className="underline">stock opname</Link> diposting.
        </p>
      )}

      {canEdit && (
        <Panel title="Tambah barang" hint="Cari dari Katalog Barang. Bagian terakhir yang dipakai otomatis terisi untuk barang berikutnya.">
          {editing ? (
            <>
              <LineForm
                key={`${editing.barang.kode}-${editing.line?.id || 'baru'}`}
                barang={editing.barang}
                initial={editing.line}
                bagianList={bagianList}
                lastBagian={lastBagian}
                existing={lines.filter((l) => l.barang_kode === editing.barang.kode)}
                onSave={saveLine}
                onCancel={resetEntry}
                busy={saving}
              />
              {saveError && <p className="text-sm text-rust mt-3" role="alert">{saveError}</p>}
            </>
          ) : adding ? (
            <BarangBaruForm
              kategori={katalog.data?.kategori}
              katalog={barangList}
              namaAwal={query}
              konteks="bom"
              onCancel={() => setAdding(false)}
              onPickExisting={startAdd}
              onCreated={(b) => {
                addToKatalogCache(b);
                katalog.mutate((d) => (d ? { ...d, barang: [...d.barang, { ...b, stok: 0 }] } : d));
                showToast(`${b.kode} ditambahkan ke katalog`);
                startAdd(b);
              }}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <SearchField
                id={SEARCH_ID}
                value={query}
                onChange={setQuery}
                placeholder={katalog.data ? 'Cari kode, nama, ukuran, model...' : 'Memuat katalog...'}
                label="Cari barang untuk BOM"
              />
              {katalog.error && !katalog.data && <p className="text-sm text-rust">Katalog gagal dimuat: {katalog.error}</p>}
              {query.trim() && (
                <ul className="flex flex-col divide-y divide-line border border-line rounded-lg overflow-hidden">
                  {results.map((b) => (
                    <li key={b.kode}>
                      <button type="button" onClick={() => startAdd(b)} className="w-full text-left px-4 py-3 hover:bg-canvas/60 flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-ink">{barangLabel(b)}</span>
                          <span className="block text-xs text-inkmute mt-0.5">
                            <span className="font-data">{b.kode}</span>
                            {[b.merek, b.model].filter(Boolean).length ? ` · ${[b.merek, b.model].filter(Boolean).join(' · ')}` : ''}
                            {b.status_cek === 'Gabung' && b.gabung_ke ? ` · digabung ke ${b.gabung_ke}` : ''}
                          </span>
                        </span>
                        <span className="text-xs whitespace-nowrap text-right">
                          {checkOf[b.kode] ? <span className="text-teal">Sudah di BOM</span> : <span className="text-inkmute">Stok {fmtQty(b.stok || 0)} {b.satuan}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <button type="button" onClick={() => setAdding(true)} className="w-full text-left px-4 py-3 text-sm font-medium text-blueprint hover:bg-canvas/60">
                      {results.length ? 'Tidak ada di daftar? Tambah barang baru ke katalog' : `Tidak ditemukan. Tambah "${query.trim()}" ke katalog`}
                    </button>
                  </li>
                </ul>
              )}
            </div>
          )}
        </Panel>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Segmented label="Tampilan BOM" value={view} onChange={setView} options={VIEWS} />
        {view === 'daftar' && lines.length > 10 && (
          <SearchField className="sm:w-80" value={lineQuery} onChange={setLineQuery} placeholder="Cari di BOM ini..." label="Cari di BOM ini" />
        )}
      </div>

      {lines.length === 0 ? (
        <EmptyState title="BOM masih kosong">
          {canEdit ? 'Cari barang di atas untuk menambahkannya.' : 'Belum ada barang di BOM ini.'}
        </EmptyState>
      ) : view === 'daftar' ? (
        <div className="flex flex-col gap-4">
          {groups.map(([bagian, items]) => (
            <Panel key={bagian} title={bagian} hint={`${items.length} baris`} flush>
              <ul className="divide-y divide-line">
                {items.map((l) => {
                  const b = l.barang || byKode[l.barang_kode] || { kode: l.barang_kode, nama: l.barang_kode };
                  return (
                    <li key={l.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-1.5">
                      <span className="min-w-0 flex-1">
                        <Link href={`/gudang/katalog/${l.barang_kode}`} className="text-ink hover:text-blueprint">{barangLabel(b)}</Link>
                        <span className="block text-xs text-inkmute mt-0.5">
                          <span className="font-data">{l.barang_kode}</span>
                          {[b.merek, b.model].filter(Boolean).length ? ` · ${[b.merek, b.model].filter(Boolean).join(' · ')}` : ''}
                          {l.catatan ? ` · ${l.catatan}` : ''}
                        </span>
                      </span>
                      <span className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
                        <StockBadge s={checkOf[l.barang_kode]} />
                        <span className="font-display text-base font-semibold tnum text-ink whitespace-nowrap sm:w-28 sm:text-right">
                          {l.qty === null || l.qty === undefined ? (
                            <span className="text-sm font-medium text-amberink">Isi jumlah</span>
                          ) : (
                            <>{fmtQty(l.qty)} <span className="text-sm font-medium text-inkmute">{l.satuan}</span></>
                          )}
                        </span>
                      </span>
                      {canEdit && (
                        <span className="flex gap-4 sm:gap-3 text-sm">
                          <button
                            type="button"
                            className="tap font-medium text-blueprint hover:underline"
                            onClick={() => {
                              setAdding(false);
                              setSaveError(null);
                              setEditing({ barang: { ...b, kode: l.barang_kode, satuan: b.satuan || l.satuan }, line: l });
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          >
                            Ubah
                          </button>
                          <button type="button" className="tap font-medium text-rust hover:underline" onClick={() => setConfirm({ kind: 'line', line: l })}>
                            Hapus
                          </button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}
          {lineQuery && groups.length === 0 && <p className="text-sm text-inkmute">Tidak ada baris yang cocok.</p>}
        </div>
      ) : (
        <Panel
          title="Cek stok"
          hint="Kebutuhan dijumlahkan per kode barang lalu dibandingkan dengan stok tersedia: stok gudang di semua lokasi dikurangi yang sudah disisihkan untuk BOM project lain."
          flush
        >
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Kebutuhan BOM dibandingkan stok tersedia</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-inkmute">
                  <th scope="col" className="px-5 py-3 font-medium">Barang</th>
                  <th scope="col" className="px-3 py-3 font-medium text-right">Kebutuhan</th>
                  <th scope="col" className="px-3 py-3 font-medium text-right">Tersedia</th>
                  {penyisihan.length > 0 && <th scope="col" className="px-3 py-3 font-medium text-right">Disisihkan</th>}
                  <th scope="col" className="px-5 py-3 font-medium text-right">Kurang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...check].sort((a, b) => b.kurang - a.kurang || a.kode.localeCompare(b.kode)).map((c) => (
                  <tr key={c.kode}>
                    <td className="px-5 py-3">
                      <Link href={`/gudang/katalog/${c.kode}`} className="text-ink hover:text-blueprint">{barangLabel(c.barang || { nama: c.kode })}</Link>
                      <span className="block text-xs text-inkmute font-data">{c.kode}{c.baris > 1 ? ` · ${c.baris} baris` : ''}</span>
                    </td>
                    <td className="px-3 py-3 text-right tnum whitespace-nowrap">
                      {fmtQty(c.butuh)} {c.satuan}
                      {c.kosong > 0 && <span className="block text-xs text-amberink">{c.kosong} baris belum diisi</span>}
                    </td>
                    <td className="px-3 py-3 text-right tnum whitespace-nowrap">
                      {fmtQty(c.tersedia)}
                      {c.lain > 0 && <span className="block text-xs text-inkmute">stok {fmtQty(c.stok)}, BOM lain {fmtQty(c.lain)}</span>}
                    </td>
                    {penyisihan.length > 0 && <td className="px-3 py-3 text-right tnum whitespace-nowrap">{c.sisih ? fmtQty(c.sisih) : '-'}</td>}
                    <td className={`px-5 py-3 text-right tnum whitespace-nowrap font-medium ${c.kurang > 0 ? 'text-rust' : 'text-teal'}`}>
                      {c.kurang > 0 ? fmtQty(c.kurang) : 'Cukup'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="md:hidden divide-y divide-line">
            {[...check].sort((a, b) => b.kurang - a.kurang || a.kode.localeCompare(b.kode)).map((c) => (
              <li key={c.kode} className="px-4 py-3">
                <span className="block text-ink">{barangLabel(c.barang || { nama: c.kode })}</span>
                <span className="flex items-center justify-between gap-3 mt-1 text-xs">
                  <span className="text-inkmute">
                    <span className="font-data">{c.kode}</span> · butuh {fmtQty(c.butuh)} {c.satuan} · tersedia {fmtQty(c.tersedia)}
                    {c.sisih ? ` · disisihkan ${fmtQty(c.sisih)}` : ''}
                  </span>
                  <span className={`font-medium ${c.kurang > 0 ? 'text-rust' : 'text-teal'}`}>{c.kurang > 0 ? `Kurang ${fmtQty(c.kurang)}` : 'Cukup'}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Keterangan BOM"
        aside={canEdit && !info && (
          <button type="button" className="tap text-sm font-medium text-blueprint hover:underline" onClick={() => setInfo({ judul: bom.judul, catatan: bom.catatan || '' })}>
            Ubah
          </button>
        )}
      >
        {info ? (
          <form onSubmit={saveInfo} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-inkmute font-medium">Judul BOM</span>
              <input className="input" value={info.judul} onChange={(e) => setInfo((x) => ({ ...x, judul: e.target.value }))} required maxLength={150} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-inkmute font-medium">Catatan</span>
              <textarea className="input min-h-[80px]" value={info.catatan} onChange={(e) => setInfo((x) => ({ ...x, catatan: e.target.value }))} maxLength={1000} />
            </label>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-ghost" onClick={() => setInfo(null)} disabled={acting}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={acting}>{acting ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-xs text-inkmute">Dibuat</dt><dd className="text-ink">{fmtWaktu(bom.dibuat_pada)} oleh {bom.dibuat_oleh}</dd></div>
            <div><dt className="text-xs text-inkmute">Isi awal</dt><dd className="text-ink">{bom.sumber || '-'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-inkmute">Catatan</dt><dd className="text-ink whitespace-pre-line">{bom.catatan || '-'}</dd></div>
          </dl>
        )}
      </Panel>

      <ConfirmModal
        open={confirm?.kind === 'terbit'}
        title={`Terbitkan BOM Rev. ${bom.revisi}?`}
        description={`${lines.length} baris, ${check.length} kode barang. Sesudah diterbitkan, baris BOM terkunci; perubahan berikutnya lewat revisi baru.${bom.revisi_dari ? ' Revisi sebelumnya akan ditandai diganti.' : ''}${nKosong ? ` ${nKosong} baris belum punya jumlah, jadi penerbitan akan ditolak.` : ''}`}
        confirmText={acting ? 'Menerbitkan...' : 'Terbitkan'}
        danger={false}
        onConfirm={runConfirm}
        onCancel={() => !acting && setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.kind === 'sisihkan'}
        title="Sisihkan stok dan buat usulan pembelian?"
        description={`${nAda ? `Stok gudang yang tersedia untuk ${nAda} kode barang disisihkan untuk ${bom.project_nama}, sehingga tidak terpakai BOM lain.` : 'Belum ada stok gudang yang tersedia untuk barang di BOM ini.'} ${nKurang ? `${nKurang} kode barang masih kurang (seluruhnya atau sebagian) dan masuk draf usulan pembelian; jumlah dan estimasi harganya bisa disesuaikan sebelum diajukan ke Direksi.` : 'Tidak ada yang kurang, jadi tidak ada usulan pembelian.'}${penyisihan.length ? ' Penyisihan sebelumnya untuk BOM ini dihitung ulang dari stok saat ini.' : ''}`}
        confirmText={acting ? 'Memproses...' : 'Sisihkan dan buat usulan'}
        danger={false}
        onConfirm={runConfirm}
        onCancel={() => !acting && setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.kind === 'revisi'}
        title={`Buat revisi Rev. ${bom.revisi + 1}?`}
        description="Seluruh baris BOM ini disalin menjadi draf revisi baru. Rev. sekarang tetap berlaku sampai revisi baru diterbitkan."
        confirmText={acting ? 'Membuat...' : 'Buat revisi'}
        danger={false}
        onConfirm={runConfirm}
        onCancel={() => !acting && setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.kind === 'hapus'}
        title="Hapus draf BOM ini?"
        description={`Semua baris (${lines.length}) ikut terhapus.`}
        confirmText={acting ? 'Menghapus...' : 'Hapus draf'}
        onConfirm={runConfirm}
        onCancel={() => !acting && setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.kind === 'line'}
        title="Hapus baris ini?"
        description={confirm?.line ? `${barangLabel(confirm.line.barang || { nama: confirm.line.barang_kode })} (${confirm.line.barang_kode}) dihapus dari BOM.` : ''}
        confirmText={acting ? 'Menghapus...' : 'Hapus'}
        onConfirm={runConfirm}
        onCancel={() => !acting && setConfirm(null)}
      />
    </div>
  );
}
