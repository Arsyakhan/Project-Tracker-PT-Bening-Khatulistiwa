import Link from 'next/link';
import { useMemo } from 'react';
import { api } from '../lib/api';
import useCachedResource from '../lib/useCachedResource';
import useProjects from '../lib/useProjects';
import { Pill } from './Badges';
import { isOpen, etaState, etaText, urgencySort } from '../lib/procurement';

// Ringkasan pengadaan di Dashboard: berapa barang belum datang, berapa yang terlambat,
// dan 3 yang paling mendesak. Datanya dipakai bersama halaman Pengadaan (cache yang sama).
export default function ProcurementSummary() {
  const { data: items, error } = useCachedResource('procurement', () => api.getProcurement());
  const { projects } = useProjects();

  const open = useMemo(() => (items || []).filter(isOpen), [items]);
  const late = open.filter((i) => etaState(i).state === 'late').length;
  const soon = open.filter((i) => etaState(i).state === 'soon').length;
  const top = useMemo(() => [...open].sort(urgencySort).slice(0, 3), [open]);
  const nameOf = (it) => {
    const p = (projects || []).find((x) => x.id === it.projectId);
    return p ? p.projectName : it.forLabel ? `Untuk ${it.forLabel}` : '';
  };

  // Backend belum diperbarui / gagal memuat: jangan ganggu dashboard.
  if (error && !items) return null;
  if (!items) return <div className="skeleton-shimmer rounded-lg h-32" />;
  // Belum ada data sama sekali: kartu tetap tampil supaya fiturnya ketemu.

  return (
    <section className="bg-panel border border-line rounded-lg p-5 shadow-sm flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">
          Material yang belum datang
          <span className={`ml-2 font-data tnum ${open.length > 0 ? 'text-ink' : 'text-teal'}`}>{open.length}</span>
        </h2>
        <div className="flex items-center gap-2">
          {late > 0 && <Pill tone="rust" dot>{late} terlambat</Pill>}
          {soon > 0 && <Pill tone="amber">{soon} tiba ≤ 7 hari</Pill>}
          <Link href="/procurement" className="text-sm font-medium text-blueprint hover:underline whitespace-nowrap">Buka pengadaan</Link>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-inkmute">Belum ada barang yang dicatat. Catat barang yang sedang ditunggu (membran, pompa, dll.) di halaman Pengadaan.</p>
      ) : top.length === 0 ? (
        <p className="text-sm text-teal">Semua barang yang dicatat sudah diterima.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {top.map((it) => {
            const st = etaState(it).state;
            return (
              <li key={it.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{it.item}{it.qty ? ` · ${it.qty}` : ''}</p>
                  <p className="text-xs text-inkmute mt-0.5 truncate">{[nameOf(it), it.vendor, it.status].filter(Boolean).join(' · ')}</p>
                </div>
                {it.eta ? <Pill tone={st === 'late' ? 'rust' : st === 'soon' ? 'amber' : 'neutral'}>{etaText(it)}</Pill> : <span className="text-xs text-inkmute/70 whitespace-nowrap">ETA belum ada</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
