import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { canWrite, MSG_VIEWER } from '../../../lib/roles';
import { gudangApi, STATUS_CEK, SATUAN_UMUM, BARANG_EDITABLE, fmtQty, patchKatalogCache } from '../../../lib/gudang';
import PageHead from '../../../components/PageHead';
import { useToast } from '../../../components/Toast';
import PageHeader from '../../../components/ui/PageHeader';
import Panel from '../../../components/ui/Panel';
import Segmented from '../../../components/ui/Segmented';

function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${className}`}>
      <span className="text-inkmute font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-inkmute">{hint}</span>}
    </label>
  );
}

function fmtDate(d) {
  if (!d) return '';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return String(d);
  return t.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const PENAWARAN = 'Penawaran (BOQ/BOM)';

function lineDetail(l) {
  return [l.lokasi_pasang, l.spesifikasi, l.ukuran, l.material, l.model].filter(Boolean).join(' · ');
}

// Ringkasan jumlah satu kelompok: daftar qty apa adanya, tidak dijumlahkan, karena satu project bisa memuat barang yang
// sama di beberapa file/lembar (BOM utama dan fitting list) sehingga totalnya bisa ganda.
function qtySummary(lines, satuanBawaan) {
  const qtys = lines.filter((l) => l.qty !== null && l.qty !== undefined);
  if (!qtys.length) return '';
  const units = new Set(qtys.map((l) => l.satuan || satuanBawaan));
  const shown = qtys.slice(0, 5).map((l) => fmtQty(l.qty)).join(', ') + (qtys.length > 5 ? ', ...' : '');
  return units.size === 1 ? `${shown} ${[...units][0]}` : shown;
}

function UsageGroup({ g, satuan }) {
  const files = new Set(g.lines.map((l) => l.file_id)).size;
  return (
    <li>
      <details className="group">
        <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer px-5 py-3 hover:bg-canvas/50 flex items-start gap-3">
          <svg aria-hidden="true" viewBox="0 0 20 20" className="w-4 h-4 mt-0.5 shrink-0 text-inkmute transition-transform group-open:rotate-90">
            <path fill="currentColor" d="M7.2 4.2a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06L8.26 15.8a.75.75 0 11-1.06-1.06L11.92 10 7.2 5.26a.75.75 0 010-1.06z" />
          </svg>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-ink">{g.key}</span>
            <span className="block text-xs text-inkmute mt-0.5">
              {g.lines.length} baris{files > 1 ? ` di ${files} file` : ''}{g.date ? ` · diubah ${fmtDate(g.date)}` : ''}
            </span>
          </span>
          <span className="text-sm tnum text-right text-ink max-w-[45%]">{qtySummary(g.lines, satuan)}</span>
        </summary>
        <ul className="flex flex-col gap-2 pl-12 pr-5 pb-4">
          {g.lines.map((l) => (
            <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 text-sm">
              <span className="min-w-0">
                <span className="text-ink">{l.nama}</span>
                {lineDetail(l) && <span className="text-inkmute"> · {lineDetail(l)}</span>}
                <span className="block text-xs text-inkmute truncate" title={l.file?.lokasi || ''}>
                  {l.file?.nama_file || l.file_id} · {l.lembar}{l.baris_excel ? `, baris ${l.baris_excel}` : ''}
                  {l.file && !l.file.revisi_terakhir ? ' · revisi lama' : ''}
                </span>
              </span>
              <span className="tnum text-right whitespace-nowrap">{l.qty !== null && l.qty !== undefined ? `${fmtQty(l.qty)} ${l.satuan || satuan}` : '-'}</span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

// Riwayat pemakaian barang di BOM lama, satu baris per project (klik untuk melihat baris BOM-nya). Project dulu,
// penawaran (BOQ) di bagian tersendiri. Bawaan: hanya file revisi terakhir.
function BomUsage({ baris, files, satuan }) {
  const [allRev, setAllRev] = useState(false);
  const fileOf = useMemo(() => Object.fromEntries(files.map((f) => [f.id, f])), [files]);
  const groups = useMemo(() => {
    const g = new Map();
    baris.forEach((l) => {
      const f = fileOf[l.file_id] || {};
      if (!allRev && !f.revisi_terakhir) return;
      const key = l.project_label || f.project_label || '(tanpa nama)';
      if (!g.has(key)) g.set(key, { key, offer: f.jenis_sumber === PENAWARAN, date: '', lines: [] });
      const grp = g.get(key);
      grp.lines.push({ ...l, file: f });
      if ((f.tanggal_ubah || '') > grp.date) grp.date = f.tanggal_ubah;
    });
    return Array.from(g.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [baris, fileOf, allRev]);

  const projects = groups.filter((g) => !g.offer);
  const offers = groups.filter((g) => g.offer);
  const hiddenOld = allRev ? 0 : baris.filter((l) => !(fileOf[l.file_id] || {}).revisi_terakhir).length;

  return (
    <Panel
      title="Dipakai di BOM"
      hint={`${projects.length} project dan ${offers.length} penawaran. Klik nama project untuk melihat baris BOM-nya.`}
      flush
    >
      {groups.length === 0 ? (
        <p className="px-5 py-6 text-sm text-inkmute">Tidak ada baris di file revisi terakhir.</p>
      ) : (
        <>
          {projects.length > 0 && <ul className="divide-y divide-line">{projects.map((g) => <UsageGroup key={g.key} g={g} satuan={satuan} />)}</ul>}
          {offers.length > 0 && (
            <>
              <h3 className="px-5 pt-4 pb-2 text-xs font-medium text-inkmute border-t border-line">Penawaran (BOQ)</h3>
              <ul className="divide-y divide-line">{offers.map((g) => <UsageGroup key={g.key} g={g} satuan={satuan} />)}</ul>
            </>
          )}
        </>
      )}
      {(allRev || hiddenOld > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 border-t border-line text-xs text-inkmute">
          <span>{allRev ? 'Semua revisi ditampilkan, termasuk file revisi lama.' : `${hiddenOld} baris dari file revisi lama tidak ditampilkan.`}</span>
          <button type="button" onClick={() => setAllRev((v) => !v)} className="tap text-sm font-medium text-blueprint hover:underline">
            {allRev ? 'Revisi terakhir saja' : 'Tampilkan revisi lama'}
          </button>
        </div>
      )}
    </Panel>
  );
}

function toForm(b) {
  const f = {};
  BARANG_EDITABLE.forEach((k) => { f[k] = b[k] === null || b[k] === undefined ? '' : String(b[k]); });
  return f;
}

export default function BarangDetail() {
  const router = useRouter();
  const kode = typeof router.query.kode === 'string' ? router.query.kode.toUpperCase() : '';
  const { data: session } = useSession();
  const writable = canWrite(session?.user?.role || 'admin'); // pengecekan sebenarnya di server
  const { showToast } = useToast();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const load = useCallback(async () => {
    if (!kode) return;
    setError(null);
    try {
      const d = await gudangApi.getBarang(kode);
      setData(d);
      setForm(toForm(d.barang));
      setSaveError(null);
    } catch (e) {
      setError({ message: e.message, notFound: e.status === 404 });
    }
  }, [kode]);

  useEffect(() => { load(); }, [load]);

  const changes = useMemo(() => {
    if (!data || !form) return {};
    const base = toForm(data.barang);
    const out = {};
    BARANG_EDITABLE.forEach((k) => { if (form[k] !== base[k]) out[k] = form[k]; });
    return out;
  }, [data, form]);
  const dirty = Object.keys(changes).length > 0;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e && e.target ? e.target.value : e }));

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await gudangApi.updateBarang({
        kode,
        changes,
        statusLama: data.barang.status_cek || '',
        baseDiubahPada: data.barang.diubah_pada,
      });
      setData((d) => ({ ...d, barang: updated }));
      setForm(toForm(updated));
      patchKatalogCache(updated);
      showToast(`${kode} tersimpan`);
    } catch (e) {
      setSaveError({ message: e.message, conflict: e.code === 'conflict' });
    } finally {
      setSaving(false);
    }
  }

  const crumbs = [{ href: '/gudang/katalog', label: 'Katalog Barang' }, { label: kode || '...' }];

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title={kode || 'Barang'} />
        <PageHeader crumbs={crumbs} title={kode || 'Barang'} />
        <div className="bg-panel border border-line rounded-xl p-6 flex flex-col gap-3" role="alert">
          <p className="text-rust text-sm">{error.message}</p>
          <div>
            {error.notFound ? (
              <Link href="/gudang/katalog" className="btn btn-secondary">Kembali ke Katalog Barang</Link>
            ) : (
              <button type="button" onClick={load} className="btn btn-secondary">Coba lagi</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!data || !form) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title={kode || 'Barang'} />
        <PageHeader crumbs={crumbs} title={kode || 'Barang'} meta="Memuat data barang..." />
        <div className="skeleton-shimmer rounded-xl h-64" />
      </div>
    );
  }

  const b = data.barang;
  const katNama = Object.fromEntries((data.kategori || []).map((k) => [k.kode, k.nama]));
  const disabled = !writable || saving;

  return (
    <div className="flex flex-col gap-6">
      <PageHead title={`${b.nama} (${b.kode})`} />
      <PageHeader
        crumbs={crumbs}
        title={[b.nama, b.ukuran, b.material].filter(Boolean).join(' ')}
        meta={
          <>
            <span className="font-data">{b.kode}</span> · {katNama[b.kategori_kode] || b.kategori_kode}
            {b.diubah_oleh ? <> · diubah {fmtDate(b.diubah_pada)} oleh {b.diubah_oleh}</> : null}
          </>
        }
        actions={
          writable && (
            <button type="button" onClick={save} disabled={!dirty || saving} className="btn btn-primary">
              {saving ? 'Menyimpan...' : 'Simpan perubahan'}
            </button>
          )
        }
      />

      {!writable && <p className="text-sm text-inkmute -mt-2">{MSG_VIEWER}</p>}

      {saveError && (
        <div className="bg-rust/10 border border-rust/30 rounded-xl px-5 py-3 text-sm text-rust flex flex-wrap items-center gap-3" role="alert">
          <span className="flex-1 min-w-0">{saveError.message}</span>
          {saveError.conflict && <button type="button" onClick={load} className="btn btn-secondary">Muat ulang</button>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <Panel title="Pemeriksaan" hint="Diisi W&P atau Engineering setelah mencocokkan barang ini dengan BOM dan gudang.">
            <div className="flex flex-col gap-4">
              <Segmented
                label="Status cek"
                className="max-md:flex-wrap"
                value={form.status_cek}
                onChange={disabled ? undefined : set('status_cek')}
                options={STATUS_CEK.map((s) => ({ key: s.key, label: s.short }))}
              />
              {form.status_cek === 'Gabung' && (
                <Field label="Gabung ke kode" hint="Kode barang yang sama, mis. FTG-0079. Barang ini nanti digantikan kode itu.">
                  <input className="input font-data uppercase sm:max-w-[14rem]" value={form.gabung_ke} onChange={set('gabung_ke')} disabled={disabled} placeholder="FTG-0079" />
                </Field>
              )}
              <p className="text-xs text-inkmute -mt-1">{STATUS_CEK.find((s) => s.key === form.status_cek)?.help}</p>
              <Field label="Catatan" hint={form.status_cek === 'Ubah' ? 'Tulis yang perlu dibetulkan, atau langsung ubah datanya di bawah.' : undefined}>
                <textarea className="input min-h-[72px]" value={form.catatan} onChange={set('catatan')} disabled={disabled} />
              </Field>
            </div>
          </Panel>

          <Panel title="Data barang">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nama barang" className="sm:col-span-2">
                <input className="input" value={form.nama} onChange={set('nama')} disabled={disabled} />
              </Field>
              <Field label="Kategori">
                <select className="input" value={form.kategori_kode} onChange={set('kategori_kode')} disabled={disabled}>
                  {(data.kategori || []).map((k) => <option key={k.kode} value={k.kode}>{k.nama}</option>)}
                </select>
              </Field>
              <Field label="Satuan">
                <input className="input" list="satuan-umum" value={form.satuan} onChange={set('satuan')} disabled={disabled} />
                <datalist id="satuan-umum">{SATUAN_UMUM.map((s) => <option key={s} value={s} />)}</datalist>
              </Field>
              <Field label="Spesifikasi" className="sm:col-span-2">
                <input className="input" value={form.spesifikasi} onChange={set('spesifikasi')} disabled={disabled} />
              </Field>
              <Field label="Ukuran">
                <input className="input" value={form.ukuran} onChange={set('ukuran')} disabled={disabled} placeholder='mis. 2-1/2"' />
              </Field>
              <Field label="Material">
                <input className="input" value={form.material} onChange={set('material')} disabled={disabled} placeholder="mis. PVC Sch 80" />
              </Field>
              <Field label="Merek">
                <input className="input" value={form.merek} onChange={set('merek')} disabled={disabled} />
              </Field>
              <Field label="Model / part number">
                <input className="input font-data" value={form.model} onChange={set('model')} disabled={disabled} />
              </Field>
              <Field label="Stok minimum" hint="Peringatan muncul kalau stok di bawah angka ini (nanti di halaman Gudang).">
                <input className="input" inputMode="decimal" value={form.stok_minimum} onChange={set('stok_minimum')} disabled={disabled} />
              </Field>
              <Field label="Tautan foto (Google Drive)">
                <input className="input" value={form.foto_url} onChange={set('foto_url')} disabled={disabled} placeholder="https://drive.google.com/..." />
              </Field>
            </div>
            {writable && (
              <div className="flex items-center justify-end gap-3 mt-5">
                {dirty && <span className="text-xs text-amberink">Ada perubahan yang belum disimpan</span>}
                <button type="button" onClick={save} disabled={!dirty || saving} className="btn btn-primary">
                  {saving ? 'Menyimpan...' : 'Simpan perubahan'}
                </button>
              </div>
            )}
          </Panel>

          <BomUsage baris={data.baris} files={data.files} satuan={b.satuan} />
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
          <Panel title="Stok gudang">
            <p className="font-display text-3xl font-semibold text-ink tnum">
              {fmtQty(data.stok.stok)} <span className="text-base font-medium text-inkmute">{b.satuan}</span>
            </p>
            <p className="text-xs text-inkmute mt-1">
              {data.stok.transaksi_terakhir
                ? `Transaksi terakhir ${fmtDate(data.stok.transaksi_terakhir)}.`
                : 'Belum ada transaksi. Stok awal diisi saat stock opname pertama.'}
            </p>
            {b.foto_url && (
              <a href={b.foto_url} target="_blank" rel="noopener noreferrer" className="tap inline-block mt-3 text-sm font-medium text-blueprint hover:underline">
                Buka foto barang
              </a>
            )}
          </Panel>

          {(b.perlu_dicek || []).length > 0 && (
            <Panel title="Ditandai saat impor">
              <ul className="flex flex-col gap-1 text-sm text-amberink">
                {b.perlu_dicek.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </Panel>
          )}

          {(b.nama_lain || []).length > 0 && (
            <Panel title="Ejaan lain di BOM" hint="Nama barang ini di file BOM yang berbeda-beda.">
              <ul className="flex flex-wrap gap-1.5">
                {b.nama_lain.map((n) => (
                  <li key={n} className="text-xs rounded-md border border-line bg-canvas/60 px-2 py-1">{n}</li>
                ))}
              </ul>
            </Panel>
          )}

          {data.digabung.length > 0 && (
            <Panel title="Digabung ke barang ini" flush>
              <ul className="divide-y divide-line">
                {data.digabung.map((d) => (
                  <li key={d.kode} className="px-5 py-2.5 text-sm">
                    <Link href={`/gudang/katalog/${d.kode}`} className="font-data text-xs text-blueprint hover:underline">{d.kode}</Link>{' '}
                    <span className="text-ink">{d.nama}</span>
                    {[d.ukuran, d.material, d.model].filter(Boolean).length > 0 && (
                      <span className="text-inkmute"> · {[d.ukuran, d.material, d.model].filter(Boolean).join(' · ')}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
