import { useMemo, useState } from 'react';
import { gudangApi, barangLabel, fmtQty, fmtWaktu, ringkasUsulan, tahapPengadaan } from '../../lib/gudang';
import { clearCache } from '../../lib/persistedCache';
import Panel from '../ui/Panel';
import StatusDot from './StatusDot';

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtTgl = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');

// Usulan yang disetujui: W&P mencatat pemesanan (no. PO, tanggal pesan, ETA), lalu mencatat barang yang datang
// (bisa bertahap). Barang yang diterima masuk stok lokasi yang dipilih dan langsung disisihkan untuk project-nya.
export default function PengadaanPanel({ usulan: u, baris, lokasi, penerimaan, writable, onChanged, showToast }) {
  const [pesan, setPesan] = useState(null); // { no_po, tanggal_pesan, eta } saat diubah
  const [terima, setTerima] = useState(null); // { lokasi_kode, tanggal, referensi, qty: { [baris_id]: '' } }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const r = useMemo(() => ringkasUsulan(baris), [baris]);
  const tahap = tahapPengadaan(u, r);
  const sisaOf = (l) => Math.max(0, Number(l.qty_beli) - Number(l.qty_diterima || 0));
  const belumLengkap = baris.filter((l) => sisaOf(l) > 0);
  const namaOf = useMemo(() => Object.fromEntries(baris.map((l) => [l.id, l])), [baris]);
  const lokasiNama = useMemo(() => Object.fromEntries((lokasi || []).map((l) => [l.kode, l.nama])), [lokasi]);

  async function run(fn, pesanSukses) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      clearCache('gudang-usulan');
      clearCache('gudang-katalog');
      showToast(pesanSukses);
      setPesan(null);
      setTerima(null);
      await onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const simpanPesan = (e) => {
    e.preventDefault();
    run(() => gudangApi.catatPesanan({ id: u.id, ...pesan }), 'Pemesanan dicatat');
  };
  const simpanTerima = (e) => {
    e.preventDefault();
    const items = Object.entries(terima.qty).map(([baris_id, qty]) => ({ baris_id: Number(baris_id), qty })).filter((i) => String(i.qty).trim() !== '' && Number(String(i.qty).replace(',', '.')) !== 0);
    if (!items.length) {
      setError('Isi jumlah barang yang diterima.');
      return;
    }
    run(() => gudangApi.terimaBarang({ usulan_id: u.id, lokasi_kode: terima.lokasi_kode, tanggal: terima.tanggal, referensi: terima.referensi, items }), 'Barang diterima, stok dan penyisihan diperbarui');
  };
  const mulaiTerima = () => {
    setError(null);
    setTerima({
      lokasi_kode: (lokasi && lokasi[0] && lokasi[0].kode) || '',
      tanggal: todayIso(),
      referensi: '',
      qty: Object.fromEntries(belumLengkap.map((l) => [l.id, String(sisaOf(l))])),
    });
  };

  return (
    <Panel
      title="Pemesanan dan penerimaan"
      hint="Dicatat W&P. Barang yang diterima masuk stok gudang dan langsung disisihkan untuk project ini, siap diserahkan ke teknisi."
      aside={tahap && <StatusDot status={tahap} />}
    >
      <div className="flex flex-col gap-6">
        <section aria-labelledby="pemesanan-judul">
          <div className="flex items-center justify-between gap-3">
            <h3 id="pemesanan-judul" className="text-sm font-semibold text-ink">Pemesanan</h3>
            {writable && !pesan && (
              <button
                type="button"
                className="tap text-sm font-medium text-blueprint hover:underline"
                onClick={() => { setError(null); setPesan({ no_po: u.no_po || '', tanggal_pesan: u.tanggal_pesan || todayIso(), eta: u.eta || '' }); }}
              >
                {u.no_po || u.tanggal_pesan ? 'Ubah' : 'Catat pemesanan'}
              </button>
            )}
          </div>
          {pesan ? (
            <form onSubmit={simpanPesan} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-inkmute font-medium">Nomor PO</span>
                <input className="input" value={pesan.no_po} onChange={(e) => setPesan((p) => ({ ...p, no_po: e.target.value }))} maxLength={100} autoFocus />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-inkmute font-medium">Tanggal pesan</span>
                <input className="input" type="date" value={pesan.tanggal_pesan} onChange={(e) => setPesan((p) => ({ ...p, tanggal_pesan: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-inkmute font-medium">Perkiraan tiba (ETA)</span>
                <input className="input" type="date" value={pesan.eta} onChange={(e) => setPesan((p) => ({ ...p, eta: e.target.value }))} />
              </label>
              <div className="sm:col-span-3 flex justify-end gap-3">
                <button type="button" className="btn btn-ghost" onClick={() => setPesan(null)} disabled={busy}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan pemesanan'}</button>
              </div>
            </form>
          ) : u.no_po || u.tanggal_pesan ? (
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm mt-2">
              <div><dt className="text-xs text-inkmute">Nomor PO</dt><dd className="text-ink font-data">{u.no_po || '-'}</dd></div>
              <div><dt className="text-xs text-inkmute">Tanggal pesan</dt><dd className="text-ink">{fmtTgl(u.tanggal_pesan)}</dd></div>
              <div>
                <dt className="text-xs text-inkmute">ETA</dt>
                <dd className={u.eta && u.eta < todayIso() && tahap?.label !== 'Diterima lengkap' ? 'text-rust font-medium' : 'text-ink'}>{fmtTgl(u.eta)}</dd>
              </div>
              <div><dt className="text-xs text-inkmute">Dicatat</dt><dd className="text-ink truncate" title={u.dipesan_oleh}>{fmtWaktu(u.dipesan_pada)}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-inkmute mt-1">Belum dipesan.</p>
          )}
        </section>

        <section aria-labelledby="penerimaan-judul" className="border-t border-line pt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 id="penerimaan-judul" className="text-sm font-semibold text-ink">Barang diterima</h3>
            {writable && !terima && belumLengkap.length > 0 && (
              <button type="button" className="btn btn-secondary" onClick={mulaiTerima}>Catat barang diterima</button>
            )}
          </div>
          {terima ? (
            <form onSubmit={simpanTerima} className="flex flex-col gap-4 mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-inkmute font-medium">Disimpan di</span>
                  <select className="input" value={terima.lokasi_kode} onChange={(e) => setTerima((t) => ({ ...t, lokasi_kode: e.target.value }))} required>
                    {(lokasi || []).map((l) => <option key={l.kode} value={l.kode}>{l.nama}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-inkmute font-medium">Tanggal terima</span>
                  <input className="input" type="date" value={terima.tanggal} onChange={(e) => setTerima((t) => ({ ...t, tanggal: e.target.value }))} required />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-inkmute font-medium">No. surat jalan (opsional)</span>
                  <input className="input" value={terima.referensi} onChange={(e) => setTerima((t) => ({ ...t, referensi: e.target.value }))} maxLength={100} />
                </label>
              </div>
              <ul className="divide-y divide-line border border-line rounded-lg">
                {belumLengkap.map((l) => (
                  <li key={l.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <span className="min-w-0 flex-1">
                      <span className="block text-ink">{barangLabel(l.barang || { nama: l.barang_kode })}</span>
                      <span className="block text-xs text-inkmute">
                        <span className="font-data">{l.barang_kode}</span> · dibeli {fmtQty(l.qty_beli)} · sudah diterima {fmtQty(l.qty_diterima || 0)} · sisa {fmtQty(sisaOf(l))}
                      </span>
                    </span>
                    <label className="flex items-center gap-2 text-sm">
                      <span className="sr-only">Jumlah diterima {l.barang_kode}</span>
                      <input
                        className="input !w-28 tnum"
                        inputMode="decimal"
                        value={terima.qty[l.id] ?? ''}
                        onChange={(e) => setTerima((t) => ({ ...t, qty: { ...t.qty, [l.id]: e.target.value } }))}
                      />
                      <span className="text-inkmute">{l.satuan}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-inkmute -mt-2">Isi 0 atau kosongkan untuk barang yang belum datang. Penerimaan bisa dicatat bertahap.</p>
              <div className="flex justify-end gap-3">
                <button type="button" className="btn btn-ghost" onClick={() => setTerima(null)} disabled={busy}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan penerimaan'}</button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-inkmute mt-1">
              {r.baris_lengkap} dari {r.jumlah_barang} barang sudah diterima lengkap.
              {belumLengkap.length > 0 && belumLengkap.length < r.jumlah_barang ? ` Belum lengkap: ${belumLengkap.map((l) => l.barang_kode).join(', ')}.` : ''}
            </p>
          )}
          {error && <p className="text-sm text-rust mt-3" role="alert">{error}</p>}

          {penerimaan && penerimaan.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {penerimaan.map((t) => {
                const l = namaOf[t.usulan_baris_id];
                return (
                  <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <span className="min-w-0">
                      <span className="text-ink">{l ? barangLabel(l.barang || { nama: t.barang_kode }) : t.barang_kode}</span>
                      <span className="text-xs text-inkmute"> · {fmtTgl(t.tanggal)} · {lokasiNama[t.lokasi_kode] || t.lokasi_kode}{t.referensi ? ` · ${t.referensi}` : ''}</span>
                    </span>
                    <span className="tnum font-medium text-teal whitespace-nowrap">+{fmtQty(t.qty)} {l ? l.satuan : ''}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Panel>
  );
}
