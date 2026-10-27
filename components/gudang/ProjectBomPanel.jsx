import { useEffect, useState } from 'react';
import Link from 'next/link';
import { gudangApi, BOM_STATUS, fmtWaktu } from '../../lib/gudang';
import Panel from '../ui/Panel';
import StatusDot from './StatusDot';

// Ringkasan BOM satu project (di tab Ringkasan detail project). Data dari modul gudang (Supabase); kalau gagal dimuat,
// halaman project tetap jalan dan panel ini hanya memberi tahu.
export default function ProjectBomPanel({ projectId, writable }) {
  const [boms, setBoms] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!projectId) return undefined;
    gudangApi.listBom(projectId)
      .then((d) => { if (alive) setBoms(d); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [projectId]);

  const aktif = (boms || []).filter((b) => b.status !== 'diganti');
  const baru = `/gudang/bom?baru=1&project=${encodeURIComponent(projectId)}`;

  return (
    <Panel
      title="BOM & material"
      hint="BOM project dari modul gudang. Stok setiap barang dicek otomatis di halaman BOM."
      aside={writable && boms && <Link href={baru} className="tap text-sm font-medium text-blueprint hover:underline">Buat BOM</Link>}
      flush
    >
      {error ? (
        <p className="px-5 py-4 text-sm text-inkmute">BOM belum bisa dimuat ({error}).</p>
      ) : !boms ? (
        <div className="px-5 py-4"><div className="skeleton-shimmer rounded-lg h-10" /></div>
      ) : aktif.length === 0 ? (
        <p className="px-5 py-4 text-sm text-inkmute">
          Belum ada BOM untuk project ini.{writable ? ' Mulai dari salinan BOM lama project yang mirip supaya lebih cepat.' : ''}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {aktif.map((b) => (
            <li key={b.id}>
              <Link href={`/gudang/bom/${b.id}`} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-3 hover:bg-canvas/50">
                <span className="min-w-0">
                  <span className="text-ink">{b.judul}</span> <span className="text-inkmute">· Rev. {b.revisi}</span>
                  <span className="block text-xs text-inkmute mt-0.5">{b.jumlah_baris} baris · diubah {fmtWaktu(b.diubah_pada)}</span>
                </span>
                <StatusDot status={BOM_STATUS[b.status]} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
