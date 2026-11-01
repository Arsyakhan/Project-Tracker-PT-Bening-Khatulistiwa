import { useRef, useState } from 'react';
import { siapkanFoto, fotoApi } from '../../lib/foto';

function IkonKamera({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

// Foto barang langsung dari web: "Ambil foto" membuka kamera belakang HP (di komputer: pilih berkas), "Pilih dari
// galeri" membuka galeri/berkas. Foto dikecilkan di browser lalu disimpan; onSaved(foto) dipanggil sesudah tersimpan.
// varian 'ikon' = satu tombol kamera kecil untuk baris daftar (mis. stock opname).
export default function AmbilFoto({ kode, nama, opnameId, onSaved, varian = 'tombol' }) {
  const kamera = useRef(null);
  const galeri = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function simpan(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // supaya memilih berkas yang sama lagi tetap terbaca
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { besar, kecil } = await siapkanFoto(file);
      const foto = await fotoApi.unggah({ kode, opname_id: opnameId || null, besar, kecil });
      onSaved(foto);
    } catch (err) {
      setError(err.message || 'Foto belum tersimpan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  const inputs = (
    <>
      <input ref={kamera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={simpan} />
      <input ref={galeri} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={simpan} />
    </>
  );

  if (varian === 'ikon') {
    return (
      <span className="inline-flex flex-col items-end">
        {inputs}
        <button
          type="button"
          onClick={() => kamera.current?.click()}
          disabled={busy}
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-line text-inkmute hover:text-ink hover:border-ink/30 disabled:opacity-60"
          aria-label={busy ? `Menyimpan foto ${nama || kode}` : `Foto ${nama || kode}`}
          title="Ambil foto barang"
        >
          {busy ? <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin motion-reduce:animate-none" /> : <IkonKamera />}
        </button>
        {error && <span className="text-xs text-rust mt-1 max-w-[12rem] text-right" role="alert">{error}</span>}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {inputs}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" onClick={() => kamera.current?.click()} disabled={busy}>
          <IkonKamera />
          {busy ? 'Menyimpan foto...' : 'Ambil foto'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => galeri.current?.click()} disabled={busy}>
          Pilih dari galeri
        </button>
      </div>
      {error && <p className="text-sm text-rust" role="alert">{error}</p>}
    </div>
  );
}
