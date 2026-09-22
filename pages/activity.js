import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import { SkeletonTable } from '../components/Skeleton';
import PageHead from '../components/PageHead';

const ACTION_BADGE = {
  'Tambah': 'bg-teal/10 text-teal border-teal/20',
  'Update': 'bg-blueprint/10 text-blueprint border-blueprint/20',
  'Update Checklist': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  'Komentar': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
  'Hapus': 'bg-rust/10 text-rust border-rust/20',
};

function formatTimestamp(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function ActivityLogPage() {
  const [log, setLog] = useState(null);
  const [error, setError] = useState(null);
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    api.getActivityLog().then(setLog).catch((e) => setError(e.message));
  }, []);

  const { userOptions, actionOptions } = useMemo(() => {
    if (!log) return { userOptions: [], actionOptions: [] };
    return {
      userOptions: Array.from(new Set(log.map((l) => l.user).filter(Boolean))).sort(),
      actionOptions: Array.from(new Set(log.map((l) => l.action).filter(Boolean))).sort(),
    };
  }, [log]);

  if (error) return <div className="bg-panel border border-line rounded-lg p-6 text-rust">{error}</div>;

  if (!log) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Activity Log</h1>
        <SkeletonTable rows={8} />
      </div>
    );
  }

  const filtered = log.filter((l) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (l.poNumber || '').toLowerCase().includes(q) ||
      (l.projectName || '').toLowerCase().includes(q) ||
      (l.detail || '').toLowerCase().includes(q);
    const matchesUser = !userFilter || l.user === userFilter;
    const matchesAction = !actionFilter || l.action === actionFilter;
    return matchesSearch && matchesUser && matchesAction;
  });

  function resetFilters() {
    setSearchQuery('');
    setUserFilter('');
    setActionFilter('');
  }
  const hasActiveFilter = searchQuery || userFilter || actionFilter;

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Activity Log" />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Activity Log</h1>
          <p className="text-inkmute text-sm mt-1">Riwayat siapa mengubah apa. Menampilkan 300 aktivitas terakhir.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-inkmute" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Cari PO, project, atau detail..."
            className="border border-line rounded-md pl-9 pr-4 py-2 text-sm bg-panel outline-none focus:border-blueprint w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="border border-line rounded-md px-3 py-2 text-sm bg-panel outline-none focus:border-blueprint text-ink"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
        >
          <option value="">Semua User</option>
          {userOptions.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>

        <select
          className="border border-line rounded-md px-3 py-2 text-sm bg-panel outline-none focus:border-blueprint text-ink"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">Semua Aksi</option>
          {actionOptions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        {hasActiveFilter && (
          <button onClick={resetFilters} className="text-xs text-inkmute hover:text-rust font-medium px-2 py-1">
            Reset filter
          </button>
        )}

        <span className="text-xs text-inkmute ml-auto">
          Menampilkan {filtered.length} dari {log.length} aktivitas
        </span>
      </div>

      <div className="hidden md:block overflow-x-auto bg-panel rounded-xl border border-line shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="text-[11px] text-inkmute uppercase bg-canvas/80 border-b border-line tracking-wider">
            <tr>
              <th className="px-5 py-3 font-semibold whitespace-nowrap">Waktu</th>
              <th className="px-5 py-3 font-semibold">User</th>
              <th className="px-5 py-3 font-semibold">Aksi</th>
              <th className="px-5 py-3 font-semibold">Project</th>
              <th className="px-5 py-3 font-semibold">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((l, idx) => (
              <tr key={idx} className="hover:bg-canvas/40 transition-colors align-top">
                <td className="px-5 py-3 text-xs text-inkmute whitespace-nowrap">{formatTimestamp(l.timestamp)}</td>
                <td className="px-5 py-3 text-sm text-ink whitespace-nowrap">{l.user || '-'}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${ACTION_BADGE[l.action] || 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'}`}>
                    {l.action}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm min-w-[180px]">
                  {l.projectId ? (
                    <Link href={`/projects/${encodeURIComponent(l.projectId)}`} className="text-blueprint hover:underline">
                      {l.projectName || l.poNumber}
                    </Link>
                  ) : (
                    <span className="text-inkmute">{l.projectName || l.poNumber || '-'}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-xs text-inkmute max-w-md break-words">{l.detail || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tampilan Card - Mobile */}
      <div className="md:hidden flex flex-col gap-3">
        {filtered.map((l, idx) => (
          <div key={idx} className="bg-panel rounded-xl border border-line shadow-sm p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${ACTION_BADGE[l.action] || 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'}`}>
                {l.action}
              </span>
              <span className="text-[10px] text-inkmute">{formatTimestamp(l.timestamp)}</span>
            </div>
            {l.projectId ? (
              <Link href={`/projects/${encodeURIComponent(l.projectId)}`} className="text-blueprint font-medium text-sm hover:underline">
                {l.projectName || l.poNumber}
              </Link>
            ) : (
              <span className="text-inkmute text-sm">{l.projectName || l.poNumber || '-'}</span>
            )}
            <p className="text-xs text-inkmute break-words">{l.detail || '-'}</p>
            <p className="text-[11px] text-inkmute border-t border-line/60 pt-2">oleh {l.user || 'Tidak diketahui'}</p>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-inkmute py-8 bg-panel border border-line rounded-lg">
          Tidak ada aktivitas yang cocok dengan filter.
        </div>
      )}
    </div>
  );
}
