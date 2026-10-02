import { useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import useCachedResource from '../../../lib/useCachedResource';
import { clearCache } from '../../../lib/persistedCache';
import PageHead from '../../../components/PageHead';
import DocsTabs from '../../../components/DocsTabs';
import RefreshStatus from '../../../components/RefreshStatus';
import { useToast } from '../../../components/Toast';
import { Pill } from '../../../components/Badges';
import {
  computeOpenItems, buildWhatsAppText, buildOpenItemsText, buildIcs, downloadText, copyText,
  meetingFileBase, meetingPayload, suggestNextDate, fmtLong, fmtShort, fmtTimeRange, relativeDay, todayIso,
} from '../../../lib/meetings';

function Card({ children, className = '' }) {
  return <section className={`bg-panel border border-line rounded-lg shadow-sm ${className}`}>{children}</section>;
}

export default function MeetingsPage() {
  const { data: meetings, error, staleError, refreshing, reload } = useCachedResource('meetings', () => api.getMeetings());
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [busyItem, setBusyItem] = useState('');

  const today = todayIso();

  const done = useMemo(() => (meetings || []).filter((m) => m.status === 'Selesai'), [meetings]);
  const upcoming = useMemo(
    () => (meetings || []).filter((m) => m.status === 'Terjadwal').sort((a, b) => (a.date < b.date ? -1 : 1)),
    [meetings]
  );
  const nextMeeting = upcoming.find((m) => m.date >= today) || null;
  const missed = upcoming.filter((m) => m.date < today);
  const openItems = useMemo(() => computeOpenItems(meetings || []), [meetings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return done;
    return done.filter((m) => {
      const hay = [m.date, fmtLong(m.date), m.agenda, m.notes, m.location, ...(m.items || []).flatMap((i) => [i.topic, i.content, i.cta, i.pic])]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [done, query]);
  const visible = showAll || query ? filtered : filtered.slice(0, 8);

  async function copy(text, okMsg) {
    const ok = await copyText(text);
    showToast(ok ? okMsg : 'Gagal menyalin teks.', ok ? 'success' : 'error');
  }

  // Tandai satu agenda selesai langsung dari rekap.
  async function markDone(src) {
    const key = `${src.meeting.id}:${src.item.id}`;
    if (busyItem) return;
    setBusyItem(key);
    try {
      const m = src.meeting;
      const payload = meetingPayload(m);
      payload.items = payload.items.map((it) => (it.id === src.item.id ? { ...it, status: 'Selesai' } : it));
      await api.saveMeeting({ id: m.id, baseVersion: m.version, ...payload });
      clearCache('meetings');
      await reload(true);
      showToast('Agenda ditandai selesai.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyItem('');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Notulensi Rapat" />
      <DocsTabs active="meetings" />

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Notulensi Rapat</h1>
          <p className="text-sm text-inkmute mt-1">Catat hasil rapat, pantau tindak lanjut, dan kirim rekap ke WhatsApp.</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshStatus refreshing={refreshing && !!meetings} staleError={staleError} />
          <Link href="/documents/meetings/new?mode=schedule" className="border border-line rounded-md px-4 h-9 inline-flex items-center text-sm font-medium text-ink bg-panel hover:border-blueprint hover:text-blueprint transition-colors">
            Jadwalkan rapat
          </Link>
          <Link href="/documents/meetings/new" className="bg-blueprint hover:bg-blueprintdark text-white rounded-md px-4 h-9 inline-flex items-center text-sm font-medium transition-colors">
            + Catat rapat
          </Link>
        </div>
      </div>

      {error ? (
        <div className="bg-panel border border-line rounded-lg p-5 text-sm text-rust">Gagal memuat notulensi: {error}</div>
      ) : !meetings ? (
        <div className="flex flex-col gap-3">
          <div className="skeleton-shimmer rounded-lg h-28 w-full" />
          <div className="skeleton-shimmer rounded-lg h-48 w-full" />
        </div>
      ) : (
        <>
          {/* Jadwal berikutnya */}
          {nextMeeting ? (
            <Card className="p-5 flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-blueprint">
              <div>
                <p className="text-xs text-inkmute">Rapat berikutnya</p>
                <p className="font-display text-lg font-semibold text-ink mt-0.5">{fmtLong(nextMeeting.date)}</p>
                <p className="text-sm text-inkmute mt-0.5">
                  {[fmtTimeRange(nextMeeting) && `${fmtTimeRange(nextMeeting)} WIB`, nextMeeting.location].filter(Boolean).join(' · ')}
                  <span className="ml-2 font-medium text-blueprint">{relativeDay(nextMeeting.date)}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/documents/meetings/${nextMeeting.id}`} className="bg-blueprint hover:bg-blueprintdark text-white rounded-md px-4 h-9 inline-flex items-center text-sm font-medium transition-colors">Mulai catat</Link>
                <button
                  type="button"
                  onClick={() => downloadText(`${meetingFileBase(nextMeeting)}.ics`, buildIcs(nextMeeting), 'text/calendar;charset=utf-8')}
                  className="border border-line rounded-md px-4 h-9 text-sm font-medium text-ink hover:border-blueprint hover:text-blueprint transition-colors"
                >
                  Tambah ke kalender
                </button>
              </div>
            </Card>
          ) : (
            <Card className="p-5 flex flex-wrap items-center justify-between gap-4 border-dashed">
              <div>
                <p className="font-medium text-ink">Belum ada rapat terjadwal</p>
                <p className="text-sm text-inkmute mt-0.5">Saran jadwal berikutnya (2 minggu sekali): {fmtLong(suggestNextDate(meetings))}</p>
              </div>
              <Link href="/documents/meetings/new?mode=schedule" className="text-sm font-medium text-blueprint hover:underline">Jadwalkan sekarang</Link>
            </Card>
          )}

          {missed.length > 0 && (
            <div className="bg-amber/10 border border-amber/30 border-l-4 border-l-amber rounded-lg px-4 py-3 text-sm text-ink">
              Ada rapat terjadwal yang tanggalnya sudah lewat dan belum dicatat:{' '}
              {missed.map((m, i) => (
                <span key={m.id}>
                  {i > 0 && ', '}
                  <Link href={`/documents/meetings/${m.id}`} className="font-medium text-blueprint hover:underline">{fmtShort(m.date)}</Link>
                </span>
              ))}
              .
            </div>
          )}

          {/* Ringkasan */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-xs text-inkmute">Rapat tercatat</p>
              <p className="font-data tnum text-2xl font-semibold text-ink mt-1">{done.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-inkmute">Tindak lanjut terbuka</p>
              <p className={`font-data tnum text-2xl font-semibold mt-1 ${openItems.length > 0 ? 'text-amber' : 'text-teal'}`}>{openItems.length}</p>
            </Card>
            <Card className="p-4 col-span-2 sm:col-span-1">
              <p className="text-xs text-inkmute">Rapat terakhir</p>
              <p className="text-sm font-medium text-ink mt-2">{done[0] ? fmtLong(done[0].date) : '-'}</p>
            </Card>
          </div>

          {/* Tindak lanjut terbuka */}
          <Card className="p-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold text-ink">Tindak lanjut yang masih terbuka</h2>
                <p className="text-xs text-inkmute mt-1">Dari semua rapat. Agenda yang sudah dibawa ke rapat lebih baru tidak dihitung lagi di sini.</p>
              </div>
              {openItems.length > 0 && (
                <button type="button" onClick={() => copy(buildOpenItemsText(openItems), 'Rekap tindak lanjut disalin.')} className="text-sm font-medium text-blueprint hover:underline whitespace-nowrap">
                  Salin rekap untuk WhatsApp
                </button>
              )}
            </div>
            {openItems.length === 0 ? (
              <p className="text-sm text-teal">Semua tindak lanjut sudah selesai.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line border border-line rounded-lg max-h-96 overflow-y-auto">
                {openItems.map((src) => {
                  const key = `${src.meeting.id}:${src.item.id}`;
                  const late = src.item.target && src.item.target < today;
                  return (
                    <li key={key} className="flex items-start justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{src.item.topic || '(tanpa judul)'}</p>
                        <p className="text-xs text-inkmute mt-0.5">
                          <Link href={`/documents/meetings/${src.meeting.id}`} className="hover:text-blueprint hover:underline">Rapat {fmtShort(src.meeting.date)}</Link>
                          {src.item.pic ? ` · ${src.item.pic}` : ''}
                        </p>
                        {src.item.cta && <p className="text-xs text-ink/80 mt-1">Tindak lanjut: {src.item.cta}</p>}
                        {src.item.target && (
                          <span className="inline-block mt-1.5">
                            <Pill tone={late ? 'rust' : 'neutral'}>Target {fmtShort(src.item.target)}{late ? ' (lewat)' : ''}</Pill>
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => markDone(src)}
                        disabled={!!busyItem}
                        className="text-sm font-medium text-teal hover:underline whitespace-nowrap disabled:opacity-40"
                      >
                        {busyItem === key ? 'Menyimpan...' : 'Tandai selesai'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Riwayat */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-ink">Riwayat rapat</h2>
              {done.length > 0 && (
                <input
                  type="search"
                  placeholder="Cari topik, isi bahasan, atau PIC..."
                  className="input !w-full sm:!w-72"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              )}
            </div>

            {done.length === 0 ? (
              <div className="bg-panel border border-dashed border-line rounded-lg p-8 text-center">
                <p className="text-sm font-medium text-ink">Belum ada rapat yang dicatat</p>
                <p className="text-xs text-inkmute mt-1">Klik "Catat rapat" untuk membuat notulensi pertama. Peserta tetap sudah disiapkan.</p>
              </div>
            ) : visible.length === 0 ? (
              <p className="text-sm text-inkmute text-center py-8">Tidak ada rapat yang cocok.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {visible.map((m) => {
                  const present = (m.attendees || []).filter((a) => a.status === 'Hadir').length;
                  const open = (m.items || []).filter((i) => i.status === 'Open').length;
                  return (
                    <li key={m.id} className="bg-panel border border-line rounded-lg p-4 shadow-sm flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/documents/meetings/${m.id}`} className="font-display font-semibold text-ink hover:text-blueprint transition-colors">
                            {fmtLong(m.date)}
                          </Link>
                          <p className="text-xs text-inkmute mt-1">
                            {[m.kind, fmtTimeRange(m) && `${fmtTimeRange(m)} WIB`, m.location].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Pill tone="neutral">{present} dari {(m.attendees || []).length} hadir</Pill>
                          <Pill tone="blueprint">{(m.items || []).length} agenda</Pill>
                          {open > 0 && <Pill tone="amber" dot>{open} terbuka</Pill>}
                        </div>
                      </div>

                      {(m.items || []).length > 0 && (
                        <p className="text-sm text-ink/80 line-clamp-2">
                          {(m.items || []).map((i) => i.topic).filter(Boolean).join(' · ')}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm pt-2 border-t border-line/70">
                        <Link href={`/documents/meetings/${m.id}`} className="font-medium text-blueprint hover:underline">Buka</Link>
                        <button type="button" onClick={() => copy(buildWhatsAppText(m), 'Teks WhatsApp disalin.')} className="font-medium text-blueprint hover:underline">Salin untuk WA</button>
                        <button type="button" onClick={() => downloadText(`${meetingFileBase(m)}.txt`, buildWhatsAppText(m))} className="font-medium text-blueprint hover:underline">Unduh .txt</button>
                        {m.docUrl ? (
                          <a href={m.docUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blueprint hover:underline">Google Doc</a>
                        ) : (
                          <span className="text-xs text-inkmute">Belum ada Google Doc</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {!query && filtered.length > 8 && (
              <button onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-blueprint hover:underline self-start">
                {showAll ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${filtered.length})`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
