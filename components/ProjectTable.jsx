import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { StageBadge, PriorityBadge, DeliveryHint, Pill } from './Badges';
import { fmtDate, initialOf, hasDocGap } from '../lib/projectHelpers';

const PRIORITY_RANK = { High: 3, Medium: 2, Low: 1 };

const COLUMNS = [
  { key: 'po', label: 'PO Number', sort: (p) => p.poNumber },
  { key: 'name', label: 'Project', sort: (p) => p.projectName },
  { key: 'pic', label: 'PIC', sort: (p) => p.pic },
  { key: 'stage', label: 'Stage & progress', sort: (p) => p.stageProgress },
  { key: 'doc', label: 'Dokumen', sort: (p) => p.engineeringDocProgress },
  { key: 'priority', label: 'Priority', sort: (p) => PRIORITY_RANK[p.priority] || 0 },
  { key: 'delivery', label: 'Delivery', sort: (p) => p.deliveryDate || null, align: 'right' },
];

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

function barColor(sp) {
  if (sp >= 100) return 'bg-teal';
  if (sp >= 90) return 'bg-amber';
  return 'bg-blueprint';
}

function ProgressBar({ value, className = '' }) {
  return (
    <div className={`h-1.5 bg-line/60 rounded-full overflow-hidden ${className}`}>
      <div className={`h-full rounded-full ${barColor(value)}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function DocCell({ p }) {
  const v = p.engineeringDocProgress;
  const gap = hasDocGap(p);
  const tone = v >= 100 ? 'text-teal' : gap ? (v < 70 ? 'text-rust' : 'text-amberink') : 'text-inkmute';
  const bar = v >= 100 ? 'bg-teal' : gap ? (v < 70 ? 'bg-rust' : 'bg-amber') : 'bg-inkmute/60';
  return (
    <div className="flex flex-col gap-1 w-16" title={`Dokumen engineering ${v}%`}>
      <span className={`text-xs font-data tnum font-semibold ${tone}`}>{v}%</span>
      <div className="h-1 bg-line/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(v, 100)}%` }} />
      </div>
    </div>
  );
}

function DeliveryCell({ p }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-sm font-medium text-ink tnum">{p.deliveryDate ? fmtDate(p.deliveryDate) : '-'}</span>
      <DeliveryHint p={p} />
    </div>
  );
}

function ClientAvatar({ name }) {
  return (
    <span className="w-6 h-6 rounded-md bg-canvas border border-line flex items-center justify-center text-[10px] font-bold text-inkmute shrink-0">
      {initialOf(name)}
    </span>
  );
}

export default function ProjectTable({ projects }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const rows = useMemo(() => {
    if (!projects) return [];
    const col = COLUMNS.find((c) => c.key === sortKey);
    if (!col) return projects;
    return [...projects].sort((a, b) => {
      const av = col.sort(a);
      const bv = col.sort(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // kosong selalu di bawah
      if (bv == null) return -1;
      const c = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), 'id', { numeric: true });
      return sortDir === 'asc' ? c : -c;
    });
  }, [projects, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  if (!projects || projects.length === 0) return null;

  const hrefOf = (p) => `/projects/${encodeURIComponent(p.id)}`;

  return (
    <>
      {/* Tabel - tablet & desktop */}
      <div className="hidden md:block overflow-x-auto bg-panel rounded-lg border border-line shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-canvas/70 border-b border-line">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={`px-4 py-3 text-xs font-semibold text-inkmute whitespace-nowrap ${col.align === 'right' ? 'text-right' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={`inline-flex items-center gap-1 hover:text-ink transition-colors ${col.align === 'right' ? 'flex-row-reverse' : ''}`}
                  >
                    {col.label}
                    <SortIcon active={sortKey === col.key} dir={sortDir} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr
                key={p.id || p.poNumber}
                onClick={() => router.push(hrefOf(p))}
                className="hover:bg-blueprint/[0.04] transition-colors cursor-pointer group align-middle"
              >
                <td className="px-4 py-3.5 text-[11px] font-data text-inkmute whitespace-nowrap">{p.poNumber}</td>

                <td className="px-4 py-3.5 min-w-[240px] max-w-[320px]">
                  <Link
                    href={hrefOf(p)}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-ink group-hover:text-blueprint transition-colors line-clamp-2 leading-snug"
                  >
                    {p.projectName}
                  </Link>
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-inkmute min-w-0">
                    <ClientAvatar name={p.client} />
                    <span className="truncate">{p.client || '-'}</span>
                  </div>
                </td>

                <td className="px-4 py-3.5 text-sm text-ink whitespace-nowrap">{p.pic || '-'}</td>

                <td className="px-4 py-3.5 min-w-[190px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StageBadge stage={p.currentStage} />
                    {(p.status === 'On Hold' || p.status === 'Not Started') && (
                      <Pill tone={p.status === 'On Hold' ? 'amber' : 'neutral'} dot>{p.status}</Pill>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 mt-2">
                    <ProgressBar value={p.stageProgress} className="flex-1" />
                    <span className="text-xs font-data tnum font-semibold text-ink w-9 text-right">{p.stageProgress}%</span>
                  </div>
                </td>

                <td className="px-4 py-3.5"><DocCell p={p} /></td>

                <td className="px-4 py-3.5"><PriorityBadge priority={p.priority} /></td>

                <td className="px-4 py-3.5 whitespace-nowrap"><DeliveryCell p={p} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Kartu - mobile */}
      <div className="md:hidden flex flex-col gap-3">
        {rows.map((p) => (
          <Link
            key={p.id || p.poNumber}
            href={hrefOf(p)}
            className="bg-panel rounded-lg border border-line shadow-sm p-4 flex flex-col gap-3 active:bg-canvas/60 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-[10px] font-data text-inkmute">{p.poNumber}</span>
                <span className="block font-medium text-ink leading-snug line-clamp-2 mt-0.5">{p.projectName}</span>
              </div>
              <PriorityBadge priority={p.priority} />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <StageBadge stage={p.currentStage} />
              <DeliveryHint p={p} />
            </div>

            <div className="flex items-center gap-2.5">
              <ProgressBar value={p.stageProgress} className="flex-1" />
              <span className="text-xs font-data tnum font-semibold text-ink">{p.stageProgress}%</span>
            </div>

            <div className="flex items-center justify-between text-xs text-inkmute pt-2 border-t border-line/60">
              <span className="truncate">{p.client || '-'} · {p.pic || '-'}</span>
              <span className="tnum shrink-0 ml-3">Dok {p.engineeringDocProgress}%</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
