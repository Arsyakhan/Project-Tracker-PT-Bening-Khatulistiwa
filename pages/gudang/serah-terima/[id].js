import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { gudangApi, nomorSerahTerima, barangLabel, fmtQty, fmtWaktu } from '../../../lib/gudang';
import PageHead from '../../../components/PageHead';
import PageHeader from '../../../components/ui/PageHeader';
import Panel from '../../../components/ui/Panel';

const fmtTgl = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

// Dokumen serah terima barang ke teknisi. Bisa dicetak untuk ditandatangani (bagian tanda tangan hanya tampil saat cetak).
export default function SerahTerimaDetail() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setData(await gudangApi.getSerahTerima(id));
      setError(null);
    } catch (e) {
      setError({ message: e.message, notFound: e.status === 404 });
    }
  }, [id]);
  useEffect(() => { setData(null); load(); }, [load]);

  const crumbs = [{ href: '/gudang/serah-terima', label: 'Serah terima' }, { label: data ? nomorSerahTerima(data.serahTerima.id) : '...' }];

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Serah Terima" />
        <PageHeader crumbs={crumbs} title="Serah Terima" />
        <div className="bg-panel border border-line rounded-xl p-6 flex flex-col gap-3" role="alert">
          <p className="text-rust text-sm">{error.message}</p>
          <div>
            {error.notFound
              ? <Link href="/gudang/serah-terima" className="btn btn-secondary">Kembali ke Serah terima</Link>
              : <button type="button" onClick={load} className="btn btn-secondary">Coba lagi</button>}
          </div>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Serah Terima" />
        <PageHeader crumbs={crumbs} title="Serah Terima" meta="Memuat..." />
        <div className="skeleton-shimmer rounded-xl h-64" />
      </div>
    );
  }

  const { serahTerima: s, lokasi, baris } = data;
  const nomor = nomorSerahTerima(s.id);

  return (
    <div className="flex flex-col gap-5">
      <PageHead title={`${nomor} ${s.project_nama}`} />
      <PageHeader
        crumbs={crumbs}
        title={`${nomor} · ${s.project_nama}`}
        meta={`Diserahkan ke ${s.penerima} pada ${fmtTgl(s.tanggal)}, dari ${lokasi.nama}. Dicatat ${fmtWaktu(s.dibuat_pada)} oleh ${s.dibuat_oleh}.`}
        actions={
          <span className="flex gap-2 print:hidden">
            <Link href={`/projects/${encodeURIComponent(s.project_id)}`} className="btn btn-ghost">Buka project</Link>
            <button type="button" onClick={() => window.print()} className="btn btn-secondary">Cetak</button>
          </span>
        }
      />

      <Panel title="Barang yang diserahkan" hint={s.catatan || undefined} flush>
        <table className="w-full text-sm">
          <caption className="sr-only">Barang yang diserahkan ke teknisi</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-inkmute">
              <th scope="col" className="px-5 py-3 font-medium">Barang</th>
              <th scope="col" className="px-3 py-3 font-medium max-sm:hidden">BOM</th>
              <th scope="col" className="px-5 py-3 font-medium text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {baris.map((b) => (
              <tr key={b.id}>
                <td className="px-5 py-3">
                  <span className="block text-ink">{barangLabel(b.barang || { nama: b.barang_kode })}</span>
                  <span className="block text-xs text-inkmute">
                    <span className="font-data">{b.barang_kode}</span>
                    {[b.barang?.merek, b.barang?.model].filter(Boolean).length ? ` · ${[b.barang?.merek, b.barang?.model].filter(Boolean).join(' · ')}` : ''}
                  </span>
                </td>
                <td className="px-3 py-3 text-inkmute max-sm:hidden">{b.bom ? `${b.bom.judul} Rev. ${b.bom.revisi}` : '-'}</td>
                <td className="px-5 py-3 text-right tnum whitespace-nowrap font-semibold text-ink">
                  {fmtQty(b.qty)} <span className="font-normal text-inkmute">{b.barang?.satuan}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* Hanya saat dicetak: tempat tanda tangan */}
      <div className="hidden print:grid grid-cols-2 gap-10 pt-10 text-sm text-ink">
        <div><p>Diserahkan oleh (W&amp;P)</p><p className="mt-16 border-t border-ink pt-1">&nbsp;</p></div>
        <div><p>Diterima oleh</p><p className="mt-16 border-t border-ink pt-1">{s.penerima}</p></div>
      </div>
    </div>
  );
}
