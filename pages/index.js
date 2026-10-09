import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { api } from '../lib/api';
import useCachedResource from '../lib/useCachedResource';
import useProjects from '../lib/useProjects';
import PageHead from '../components/PageHead';
import RefreshStatus from '../components/RefreshStatus';
import { Pill } from '../components/Badges';
import { SkeletonPanel } from '../components/Skeleton';
import { computeOpenItems, fmtLong, fmtTimeRange, relativeDay, todayIso } from '../lib/meetings';
import {
  DIVISIONS, buildActionItems, countsByDivision, filterByDivision, groupBySeverity, summaryText, workloadByDivision,
} from '../lib/today';

const DIVISION_KEY = 'ptbk_today_division';
const PREVIEW = 8;
const KIND_LABEL = { project: 'Project', doc: 'Dokumen', proc: 'Pengadaan', meeting: 'Rapat', blocked: 'Terhambat', next: 'Langkah berikutnya' };
const SEV_TONE = {
  0: { bar: 'border-l-rust', pill: 'rust', title: 'text-rust', tile: 'bg-rust/10 text-rust', dot: 'bg-rust' },
  1: { bar: 'border-l-amber', pill: 'amber', title: 'text-amberink', tile: 'bg-amber/15 text-amberink', dot: 'bg-amber' },
  2: { bar: 'border-l-line', pill: 'neutral', title: 'text-inkmute', tile: 'bg-inkmute/10 text-inkmute', dot: 'bg-inkmute' },
};
const KIND_ICON = {
  project: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
  doc: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  proc: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12',
  meeting: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  blocked: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  next: 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3',
};

function KindIcon({ kind, className = 'w-[18px] h-[18px]' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={KIND_ICON[kind] || KIND_ICON.project} />
    </svg>
  );
}

function greeting(hour) {
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 19) return 'Selamat sore';
  return 'Selamat malam';
}

function readDivision() {
  try {
    const v = window.localStorage.getItem(DIVISION_KEY) || '';
    return DIVISIONS.includes(v) ? v : '';
  } catch {
    return '';
  }
}

function FeedGroup({ group }) {
  const [expanded, setExpanded] = useState(false);
  const tone = SEV_TONE[group.sev];
  const visible = expanded ? group.items : group.items.slice(0, PREVIEW);
  return (
    <section aria-labelledby={`grp-${group.sev}`} className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className={`w-2 h-2 rounded-full ${tone.dot}`} aria-hidden="true" />
        <h2 id={`grp-${group.sev}`} className={`font-display text-base font-semibold ${tone.title}`}>{group.title}</h2>
        <span className="font-data tnum text-xs text-inkmute bg-inkmute/10 rounded-full px-2 leading-5">{group.items.length}</span>
        <span className="hidden sm:inline text-xs text-inkmute">{group.hint}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {visible.map((it) => (
          <li key={it.id}>
            <Link
              href={it.href}
              className="group flex items-center gap-3 bg-panel border border-line rounded-xl px-3.5 py-3 shadow-sm hover:border-blueprint hover:shadow-md transition-all"
            >
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${tone.tile}`}>
                <KindIcon kind={it.kind} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-inkmute">{KIND_LABEL[it.kind]}</span>
                  {it.priority === 'High' && it.kind === 'project' && <span className="text-[10px] font-semibold uppercase tracking-wide text-rust">Prioritas tinggi</span>}
                </div>
                <p className="text-sm font-medium text-ink truncate group-hover:text-blueprint">{it.title}</p>
                <p className="text-xs text-inkmute mt-0.5 truncate">{it.detail}</p>
              </div>
              <Pill tone={tone.pill} className="flex-shrink-0">{it.badge}</Pill>
            </Link>
          </li>
        ))}
      </ul>
      {group.items.length > PREVIEW && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-sm font-medium text-blueprint hover:underline self-start">
          {expanded ? 'Tampilkan lebih sedikit' : `Tampilkan ${group.items.length - PREVIEW} lainnya`}
        </button>
      )}
    </section>
  );
}

// Empat angka kunci di atas halaman, menurut filter divisi yang sedang aktif.
function Kpis({ items, running }) {
  const count = (sev) => items.filter((i) => i.sev === sev).length;
  const tiles = [
    { label: 'Terlambat', value: count(0), text: 'text-rust', bar: 'bg-rust' },
    { label: 'Segera jatuh tempo', value: count(1), text: 'text-amberink', bar: 'bg-amber' },
    { label: 'Perlu dilengkapi', value: count(2), text: 'text-ink', bar: 'bg-inkmute' },
    { label: 'Project berjalan', value: running, text: 'text-blueprint', bar: 'bg-blueprint' },
  ];
  return (
    <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map((t) => (
        <div key={t.label} className="relative overflow-hidden bg-panel border border-line rounded-xl px-4 py-3.5 shadow-sm">
          <span className={`absolute inset-x-0 top-0 h-1 ${t.bar} ${t.value === 0 && t.label !== 'Project berjalan' ? 'opacity-30' : ''}`} aria-hidden="true" />
          <dt className="text-xs font-medium text-inkmute">{t.label}</dt>
          <dd className={`font-display text-3xl font-semibold tnum mt-1 ${t.text}`}>{t.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DivisionTabs({ value, onChange, counts }) {
  const tabs = [{ key: '', label: 'Semua' }, ...DIVISIONS.map((d) => ({ key: d, label: d }))];
  return (
    <div role="group" aria-label="Filter divisi" className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const c = counts[t.key] || { late: 0, soon: 0 };
        const active = value === t.key;
        return (
          <button
            key={t.key || 'all'}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(t.key)}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 h-9 text-sm font-medium transition-colors ${
              active ? 'bg-blueprint text-onaccent border-blueprint' : 'bg-panel text-ink border-line hover:border-blueprint hover:text-blueprint'
            }`}
          >
            {t.label}
            {c.late > 0 && (
              <span className={`font-data tnum text-[11px] rounded-full px-1.5 leading-5 ${active ? 'bg-onaccent/20 text-onaccent' : 'bg-rust/10 text-rust'}`} title={`${c.late} terlambat`}>
                {c.late}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Workload({ projects, value, onPick }) {
  const map = useMemo(() => workloadByDivision(projects), [projects]);
  const max = Math.max(1, ...DIVISIONS.map((d) => map[d].length));
  return (
    <section className="bg-panel border border-line rounded-xl p-4 shadow-sm" aria-labelledby="bola-title">
      <h2 id="bola-title" className="font-display text-base font-semibold text-ink">Bola ada di siapa</h2>
      <p className="text-xs text-inkmute mt-0.5 mb-3">Project yang masih berjalan, menurut divisi yang memegang stage-nya sekarang.</p>
      <ul className="flex flex-col gap-1">
        {DIVISIONS.map((d) => {
          const list = map[d];
          const active = value === d;
          return (
            <li key={d}>
              <button
                type="button"
                onClick={() => onPick(active ? '' : d)}
                aria-pressed={active}
                className={`w-full text-left rounded-md px-3 py-2 transition-colors border ${active ? 'border-blueprint bg-blueprint/5' : 'border-transparent hover:bg-canvas'}`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-ink">{d}</span>
                  <span className="font-data tnum text-sm font-semibold text-ink">{list.length}</span>
                </span>
                <span className="block h-1.5 rounded-full bg-line mt-1.5 overflow-hidden" aria-hidden="true">
                  <span className="block h-full rounded-full bg-blueprint" style={{ width: `${(list.length / max) * 100}%` }} />
                </span>
                {list.length > 0 && (
                  <span className="block text-xs text-inkmute mt-0.5 truncate">
                    {list.slice(0, 2).map((p) => p.projectName.split(',')[0]).join(', ')}{list.length > 2 ? ` +${list.length - 2}` : ''}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NextMeeting({ meetings, error }) {
  const today = todayIso();
  const next = useMemo(
    () => (meetings || []).filter((m) => m.status === 'Terjadwal' && m.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0] || null,
    [meetings, today]
  );
  if (error && !meetings) return null;
  if (!meetings) return <div className="skeleton-shimmer rounded-lg h-28" />;
  return (
    <section className="bg-panel border border-line border-l-4 border-l-blueprint rounded-xl p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><span className="text-blueprint"><KindIcon kind="meeting" className="w-4 h-4" /></span>Rapat berikutnya</h2>
      {next ? (
        <>
          <p className="font-display text-base font-semibold text-ink mt-1">{fmtLong(next.date)}</p>
          <p className="text-xs text-inkmute mt-0.5">{[fmtTimeRange(next) && `${fmtTimeRange(next)} WIB`, next.location].filter(Boolean).join(' · ')}</p>
          <p className="text-sm font-medium text-blueprint mt-1">{relativeDay(next.date)}</p>
          <Link href={`/documents/meetings/${next.id}`} className="inline-block text-sm font-medium text-blueprint hover:underline mt-2">Buka notulensi</Link>
        </>
      ) : (
        <>
          <p className="text-sm text-inkmute mt-1">Belum ada rapat terjadwal.</p>
          <Link href="/documents/meetings/new?mode=schedule" className="inline-block text-sm font-medium text-blueprint hover:underline mt-2">Jadwalkan sekarang</Link>
        </>
      )}
    </section>
  );
}

export default function TodayPage() {
  const { projects, error, staleError, refreshing } = useProjects();
  const { data: procurement, error: procError } = useCachedResource('procurement', () => api.getProcurement());
  const { data: meetings, error: meetingError } = useCachedResource('meetings', () => api.getMeetings());
  const { data: session } = useSession();
  const [division, setDivisionState] = useState('');
  const [hello, setHello] = useState('Halo'); // sapaan menurut jam diisi di browser supaya tidak beda dengan hasil server

  useEffect(() => { setDivisionState(readDivision()); setHello(greeting(new Date().getHours())); }, []);
  function setDivision(d) {
    setDivisionState(d);
    try { window.localStorage.setItem(DIVISION_KEY, d); } catch { /* abaikan: hanya kenyamanan */ }
  }

  const today = todayIso();
  const openMeetingItems = useMemo(() => computeOpenItems(meetings || []), [meetings]);
  const all = useMemo(
    () => (projects ? buildActionItems({ projects, procurement: procurement || [], openMeetingItems, today }) : []),
    [projects, procurement, openMeetingItems, today]
  );
  const counts = useMemo(() => countsByDivision(all), [all]);
  // Project berjalan: semua, atau hanya yang stage-nya dipegang divisi terpilih (sama dengan "Bola ada di siapa").
  const running = useMemo(() => {
    const byDivision = workloadByDivision(projects);
    return division ? byDivision[division].length : DIVISIONS.reduce((n, d) => n + byDivision[d].length, 0);
  }, [projects, division]);
  const rawName = String(session?.user?.name || '').trim().split(/\s+/)[0] || '';
  const firstName = rawName.length > 24 ? '' : rawName;
  const shown = useMemo(() => filterByDivision(all, division), [all, division]);
  const groups = useMemo(() => groupBySeverity(shown), [shown]);

  if (error && !projects) {
    return <div className="bg-panel border border-line rounded-lg p-6 text-rust" role="alert">Gagal memuat data: {error}.</div>;
  }

  const missing = [procError && !procurement && 'pengadaan', meetingError && !meetings && 'rapat'].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Hari Ini" />

      <header className="relative overflow-hidden bg-panel border border-line rounded-2xl shadow-sm">
        <div className="absolute inset-0 bp-grid opacity-70 pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blueprint via-teal to-amber" aria-hidden="true" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5 px-5 py-6 sm:px-7">
          <div className="min-w-0">
            <p className="font-data text-xs uppercase tracking-wider text-inkmute">{fmtLong(today)}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink mt-1.5">
              {hello}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="text-sm sm:text-base text-ink mt-1.5" aria-live="polite">{projects ? summaryText(shown) : 'Memuat...'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RefreshStatus refreshing={refreshing} staleError={staleError} />
            <Link href="/procurement" className="btn btn-secondary flex-1 sm:flex-none">+ Barang / Pengadaan</Link>
            <Link href="/projects/new" className="btn btn-primary flex-1 sm:flex-none">+ Project Baru</Link>
          </div>
        </div>
      </header>

      {projects && <Kpis items={shown} running={running} />}

      <DivisionTabs value={division} onChange={setDivision} counts={counts} />

      {missing.length > 0 && (
        <p className="text-xs text-amberink bg-amber/10 border border-amber/30 rounded-md px-3 py-2" role="status">
          Data {missing.join(' dan ')} belum bisa dimuat, jadi daftar di bawah belum mencakupnya. Coba muat ulang halaman.
        </p>
      )}

      {!projects ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-3">
            <div className="skeleton-shimmer rounded-lg h-16" />
            <div className="skeleton-shimmer rounded-lg h-16" />
            <div className="skeleton-shimmer rounded-lg h-16" />
          </div>
          <SkeletonPanel />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 flex flex-col gap-6">
            {groups.length === 0 ? (
              <div className="bg-panel border border-dashed border-line rounded-xl p-10 text-center">
                <p className="text-sm font-semibold text-ink">{division ? `Tidak ada yang perlu ditindak untuk ${division}` : 'Tidak ada yang perlu ditindak'}</p>
                <p className="text-xs text-inkmute mt-1">Tidak ada project, pengadaan, atau tindak lanjut rapat yang terlambat atau mendekati tenggat.</p>
              </div>
            ) : (
              groups.map((g) => <FeedGroup key={g.sev} group={g} />)
            )}
            {division && counts[''].total > shown.length && (
              <p className="text-xs text-inkmute">
                Ada {counts[''].total - shown.length} hal lain di divisi lain atau tanpa divisi.{' '}
                <button type="button" onClick={() => setDivision('')} className="text-blueprint font-medium hover:underline">Lihat semua</button>
              </p>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <NextMeeting meetings={meetings} error={meetingError} />
            <Workload projects={projects} value={division} onPick={setDivision} />
            <Link href="/dashboard" className="text-sm font-medium text-blueprint hover:underline">Buka Dashboard lengkap (grafik &amp; tabel project)</Link>
          </aside>
        </div>
      )}
    </div>
  );
}
