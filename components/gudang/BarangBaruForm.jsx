import { useMemo, useState } from 'react';
import { gudangApi, SATUAN_UMUM, searchKatalog, barangLabel } from '../../lib/gudang';

// Form menambah barang yang belum ada di katalog (mis. ditemukan saat stock opname). Sebelum menyimpan, barang yang
// mirip di katalog ditampilkan supaya tidak terjadi kode ganda; memilih salah satunya memakai kode yang sudah ada.
export default function BarangBaruForm({ kategori, katalog, namaAwal = '', konteks, onCreated, onPickExisting, onCancel }) {
  const [form, setForm] = useState({
    nama: namaAwal,
    kategori_kode: '',
    ukuran: '',
    material: '',
    merek: '',
    model: '',
    spesifikasi: '',
    satuan: 'pcs',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const mirip = useMemo(
    () => searchKatalog(katalog, [form.nama, form.ukuran].filter(Boolean).join(' '), 5),
    [katalog, form.nama, form.ukuran]
  );

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await gudangApi.createBarang({ ...form, konteks });
      onCreated(created);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const field = (k, label, props = {}) => (
    <label className={`flex flex-col gap-1.5 text-sm ${props.wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-inkmute font-medium">{label}</span>
      <input className="input" value={form[k]} onChange={set(k)} maxLength={500} {...props.input} />
    </label>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <h3 className="font-display text-base font-semibold text-ink">Tambah barang baru ke katalog</h3>
        <p className="text-xs text-inkmute mt-1">Kode dibuat otomatis dari kategori. Barang baru berstatus Belum dicek sampai diperiksa W&amp;P atau Engineering.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('nama', 'Nama barang', { wide: true, input: { required: true, autoFocus: true, placeholder: 'mis. Ball valve' } })}
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-inkmute font-medium">Kategori</span>
          <select className="input" value={form.kategori_kode} onChange={set('kategori_kode')} required>
            <option value="" disabled>Pilih kategori</option>
            {(kategori || []).map((k) => <option key={k.kode} value={k.kode}>{k.nama}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-inkmute font-medium">Satuan</span>
          <input className="input" list="satuan-baru" value={form.satuan} onChange={set('satuan')} required maxLength={30} />
          <datalist id="satuan-baru">{SATUAN_UMUM.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        {field('ukuran', 'Ukuran', { input: { placeholder: 'mis. 1"' } })}
        {field('material', 'Material', { input: { placeholder: 'mis. PVC Sch 80' } })}
        {field('merek', 'Merek')}
        {field('model', 'Model / part number')}
        {field('spesifikasi', 'Spesifikasi', { wide: true })}
      </div>

      {mirip.length > 0 && (
        <div className="rounded-lg border border-line bg-canvas/50 px-4 py-3">
          <p className="text-xs font-medium text-inkmute">Mirip di katalog. Pilih kalau barangnya sama:</p>
          <ul className="mt-2 flex flex-col gap-1">
            {mirip.map((b) => (
              <li key={b.kode}>
                <button type="button" onClick={() => onPickExisting(b)} className="tap text-left text-sm hover:text-blueprint">
                  <span className="font-data text-xs text-inkmute">{b.kode}</span> {barangLabel(b)}
                  {b.model ? <span className="text-inkmute"> · {b.model}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-rust" role="alert">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn btn-ghost" disabled={busy}>Batal</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Tambah ke katalog'}</button>
      </div>
    </form>
  );
}
