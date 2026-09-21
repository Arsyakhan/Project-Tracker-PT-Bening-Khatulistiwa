import { useMemo, useState } from 'react';
import Link from 'next/link';

function compareValues(a, b, key) {
  const av = a[key];
  const bv = b[key];
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  return String(av).localeCompare(String(bv), 'id', { numeric: true });
}

function SortIcon({ active, dir }) {
  return (
    <svg
      className={`w-3 h-3 transition-transform ${active ? 'text-blueprint' : 'text-inkmute/40'} ${active && dir === 'desc' ? 'rotate-180' : ''}`}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

// Fungsi untuk memberi warna badge secara otomatis berdasarkan nama tahapan
const getStageBadge = (stage) => {
  const s = stage?.toLowerCase() || '';
  if (s.includes('po') || s.includes('sos')) return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  if (s.includes('procurement') || s.includes('collecting')) return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800';
  if (s.includes('fabrication')) return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800';
  if (s.includes('delivery')) return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800';
  if (s.includes('installation') || s.includes('commissioning')) return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800';
  return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
};

function DeliveryInfo({ p }) {
  if (!p.deliveryDate) return <span className="text-inkmute">-</span>;
  return (
    <>
      <span className="text-sm font-semibold text-ink">{p.deliveryDate}</span>
      {p.stageProgress >= 100 ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#4E7B5B]/10 text-[#4E7B5B] uppercase tracking-wide">
          Selesai
        </span>
      ) : p.stageProgress >= 90 ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blueprint/10 text-blueprint uppercase tracking-wide">
          Terkirim
        </span>
      ) : (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${p.daysRemaining < 0 ? 'bg-rust/10 text-rust border border-rust/20' : 'bg-canvas text-inkmute border border-line'}`}>
          {p.daysRemaining < 0 ? `Terlewat ${Math.abs(p.daysRemaining)} hari` : `${p.daysRemaining} hari lagi`}
        </span>
      )}
    </>
  );
}

export default function ProjectTable({ projects }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    if (!sortKey) return projects;
    const sorted = [...projects].sort((a, b) => compareValues(a, b, sortKey));
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [projects, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  if (!projects || projects.length === 0) {
    return <div className="p-6 text-center text-inkmute text-sm bg-panel rounded-lg border border-line">Tidak ada project yang ditemukan.</div>;
  }

  const columns = [
    { key: 'poNumber', label: 'PO Number' },
    { key: 'projectName', label: 'Project Name' },
    { key: 'client', label: 'Client' },
    { key: 'pic', label: 'PIC' },
    { key: 'currentStage', label: 'Stage' },
    { key: 'stageProgress', label: 'Progress' },
    { key: 'deliveryDate', label: 'Delivery Target' },
  ];

  return (
    <>
      {/* Tampilan Tabel - Desktop & Tablet */}
      <div className="hidden md:block overflow-x-auto bg-panel rounded-xl border border-line shadow-sm">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-[11px] text-inkmute uppercase bg-canvas/80 border-b border-line tracking-wider">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={`px-5 py-4 font-semibold cursor-pointer select-none hover:text-ink transition-colors ${col.key === 'stageProgress' ? 'min-w-[150px]' : ''} ${col.key === 'deliveryDate' ? 'text-right' : ''}`}
                >
                  <span className={`inline-flex items-center gap-1 ${col.key === 'deliveryDate' ? 'flex-row-reverse' : ''}`}>
                    {col.label}
                    <SortIcon active={sortKey === col.key} dir={sortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {sortedProjects.map((p, idx) => (
              <tr key={idx} className="hover:bg-canvas/40 transition-colors group">
                <td className="px-5 py-4 text-xs font-mono text-inkmute">{p.poNumber}</td>

                <td className="px-5 py-4 font-medium whitespace-normal min-w-[250px]">
                  <Link href={`/projects/${encodeURIComponent(p.poNumber)}`} className="text-blueprint group-hover:text-blueprintdark group-hover:underline transition-colors line-clamp-2 leading-snug">
                    {p.projectName}
                  </Link>
                </td>

                <td className="px-5 py-4 text-ink">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-canvas border border-line flex items-center justify-center text-[10px] font-bold text-inkmute shadow-sm">
                      {p.client ? p.client.substring(0, 1).toUpperCase() : '-'}
                    </div>
                    <span className="truncate max-w-[150px] font-medium text-sm">{p.client || '-'}</span>
                  </div>
                </td>

                <td className="px-5 py-4 text-ink text-sm">{p.pic || '-'}</td>

                <td className="px-5 py-4">
                  <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${getStageBadge(p.currentStage)}`}>
                    {p.currentStage || 'Unknown'}
                  </span>
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-canvas rounded-full overflow-hidden border border-line/50">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${p.stageProgress >= 100 ? 'bg-teal' : p.stageProgress >= 90 ? 'bg-orange-400' : 'bg-blueprint'}`}
                        style={{ width: `${p.stageProgress}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-data font-bold text-ink w-8">{p.stageProgress}%</span>
                  </div>
                </td>

                <td className="px-5 py-4 text-right flex flex-col items-end gap-1.5 justify-center h-full">
                  <DeliveryInfo p={p} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tampilan Card - Mobile */}
      <div className="md:hidden flex flex-col gap-3">
        {sortedProjects.map((p, idx) => (
          <Link
            key={idx}
            href={`/projects/${encodeURIComponent(p.poNumber)}`}
            className="bg-panel rounded-xl border border-line shadow-sm p-4 flex flex-col gap-3 active:bg-canvas/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[10px] font-mono text-inkmute">{p.poNumber}</span>
                <span className="font-medium text-blueprint leading-snug line-clamp-2">{p.projectName}</span>
              </div>
              <span className={`shrink-0 px-2 py-1 rounded-md text-[10px] font-semibold border ${getStageBadge(p.currentStage)}`}>
                {p.currentStage || 'Unknown'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-canvas rounded-full overflow-hidden border border-line/50">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${p.stageProgress >= 100 ? 'bg-teal' : p.stageProgress >= 90 ? 'bg-orange-400' : 'bg-blueprint'}`}
                  style={{ width: `${p.stageProgress}%` }}
                ></div>
              </div>
              <span className="text-xs font-data font-bold text-ink">{p.stageProgress}%</span>
            </div>

            <div className="flex items-center justify-between text-xs text-inkmute pt-2 border-t border-line/60">
              <span>{p.client || '-'} &middot; {p.pic || '-'}</span>
              <span className="flex items-center gap-1.5">
                <DeliveryInfo p={p} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
