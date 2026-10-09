import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
  0: { bar: 'border-l-rust', pill: 'rust', title: 'text-rust' },
  1: { bar: 'border-l-amber', pill: 'amber', title: 'text-amberink' },
  2: { bar: 'border-l-line', pill: 'neutral', title: 'text-inkmute' },
};

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
    <section aria-labelledby={`grp-${group.sev}`} className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h2 id={`grp-${group.sev}`} className={`font-display text-base font-semibold ${tone.title}`}>{group.title}</h2>
        <span className="font-data tnum text-sm text-inkmute">{group.items.length}</span>
        <span className="hidden sm:inline text-xs text-inkmute">· {group.hint}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {visible.map((it) => (
          <li key={it.id}>
            <Link
              href={it.href}
              className={`group flex items-center justify-between gap-3 bg-panel border border-line border-l-4 ${tone.bar} rounded-lg px-4 py-3 shadow-sm hover:border-blueprint hover:border-l-blueprint transition-colors`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
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
  return (
    <section className="bg-panel border border-line rounded-lg p-4 shadow-sm" aria-labelledby="bola-title">
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
    <section className="bg-panel border border-line border-l-4 border-l-blueprint rounded-lg p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-ink">Rapat berikutnya</h2>
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
  const [division, setDivisionState] = useState('');

  useEffect(() => { setDivisionState(readDivision()); }, []);
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
  const shown = useMemo(() => filterByDivision(all, division), [all, division]);
  const groups = useMemo(() => groupBySeverity(shown), [shown]);

  if (error && !projects) {
    return <div className="bg-panel border border-line rounded-lg p-6 text-rust" role="alert">Gagal memuat data: {error}.</div>;
  }

  const missing = [procError && !procurement && 'pengadaan', meetingError && !meetings && 'rapat'].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Hari Ini" />

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-sm text-inkmute">{fmtLong(today)}</p>
          <h1 className="font-display text-2xl font-semibold text-ink">Hari Ini</h1>
          <p className="text-sm text-ink mt-1" aria-live="polite">{projects ? summaryText(shown) : 'Memuat...'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RefreshStatus refreshing={refreshing} staleError={staleError} />
          <Link href="/procurement" className="btn btn-secondary">+ Barang / Pengadaan</Link>
          <Link href="/projects/new" className="btn btn-primary">+ Project Baru</Link>
        </div>
      </div>

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
              <div className="bg-panel border border-dashed border-line rounded-lg p-10 text-center">
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
