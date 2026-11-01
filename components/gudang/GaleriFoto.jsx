import { useState } from 'react';
import { fotoSrc, fotoUtama, domainSumber, fotoApi } from '../../lib/foto';
import { setKatalogFoto } from '../../lib/gudang';
import Panel from '../ui/Panel';
import ConfirmModal from '../ConfirmModal';
import { FotoBarang } from './FotoBarang';
import AmbilFoto from './AmbilFoto';

const fmtTgl = (ts) => new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

// Galeri foto di detail barang. Foto utama tampil besar (foto gudang lebih dulu daripada foto contoh internet);
// editor bisa memotret/mengunggah, menempel tautan foto internet, dan menghapus foto.
export default function GaleriFoto({ kode, nama, kategori, fotos: awal, writable }) {
  const [fotos, setFotos] = useState(awal || []);
  const [aktifId, setAktifId] = useState(() => fotoUtama(awal)?.id ?? null);
  const [tautan, setTautan] = useState(null); // { url, halaman } saat form tempel tautan terbuka
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [hapus, setHapus] = useState(false);

  const aktif = fotos.find((f) => f.id === aktifId) || fotoUtama(fotos);

  function terapkan(next, pilihId) {
    setFotos(next);
    setAktifId(pilihId ?? fotoUtama(next)?.id ?? null);
    setKatalogFoto(kode, fotoUtama(next));
  }

  async function simpanTautan(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const f = await fotoApi.tautkan({ kode, url: tautan.url.trim(), halaman_sumber: tautan.halaman.trim() });
      terapkan([f, ...fotos], f.id);
      setTautan(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function hapusAktif() {
    setBusy(true);
    setError(null);
    try {
      await fotoApi.hapus(aktif.id);
      terapkan(fotos.filter((f) => f.id !== aktif.id));
      setHapus(false);
    } catch (err) {
      setError(err.message);
      setHapus(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Foto" aside={fotos.length > 1 ? <span className="text-xs text-inkmute tnum">{fotos.length} foto</span> : null} flush>
      <div className="p-4 flex flex-col gap-3">
        {aktif ? (
          <a href={fotoSrc(aktif, false)} target="_blank" rel="noopener noreferrer" className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint" title="Buka foto ukuran penuh">
            <FotoBarang foto={aktif} kategori={kategori} alt={`Foto ${nama}`} ukuran="besar" label className="aspect-square rounded-lg border border-line" />
          </a>
        ) : (
          <FotoBarang foto={null} kategori={kategori} ukuran="besar" className="aspect-square rounded-lg border border-line" />
        )}

        {fotos.length > 1 && (
          <ul className="flex flex-wrap gap-2" aria-label="Foto lain">
            {fotos.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setAktifId(f.id)}
                  aria-pressed={f.id === aktif?.id}
                  aria-label={`Lihat foto ${f.sumber === 'gudang' ? 'gudang' : 'contoh'} ${fmtTgl(f.dibuat_pada)}`}
                  className={`block rounded-md border-2 ${f.id === aktif?.id ? 'border-blueprint' : 'border-transparent hover:border-line'}`}
                >
                  <FotoBarang foto={f} kategori={kategori} ukuran="kecil" className="w-12 h-12 rounded" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {aktif && (
          <p className="text-xs text-inkmute">
            {aktif.sumber === 'gudang' ? (
              <>Foto gudang, {fmtTgl(aktif.dibuat_pada)} oleh {aktif.dibuat_oleh}{aktif.opname_id ? ' saat stock opname' : ''}.</>
            ) : (
              <>
                Foto contoh dari internet. {aktif.keterangan || 'Belum tentu sama persis dengan barang di gudang.'}{' '}
                {(aktif.halaman_sumber || aktif.url) && (
                  <a href={aktif.halaman_sumber || aktif.url} target="_blank" rel="noopener noreferrer" className="text-blueprint hover:underline">
                    Sumber: {domainSumber(aktif)}
                  </a>
                )}
              </>
            )}
          </p>
        )}

        {writable && (
          <div className="flex flex-col gap-2 pt-1">
            <AmbilFoto kode={kode} nama={nama} onSaved={(f) => terapkan([f, ...fotos], f.id)} />
            {tautan ? (
              <form onSubmit={simpanTautan} className="flex flex-col gap-2 rounded-lg border border-line p-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-inkmute font-medium">Tautan gambar</span>
                  <input className="input" type="url" required placeholder="https://.../gambar.jpg" value={tautan.url} onChange={(e) => setTautan((t) => ({ ...t, url: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-inkmute font-medium">Halaman sumber (opsional)</span>
                  <input className="input" type="url" placeholder="https://toko-atau-pabrikan/..." value={tautan.halaman} onChange={(e) => setTautan((t) => ({ ...t, halaman: e.target.value }))} />
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn btn-ghost" onClick={() => setTautan(null)} disabled={busy}>Batal</button>
                  <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan tautan'}</button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <button type="button" className="tap text-sm font-medium text-blueprint hover:underline" onClick={() => setTautan({ url: '', halaman: '' })}>
                  Tempel tautan foto dari internet
                </button>
                {aktif && (
                  <button type="button" className="tap text-sm font-medium text-rust hover:underline" onClick={() => setHapus(true)}>
                    Hapus foto ini
                  </button>
                )}
              </div>
            )}
            {error && <p className="text-sm text-rust" role="alert">{error}</p>}
          </div>
        )}
      </div>

      <ConfirmModal
        open={hapus}
        title="Hapus foto ini?"
        description={aktif?.sumber === 'gudang' ? 'Foto gudang dihapus permanen.' : 'Tautan foto contoh dihapus dari barang ini.'}
        confirmText={busy ? 'Menghapus...' : 'Hapus foto'}
        confirmDisabled={busy}
        onConfirm={hapusAktif}
        onCancel={() => setHapus(false)}
      />
    </Panel>
  );
}
