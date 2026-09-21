import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { api } from '../lib/api';

const STATIC_ACTIONS = [
  { label: 'Dashboard', href: '/', keywords: 'dashboard beranda' },
  { label: 'Semua Project', href: '/projects', keywords: 'projects daftar list' },
  { label: 'Engineering Docs', href: '/engineering-docs', keywords: 'dokumen docs checklist' },
  { label: 'Aktivitas', href: '/activity', keywords: 'activity log riwayat' },
  { label: '+ Project Baru', href: '/projects/new', keywords: 'tambah new create' },
];

export default function CommandPalette({ open, onClose }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [projects, setProjects] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      if (projects === null) {
        api.getProjects().then(setProjects).catch(() => setProjects([]));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();

    const actionMatches = STATIC_ACTIONS
      .filter((a) => !q || a.label.toLowerCase().includes(q) || a.keywords.includes(q))
      .map((a) => ({ type: 'action', label: a.label, href: a.href }));

    const projectMatches = !q
      ? []
      : (projects || [])
          .filter(
            (p) =>
              (p.poNumber || '').toLowerCase().includes(q) ||
              (p.projectName || '').toLowerCase().includes(q) ||
              (p.client || '').toLowerCase().includes(q)
          )
          .slice(0, 8)
          .map((p) => ({
            type: 'project',
            label: p.projectName,
            sub: p.poNumber,
            href: `/projects/${encodeURIComponent(p.id)}`,
          }));

    return [...projectMatches, ...actionMatches].slice(0, 10);
  }, [query, projects]);

  useEffect(() => {
    function handleKey(e) {
      if (!open) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const r = results[activeIndex];
        if (r) {
          router.push(r.href);
          onClose();
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, results, activeIndex, onClose, router]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-panel rounded-xl border border-line shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line">
          <svg className="w-4 h-4 text-inkmute flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Cari project, atau ketik untuk pindah halaman..."
            className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-inkmute"
          />
          <kbd className="text-[10px] text-inkmute border border-line rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 && <div className="px-4 py-6 text-center text-sm text-inkmute">Tidak ada hasil.</div>}
          {results.map((r, idx) => (
            <button
              key={r.href + idx}
              onClick={() => {
                router.push(r.href);
                onClose();
              }}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 text-sm transition-colors ${
                idx === activeIndex ? 'bg-blueprint/10 text-blueprint' : 'text-ink hover:bg-canvas'
              }`}
            >
              <span className="truncate">{r.label}</span>
              {r.sub && <span className="text-xs text-inkmute font-mono flex-shrink-0">{r.sub}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
