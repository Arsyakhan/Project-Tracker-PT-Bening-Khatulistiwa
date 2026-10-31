import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import useCachedResource from '../../../lib/useCachedResource';
import { canWrite, MSG_VIEWER } from '../../../lib/roles';
import { gudangApi, searchKatalog, barangLabel, fmtQty, fmtWaktu, addToKatalogCache } from '../../../lib/gudang';
import { fmtDate } from '../../../lib/projectHelpers';
import PageHead from '../../../components/PageHead';
import ConfirmModal from '../../../components/ConfirmModal';
import { useToast } from '../../../components/Toast';
import PageHeader from '../../../components/ui/PageHeader';
import Panel from '../../../components/ui/Panel';
import StatStrip from '../../../components/ui/StatStrip';
import SearchField from '../../../components/ui/SearchField';
import EmptyState from '../../../components/ui/EmptyState';
import OpnameStatus from '../../../components/gudang/OpnameStatus';
import BarangBaruForm from '../../../components/gudang/BarangBaruForm';

const SEARCH_ID = 'opname-cari';

// Akibat satu hitungan terhadap stok:
//   awal   = belum pernah ada transaksi di lokasi ini -> menjadi saldo awal
//   lewat  = belum pernah ada transaksi dan hitungannya 0 -> tidak dicatat
//   ubah   = selisih dengan stok sistem -> penyesuaian
//   sama   = sama dengan stok sistem
function effectOf(line, opname, stokMap, hasilMap) {
  const q = Number(line.qty_hitung) || 0;
  if (opname.status === 'selesai') {
    const h = hasilMap[line.barang_kode];
    if (!h) return { type: 'sama', stok: q };
    if (h.jenis === 'saldo_awal') return { type: 'awal', delta: Number(h.qty), stok: 0 };
    return { type: 'ubah', delta: Number(h.qty), stok: q - Number(h.qty) };
  }
  const s = stokMap[line.barang_kode];
  if (!s || !Number(s.jumlah_transaksi)) return q > 0 ? { type: 'awal', delta: q, stok: 0 } : { type: 'lewat', stok: 0 };
  const stok = Number(s.stok) || 0;
  const delta = Math.round((q - stok) * 1000) / 1000;
  return delta === 0 ? { type: 'sama', stok } : { type: 'ubah', delta, stok };
}

function signed(n) {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtQty(Math.abs(n))}`;
}

function EffectText({ e, satuan, posted }) {
  if (e.type === 'awal') return <span className="text-blueprint">Saldo awal {signed(e.delta)} {satuan}</span>;
  if (e.type === 'lewat') return <span className="text-inkmute">0, tidak dicatat</span>;
  if (e.type === 'sama') return <span className="text-teal">Sama dengan stok</span>;
  return (
    <span className="text-amberink">
      {signed(e.delta)} {satuan} <span className="text-inkmute">(stok {posted ? 'sebelumnya' : 'sistem'} {fmtQty(e.stok)})</span>
    </span>
  );
}

// Form jumlah untuk satu barang: angka besar supaya nyaman diisi di HP sambil berdiri di gudang.
function CountForm({ barang, initial, onSave, onCancel, busy }) {
  const [qty, setQty] = useState(initial?.qty_hitung !== undefined && initial?.qty_hitung !== null ? String(initial.qty_hitung) : '');
  const [catatan, setCatatan] = useState(initial?.catatan || '');
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.closest('section')?.scrollIntoView({ block: 'nearest' });
  }, []);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave({ qty_hitung: qty, catatan }); }}
      className="flex flex-col gap-4"
    >
      <div>
        <p className="font-medium text-ink">{barangLabel(barang)}</p>
        <p className="text-xs text-inkmute mt-0.5">
          <span className="font-data">{barang.kode}</span>
          {[barang.merek, barang.model].filter(Boolean).length ? ` · ${[barang.merek, barang.model].filter(Boolean).join(' · ')}` : ''}
          {initial ? ` · sudah dihitung ${fmtQty(initial.qty_hitung)} ${barang.satuan} oleh ${initial.dihitung_oleh}` : ''}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[12rem_minmax(0,1fr)] gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-inkmute font-medium">Jumlah dihitung ({barang.satuan})</span>
          <input
            ref={ref}
            className="input !text-2xl font-semibold tnum !h-14"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
            required
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-inkmute font-medium">Catatan (opsional)</span>
          <input className="input sm:!h-14" value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={300} placeholder="mis. Rak B2, 3 pcs rusak" />
        </label>
      </div>
      {initial && <p className="text-xs text-inkmute -mt-2">Isi jumlah total barang ini di lokasi ini, bukan tambahannya.</p>}
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn btn-ghost" disabled={busy}>Batal</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan hitungan'}</button>
      </div>
    </form>
  );
}

export default function OpnameDetail() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const { data: session } = useSession();
  const writable = canWrite(session?.user?.role || 'admin'); // pengecekan sebenarnya di server
  const { showToast } = useToast();
  const katalog = useCachedResource('gudang-katalog', () => gudangApi.getKatalog());

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null); // barang yang sedang diisi jumlahnya
  const [adding, setAdding] = useState(false); // form barang baru
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [lineQuery, setLineQuery] = useState('');
  const [confirm, setConfirm] = useState(null); // { kind: 'post' | 'delete' | 'line', line }
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const d = await gudangApi.getOpname(id);
      setData(d);
      setError(null);
    } catch (e) {
      setError({ message: e.message, notFound: e.status === 404 });
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const barangList = katalog.data?.barang || [];
  const byKode = useMemo(() => Object.fromEntries(barangList.map((b) => [b.kode, b])), [barangList]);
  const lines = data?.baris || [];
  const lineOf = useMemo(() => Object.fromEntries(lines.map((l) => [l.barang_kode, l])), [lines]);
  const stokMap = useMemo(() => Object.fromEntries((data?.stokLokasi || []).map((s) => [s.barang_kode, s])), [data]);
  const hasilMap = useMemo(() => Object.fromEntries((data?.hasil || []).map((h) => [h.barang_kode, h])), [data]);
  const results = useMemo(() => (selected || adding ? [] : searchKatalog(barangList, query, 8)), [barangList, query, selected, adding]);

  const effects = useMemo(() => {
    if (!data) return {};
    return Object.fromEntries(lines.map((l) => [l.barang_kode, effectOf(l, data.opname, stokMap, hasilMap)]));
  }, [data, lines, stokMap, hasilMap]);
  const counts = useMemo(() => {
    const c = { awal: 0, ubah: 0, sama: 0, lewat: 0 };
    Object.values(effects).forEach((e) => { c[e.type] += 1; });
    return c;
  }, [effects]);

  const shownLines = useMemo(() => {
    const words = lineQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return lines;
    return lines.filter((l) => {
      const t = [l.barang_kode, l.barang?.nama, l.barang?.ukuran, l.barang?.material, l.barang?.model, l.catatan].filter(Boolean).join(' ').toLowerCase();
      return words.every((w) => t.includes(w));
    });
  }, [lines, lineQuery]);

  function pick(b) {
    // Barang yang sudah digabung dihitung di kode tujuannya.
    if (b.status_cek === 'Gabung' && b.gabung_ke) {
      const target = byKode[b.gabung_ke];
      if (target) {
        showToast(`${b.kode} sudah digabung ke ${b.gabung_ke}; hitungan dicatat di ${b.gabung_ke}`, 'info');
        b = target;
      }
    }
    setAdding(false);
    setSaveError(null);
    setSelected(b);
  }

  function resetEntry() {
    setSelected(null);
    setAdding(false);
    setQuery('');
    setSaveError(null);
    setTimeout(() => document.getElementById(SEARCH_ID)?.focus(), 0);
  }

  async function saveLine({ qty_hitung, catatan }) {
    if (!selected || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const line = await gudangApi.saveOpnameLine({ opname_id: data.opname.id, barang_kode: selected.kode, qty_hitung, catatan });
      setData((d) => ({ ...d, baris: [line, ...d.baris.filter((l) => l.barang_kode !== line.barang_kode)] }));
      showToast(`${line.barang_kode} dihitung: ${fmtQty(line.qty_hitung)} ${line.barang?.satuan || ''}`);
      resetEntry();
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function runConfirm() {
    if (!confirm || acting) return;
    setActing(true);
    try {
      if (confirm.kind === 'line') {
        await gudangApi.deleteOpnameLine({ opname_id: data.opname.id, barang_kode: confirm.line.barang_kode });
        setData((d) => ({ ...d, baris: d.baris.filter((l) => l.barang_kode !== confirm.line.barang_kode) }));
        showToast(`Hitungan ${confirm.line.barang_kode} dihapus`);
      } else if (confirm.kind === 'delete') {
        await gudangApi.deleteOpname({ id: data.opname.id });
        showToast('Draf opname dihapus');
        router.push('/gudang/opname');
        return;
      } else if (confirm.kind === 'post') {
        const r = await gudangApi.postOpname({ id: data.opname.id });
        const s = r.ringkasan || {};
        showToast(`Diposting: ${s.saldo_awal || 0} saldo awal, ${s.penyesuaian || 0} penyesuaian`);
        katalog.reload(); // stok di katalog berubah
        await load();
      }
      setConfirm(null);
    } catch (e) {
      showToast(e.message, 'error');
      setConfirm(null);
      if (confirm.kind === 'post') load(); // mis. sudah diposting orang lain
    } finally {
      setActing(false);
    }
  }

  const crumbs = [{ href: '/gudang/opname', label: 'Stock Opname' }, { label: data?.opname?.judul || '...' }];

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Stock Opname" />
        <PageHeader crumbs={crumbs} title="Stock Opname" />
        <div className="bg-panel border border-line rounded-xl p-6 flex flex-col gap-3" role="alert">
          <p className="text-rust text-sm">{error.message}</p>
          <div>
            {error.notFound ? (
              <Link href="/gudang/opname" className="btn btn-secondary">Kembali ke Stock Opname</Link>
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
        <PageHead title="Stock Opname" />
        <PageHeader crumbs={crumbs} title="Stock Opname" meta="Memuat sesi opname..." />
        <div className="skeleton-shimmer rounded-xl h-[84px]" />
        <div className="skeleton-shimmer rounded-xl h-64" />
      </div>
    );
  }

  const { opname, lokasi } = data;
  const draf = opname.status === 'draf';
  const canCount = draf && writable;
  const posted = opname.status === 'selesai';

  return (
    <div className="flex flex-col gap-5">
      <PageHead title={opname.judul} />
      <PageHeader
        crumbs={crumbs}
        title={opname.judul}
        meta={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{lokasi.nama} · {fmtDate(opname.tanggal)}</span>
            <OpnameStatus status={opname.status} />
            {posted && opname.diposting_oleh ? <span>oleh {opname.diposting_oleh}, {fmtWaktu(opname.diposting_pada)}</span> : null}
          </span>
        }
        actions={
          canCount && (
            <>
              <button type="button" onClick={() => setConfirm({ kind: 'delete' })} className="btn btn-ghost">Hapus draf</button>
              <button type="button" onClick={() => setConfirm({ kind: 'post' })} className="btn btn-primary" disabled={lines.length === 0}>
                Posting ke stok
              </button>
            </>
          )
        }
      />

      {!writable && <p className="text-sm text-inkmute -mt-2">{MSG_VIEWER}</p>}
      {opname.catatan && <p className="text-sm text-ink -mt-2">{opname.catatan}</p>}

      <StatStrip
        label="Ringkasan hitungan"
        items={[
          { key: 'n', label: 'Barang dihitung', value: lines.length, tone: 'ink', hint: draf ? 'Belum menjadi stok' : 'Sudah menjadi stok' },
          { key: 'awal', label: 'Saldo awal', value: counts.awal, tone: 'blueprint', dim: counts.awal === 0, hint: 'Stok pertama di lokasi' },
          { key: 'ubah', label: posted ? 'Disesuaikan' : 'Berbeda dari stok', value: counts.ubah, tone: 'amber', dim: counts.ubah === 0, hint: 'Jadi penyesuaian' },
          { key: 'sama', label: 'Tidak berubah', value: counts.sama + counts.lewat, tone: 'teal', dim: counts.sama + counts.lewat === 0, hint: 'Sama, atau dihitung 0' },
        ]}
      />

      {canCount && (
        <Panel title="Hitung barang" hint="Cari barangnya, isi jumlah yang ada di rak, lalu simpan. Barang yang sama boleh diubah lagi selama belum diposting.">
          {selected ? (
            <>
              <CountForm
                key={selected.kode}
                barang={selected}
                initial={lineOf[selected.kode]}
                onSave={saveLine}
                onCancel={resetEntry}
                busy={saving}
              />
              {saveError && <p className="text-sm text-rust mt-3" role="alert">{saveError}</p>}
            </>
          ) : adding ? (
            <BarangBaruForm
              kategori={katalog.data?.kategori}
              jenis={katalog.data?.jenis}
              katalog={barangList}
              namaAwal={query}
              konteks="opname"
              onCancel={() => setAdding(false)}
              onPickExisting={pick}
              onCreated={(b) => {
                addToKatalogCache(b);
                katalog.mutate((d) => (d ? { ...d, barang: [...d.barang, { ...b, stok: 0 }] } : d));
                showToast(`${b.kode} ditambahkan ke katalog`);
                pick(b);
              }}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <SearchField
                id={SEARCH_ID}
                value={query}
                onChange={setQuery}
                placeholder={katalog.data ? 'Cari kode, nama, ukuran, model...' : 'Memuat katalog...'}
                label="Cari barang yang dihitung"
                autoFocus
              />
              {katalog.error && !katalog.data && <p className="text-sm text-rust">Katalog gagal dimuat: {katalog.error}</p>}
              {query.trim() && (
                <ul className="flex flex-col divide-y divide-line border border-line rounded-lg overflow-hidden">
                  {results.map((b) => {
                    const done = lineOf[b.kode];
                    return (
                      <li key={b.kode}>
                        <button type="button" onClick={() => pick(b)} className="w-full text-left px-4 py-3 hover:bg-canvas/60 flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block text-ink">{barangLabel(b)}</span>
                            <span className="block text-xs text-inkmute mt-0.5">
                              <span className="font-data">{b.kode}</span>
                              {[b.merek, b.model].filter(Boolean).length ? ` · ${[b.merek, b.model].filter(Boolean).join(' · ')}` : ''}
                              {b.status_cek === 'Gabung' && b.gabung_ke ? ` · digabung ke ${b.gabung_ke}` : ''}
                            </span>
                          </span>
                          <span className="text-xs whitespace-nowrap text-right">
                            {done ? <span className="text-teal">Dihitung {fmtQty(done.qty_hitung)} {b.satuan}</span> : <span className="text-inkmute">{b.satuan}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
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

      <Panel
        title={posted ? 'Hasil opname' : 'Sudah dihitung'}
        hint={
          posted
            ? 'Selisih di setiap baris sudah menjadi transaksi stok (saldo awal atau penyesuaian).'
            : 'Selisih dihitung terhadap stok sistem di lokasi ini saat ini. Beberapa orang boleh menghitung bersamaan; muat ulang untuk melihat hitungan mereka.'
        }
        aside={
          draf && (
            <button type="button" onClick={load} disabled={loading} className="tap text-sm font-medium text-blueprint hover:underline disabled:opacity-60">
              {loading ? 'Memuat...' : 'Muat ulang'}
            </button>
          )
        }
        flush
      >
        {lines.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState dashed={false} title="Belum ada barang yang dihitung" className="!border-0 !py-2">
              {canCount ? 'Cari barang di atas untuk mulai menghitung.' : 'Hitungan akan tampil di sini.'}
            </EmptyState>
          </div>
        ) : (
          <>
            {lines.length > 10 && (
              <div className="px-5 pt-3">
                <SearchField value={lineQuery} onChange={setLineQuery} placeholder="Cari di hitungan ini..." label="Cari di hitungan ini" className="sm:w-80" />
              </div>
            )}
            <ul className="divide-y divide-line">
              {shownLines.map((l) => {
                const b = l.barang || byKode[l.barang_kode] || { kode: l.barang_kode, nama: l.barang_kode, satuan: '' };
                const e = effects[l.barang_kode];
                return (
                  <li key={l.barang_kode} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-1.5">
                    <span className="min-w-0 flex-1">
                      <Link href={`/gudang/katalog/${l.barang_kode}`} className="text-ink hover:text-blueprint">{barangLabel(b)}</Link>
                      <span className="block text-xs text-inkmute mt-0.5">
                        <span className="font-data">{l.barang_kode}</span>
                        {b.model ? ` · ${b.model}` : ''} · {l.dihitung_oleh}, {fmtWaktu(l.dihitung_pada)}
                        {l.catatan ? ` · ${l.catatan}` : ''}
                      </span>
                    </span>
                    <span className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
                      <span className="text-xs sm:text-right">{e && <EffectText e={e} satuan={b.satuan} posted={posted} />}</span>
                      <span className="font-display text-lg font-semibold tnum text-ink whitespace-nowrap sm:w-28 sm:text-right">
                        {fmtQty(l.qty_hitung)} <span className="text-sm font-medium text-inkmute">{b.satuan}</span>
                      </span>
                    </span>
                    {canCount && (
                      <span className="flex gap-4 sm:gap-3 text-sm">
                        <button
                          type="button"
                          className="tap font-medium text-blueprint hover:underline"
                          onClick={() => {
                            setAdding(false);
                            setSelected(byKode[l.barang_kode] || { ...b, kode: l.barang_kode });
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
            {lineQuery && shownLines.length === 0 && <p className="px-5 py-4 text-sm text-inkmute">Tidak ada hitungan yang cocok.</p>}
          </>
        )}
      </Panel>

      <ConfirmModal
        open={confirm?.kind === 'post'}
        title="Posting hasil opname ke stok?"
        description={`${lines.length} barang dihitung: ${counts.awal} menjadi saldo awal, ${counts.ubah} penyesuaian, ${counts.sama + counts.lewat} tanpa perubahan. Sesudah diposting, hitungan tidak bisa diubah lagi. Barang yang tidak dihitung tidak berubah stoknya.`}
        confirmText={acting ? 'Memposting...' : 'Posting ke stok'}
        danger={false}
        onConfirm={runConfirm}
        onCancel={() => !acting && setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.kind === 'delete'}
        title="Hapus draf opname ini?"
        description={`Semua hitungan di sesi ini (${lines.length} barang) ikut terhapus. Stok tidak berubah karena sesi ini belum diposting.`}
        confirmText={acting ? 'Menghapus...' : 'Hapus draf'}
        onConfirm={runConfirm}
        onCancel={() => !acting && setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.kind === 'line'}
        title="Hapus hitungan ini?"
        description={confirm?.line ? `${barangLabel(confirm.line.barang || { nama: confirm.line.barang_kode })} (${confirm.line.barang_kode}) dikeluarkan dari sesi ini.` : ''}
        confirmText={acting ? 'Menghapus...' : 'Hapus'}
        onConfirm={runConfirm}
        onCancel={() => !acting && setConfirm(null)}
      />
    </div>
  );
}
