import Link from 'next/link';
import { useMemo } from 'react';
import { api } from '../lib/api';
import useCachedResource from '../lib/useCachedResource';
import { Pill } from './Badges';
import { computeOpenItems, suggestNextDate, fmtLong, fmtShort, fmtTimeRange, relativeDay, todayIso } from '../lib/meetings';

// Ringkasan rapat di Dashboard: jadwal rapat berikutnya + tindak lanjut yang masih terbuka.
// Datanya sama dengan halaman Notulensi Rapat (cache dipakai bersama).
export default function MeetingSummary() {
  const { data: meetings, error } = useCachedResource('meetings', () => api.getMeetings());
  const today = todayIso();

  const next = useMemo(
    () => (meetings || []).filter((m) => m.status === 'Terjadwal' && m.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0] || null,
    [meetings, today]
  );
  const open = useMemo(() => computeOpenItems(meetings || []), [meetings]);

  // Yang paling mendesak dulu: target sudah lewat, lalu yang punya target terdekat, lalu sisanya.
  const top = useMemo(() => {
    const rank = (x) => (x.item.target ? (x.item.target < today ? 0 : 1) : 2);
    return [...open]
      .sort((a, b) => rank(a) - rank(b) || String(a.item.target || '9999').localeCompare(String(b.item.target || '9999')))
      .slice(0, 4);
  }, [open, today]);

  // Gagal memuat (mis. backend belum diperbarui): jangan ganggu dashboard.
  if (error && !meetings) return null;

  if (!meetings) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="skeleton-shimmer rounded-lg h-36" />
        <div className="skeleton-shimmer rounded-lg h-36 lg:col-span-2" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <section className="bg-panel border border-line rounded-lg p-5 shadow-sm flex flex-col gap-3 border-l-4 border-l-blueprint">
        <h2 className="text-sm font-semibold text-ink">Rapat berikutnya</h2>
        {next ? (
          <>
            <div>
              <p className="font-display text-lg font-semibold text-ink leading-snug">{fmtLong(next.date)}</p>
              <p className="text-sm text-inkmute mt-0.5">
                {[fmtTimeRange(next) && `${fmtTimeRange(next)} WIB`, next.location].filter(Boolean).join(' · ')}
              </p>
              <p className="text-sm font-medium text-blueprint mt-1">{relativeDay(next.date)}</p>
            </div>
            <Link href={`/documents/meetings/${next.id}`} className="tap text-sm font-medium text-blueprint hover:underline mt-auto">Mulai catat</Link>
          </>
        ) : (
          <>
            <p className="text-sm text-inkmute">Belum ada rapat terjadwal. Saran: {fmtLong(suggestNextDate(meetings))}.</p>
            <Link href="/documents/meetings/new?mode=schedule" className="tap text-sm font-medium text-blueprint hover:underline mt-auto">Jadwalkan sekarang</Link>
          </>
        )}
      </section>

      <section className="bg-panel border border-line rounded-lg p-5 shadow-sm flex flex-col gap-3 lg:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">
            Tindak lanjut rapat yang masih terbuka
            <span className={`ml-2 font-data tnum ${open.length > 0 ? 'text-amberink' : 'text-teal'}`}>{open.length}</span>
          </h2>
          <Link href="/documents/meetings" className="tap text-sm font-medium text-blueprint hover:underline whitespace-nowrap">Lihat semua</Link>
        </div>

        {top.length === 0 ? (
          <p className="text-sm text-teal">Semua tindak lanjut sudah selesai.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {top.map(({ meeting, item }) => {
              const late = item.target && item.target < today;
              return (
                <li key={`${meeting.id}:${item.id}`} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{item.topic || '(tanpa judul)'}</p>
                    <p className="text-xs text-inkmute mt-0.5 truncate">
                      Rapat {fmtShort(meeting.date)}{item.pic ? ` · ${item.pic}` : ''}{item.cta ? ` · ${item.cta}` : ''}
                    </p>
                  </div>
                  {item.target && <Pill tone={late ? 'rust' : 'neutral'}>{late ? 'Lewat ' : ''}{fmtShort(item.target)}</Pill>}
                </li>
              );
            })}
          </ul>
        )}
        {open.length > top.length && <p className="text-xs text-inkmute">dan {open.length - top.length} lainnya.</p>}
      </section>
    </div>
  );
}
