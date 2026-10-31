import { useEffect, useMemo, useState } from 'react';
import { gudangApi, barangLabel, fmtQty } from '../../lib/gudang';
import Panel from '../ui/Panel';

const todayIso = () => new Date().toISOString().slice(0, 10);

// Form serah terima barang ke teknisi: pilih project, lalu barang yang sudah disisihkan untuk project itu (dari BOM
// yang berlaku) dan jumlah yang diserahkan dari satu lokasi gudang. Bisa bertahap; sisanya tetap disisihkan.
export default function SerahTerimaForm({ defaultProject = '', onCreated, onCancel }) {
  const [sumber, setSumber] = useState(null); // { projects, lokasi }
  const [projectId, setProjectId] = useState(defaultProject);
  const [detail, setDetail] = useState(null); // { items, stok, lokasi }
  const [form, setForm] = useState({ lokasi_kode: '', penerima: '', tanggal: todayIso(), catatan: '' });
  const [qty, setQty] = useState({}); // key `${bom_id}|${barang_kode}` -> string
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    gudangApi.getSerahTerimaSumber().then((d) => {
      setSumber(d);
      setForm((f) => ({ ...f, lokasi_kode: f.lokasi_kode || (d.lokasi[0] && d.lokasi[0].kode) || '' }));
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setQty({});
    if (!projectId) return undefined;
    gudangApi.getSerahTerimaSumber(projectId).then((d) => { if (alive) setDetail(d); }).catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [projectId]);

  const stokOf = useMemo(() => {
    const m = {};
    (detail?.stok || []).forEach((s) => { m[`${s.barang_kode}|${s.lokasi_kode}`] = s.stok; });
    return m;
  }, [detail]);
  const key = (i) => `${i.bom_id}|${i.barang_kode}`;
  const stokDi = (i) => Math.max(0, stokOf[`${i.barang_kode}|${form.lokasi_kode}`] || 0);
  const project = (sumber?.projects || []).find((p) => p.project_id === projectId);

  // Isi otomatis: sebanyak yang disisihkan dan ada stoknya di lokasi terpilih. Bisa diubah per baris.
  function isiSemua() {
    setQty(Object.fromEntries((detail?.items || []).map((i) => [key(i), String(Math.min(i.qty, stokDi(i)) || '')])));
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const items = (detail?.items || [])
      .map((i) => ({ bom_id: i.bom_id, barang_kode: i.barang_kode, qty: (qty[key(i)] || '').trim() }))
      .filter((i) => i.qty !== '' && Number(i.qty.replace(',', '.')) !== 0);
    if (!items.length) {
      setError('Isi jumlah barang yang diserahkan.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await gudangApi.buatSerahTerima({ project_id: projectId, project_nama: project?.project_nama || detail?.items?.[0]?.bom?.project_nama, ...form, items });
      onCreated(r.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Panel title="Serah terima barang ke teknisi" hint="Hanya barang yang sudah disisihkan untuk project dan ada stoknya di lokasi yang dipilih.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="text-inkmute font-medium">Project</span>
            <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} required disabled={!sumber}>
              <option value="" disabled>{sumber ? (sumber.projects.length ? 'Pilih project' : 'Belum ada barang yang disisihkan') : 'Memuat...'}</option>
              {(sumber?.projects || []).map((p) => (
                <option key={p.project_id} value={p.project_id}>{p.project_nama} ({p.jumlah_barang} barang disisihkan)</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-inkmute font-medium">Diambil dari</span>
            <select className="input" value={form.lokasi_kode} onChange={(e) => setForm((f) => ({ ...f, lokasi_kode: e.target.value }))} required>
              {(sumber?.lokasi || []).map((l) => <option key={l.kode} value={l.kode}>{l.nama}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-inkmute font-medium">Tanggal serah terima</span>
            <input className="input" type="date" value={form.tanggal} onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))} required />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-inkmute font-medium">Diterima oleh (teknisi)</span>
            <input className="input" value={form.penerima} onChange={(e) => setForm((f) => ({ ...f, penerima: e.target.value }))} required maxLength={100} placeholder="Nama teknisi" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-inkmute font-medium">Catatan (opsional)</span>
            <input className="input" value={form.catatan} onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))} maxLength={500} placeholder="mis. untuk fabrikasi skid" />
          </label>
        </div>

        {projectId && !detail && !error && <div className="skeleton-shimmer rounded-lg h-24" />}
        {detail && detail.items.length === 0 && (
          <p className="text-sm text-inkmute">Tidak ada barang yang disisihkan untuk project ini dari BOM yang berlaku.</p>
        )}
        {detail && detail.items.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-ink">Barang yang disisihkan</span>
              <button type="button" className="tap text-sm font-medium text-blueprint hover:underline" onClick={isiSemua}>Isi semua yang tersedia</button>
            </div>
            <ul className="divide-y divide-line border border-line rounded-lg">
              {detail.items.map((i) => {
                const stok = stokDi(i);
                return (
                  <li key={key(i)} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <span className="min-w-0 flex-1">
                      <span className="block text-ink">{barangLabel(i.barang || { nama: i.barang_kode })}</span>
                      <span className="block text-xs text-inkmute">
                        <span className="font-data">{i.barang_kode}</span> · {i.bom?.judul} Rev. {i.bom?.revisi} · disisihkan {fmtQty(i.qty)}
                        {' · '}<span className={stok < i.qty ? 'text-amberink' : ''}>stok di lokasi ini {fmtQty(stok)}</span>
                      </span>
                    </span>
                    <label className="flex items-center gap-2 text-sm">
                      <span className="sr-only">Jumlah diserahkan {i.barang_kode}</span>
                      <input
                        className="input !w-28 tnum"
                        inputMode="decimal"
                        value={qty[key(i)] ?? ''}
                        onChange={(e) => setQty((q) => ({ ...q, [key(i)]: e.target.value }))}
                        placeholder="0"
                      />
                      <span className="text-inkmute">{i.barang?.satuan}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-inkmute">Kosongkan barang yang belum diserahkan; sisanya tetap disisihkan untuk project ini.</p>
          </div>
        )}

        {error && <p className="text-sm text-rust" role="alert">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Batal</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !detail || !detail.items.length}>{busy ? 'Menyimpan...' : 'Simpan serah terima'}</button>
        </div>
      </form>
    </Panel>
  );
}
