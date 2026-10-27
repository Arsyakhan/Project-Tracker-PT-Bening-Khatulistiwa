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
import PageHeader from '../../../components/ui/PageHeader';
import StatStrip from '../../../components/ui/StatStrip';
import Panel from '../../../components/ui/Panel';
import SearchField from '../../../components/ui/SearchField';
import {
  computeOpenItems, buildWhatsAppText, buildOpenItemsText, buildIcs, downloadText, copyText,
  meetingFileBase, meetingPayload, suggestNextDate, fmtLong, fmtShort, fmtTimeRange, relativeDay, todayIso,
} from '../../../lib/meetings';


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

  const lateOpen = openItems.filter((src) => src.item.target && src.item.target < today).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Notulensi Rapat" />
      <PageHeader
        title="Notulensi Rapat"
        meta="Catat hasil rapat, pantau tindak lanjut, dan kirim rekap ke WhatsApp."
        nav={<DocsTabs active="meetings" />}
        actions={
          <>
            <RefreshStatus refreshing={refreshing && !!meetings} staleError={staleError} />
            <Link href="/documents/meetings/new?mode=schedule" className="btn btn-secondary">Jadwalkan rapat</Link>
            <Link href="/documents/meetings/new" className="btn btn-primary">+ Catat rapat</Link>
          </>
        }
      />

      {error ? (
        <div className="bg-panel border border-line rounded-xl p-5 text-sm text-rust" role="alert">Gagal memuat notulensi: {error}</div>
      ) : !meetings ? (
        <div className="flex flex-col gap-3">
          <div className="skeleton-shimmer rounded-xl h-28 w-full" />
          <div className="skeleton-shimmer rounded-xl h-48 w-full" />
        </div>
      ) : (
        <>
          {/* Rapat berikutnya */}
          {nextMeeting ? (
            <section className="bg-panel border border-line border-l-4 border-l-blueprint rounded-xl shadow-sm p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <span className="flex flex-col items-center justify-center w-14 h-14 rounded-lg border border-line bg-canvas leading-none shrink-0" aria-hidden="true">
                  <span className="font-display tnum text-xl font-semibold text-ink">{Number(nextMeeting.date.slice(8, 10))}</span>
                  <span className="text-xs text-inkmute mt-1">{fmtShort(nextMeeting.date).split(' ')[1]}</span>
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-inkmute">Rapat berikutnya · <span className="text-blueprint">{relativeDay(nextMeeting.date)}</span></p>
                  <p className="font-display text-lg font-semibold text-ink mt-0.5">{fmtLong(nextMeeting.date)}</p>
                  <p className="text-sm text-inkmute mt-0.5">
                    {[nextMeeting.kind, fmtTimeRange(nextMeeting) && `${fmtTimeRange(nextMeeting)} WIB`, nextMeeting.location].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadText(`${meetingFileBase(nextMeeting)}.ics`, buildIcs(nextMeeting), 'text/calendar;charset=utf-8')}
                  className="btn btn-secondary"
                >
                  Tambah ke kalender
                </button>
                <Link href={`/documents/meetings/${nextMeeting.id}`} className="btn btn-primary">Mulai notulensi</Link>
              </div>
            </section>
          ) : (
            <section className="bg-panel border border-dashed border-line rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">Belum ada rapat terjadwal</p>
                <p className="text-sm text-inkmute mt-0.5">Saran jadwal berikutnya (2 minggu sekali): {fmtLong(suggestNextDate(meetings))}</p>
              </div>
              <Link href="/documents/meetings/new?mode=schedule" className="btn btn-secondary">Jadwalkan sekarang</Link>
            </section>
          )}

          {missed.length > 0 && (
            <div className="bg-panel border border-line border-l-4 border-l-amber rounded-xl px-4 py-3 text-sm text-ink shadow-sm">
              Rapat terjadwal berikut sudah lewat tanggalnya dan belum dicatat:{' '}
              {missed.map((m, i) => (
                <span key={m.id}>
                  {i > 0 && ', '}
                  <Link href={`/documents/meetings/${m.id}`} className="tap font-medium text-blueprint hover:underline">{fmtShort(m.date)}</Link>
                </span>
              ))}
              .
            </div>
          )}

          <StatStrip
            label="Ringkasan rapat"
            items={[
              { key: 'done', label: 'Rapat tercatat', value: done.length, tone: 'muted' },
              { key: 'open', label: 'Tindak lanjut terbuka', value: openItems.length, tone: openItems.length > 0 ? 'amber' : 'teal', hint: lateOpen > 0 ? `${lateOpen} melewati target` : 'Tidak ada yang melewati target' },
              { key: 'last', label: 'Rapat terakhir', value: done[0] ? fmtShort(done[0].date) : '-', tone: 'blueprint', dim: !done[0], hint: done[0] ? relativeDay(done[0].date) : '' },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
            {/* Riwayat */}
            <Panel
              title="Riwayat rapat"
              aside={done.length > 0 && (
                <SearchField className="hidden sm:block w-60" value={query} onChange={setQuery} placeholder="Cari topik, isi, atau PIC..." label="Cari riwayat rapat" />
              )}
              flush
            >
              {done.length > 0 && (
                <div className="sm:hidden px-5 pt-3">
                  <SearchField value={query} onChange={setQuery} placeholder="Cari topik, isi, atau PIC..." label="Cari riwayat rapat" />
                </div>
              )}
              {done.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-ink">Belum ada rapat yang dicatat</p>
                  <p className="text-sm text-inkmute mt-1">Klik "Catat rapat" untuk membuat notulensi pertama. Peserta tetap sudah disiapkan.</p>
                </div>
              ) : visible.length === 0 ? (
                <p className="text-sm text-inkmute text-center py-8">Tidak ada rapat yang cocok.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {visible.map((m) => {
                    const present = (m.attendees || []).filter((a) => a.status === 'Hadir').length;
                    const open = (m.items || []).filter((i) => i.status === 'Open').length;
                    return (
                      <li key={m.id} className="px-5 py-4 flex flex-col gap-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={`/documents/meetings/${m.id}`} className="font-display font-semibold text-ink hover:text-blueprint transition-colors">
                              {fmtLong(m.date)}
                            </Link>
                            <p className="text-xs text-inkmute mt-0.5">
                              {[m.kind, fmtTimeRange(m) && `${fmtTimeRange(m)} WIB`, m.location].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-inkmute tnum">{present} dari {(m.attendees || []).length} hadir · {(m.items || []).length} agenda</span>
                            {open > 0 && <Pill tone="amber" dot>{open} terbuka</Pill>}
                          </div>
                        </div>

                        {(m.items || []).length > 0 && (
                          <p className="text-sm text-ink/80 line-clamp-2">
                            {(m.items || []).map((i) => i.topic).filter(Boolean).join(' · ')}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                          <Link href={`/documents/meetings/${m.id}`} className="tap font-medium text-blueprint hover:underline">Buka</Link>
                          <button type="button" onClick={() => copy(buildWhatsAppText(m), 'Teks WhatsApp disalin.')} className="tap font-medium text-blueprint hover:underline">Salin untuk WhatsApp</button>
                          <button type="button" onClick={() => downloadText(`${meetingFileBase(m)}.txt`, buildWhatsAppText(m))} className="tap font-medium text-blueprint hover:underline">Unduh .txt</button>
                          {m.docUrl ? (
                            <a href={m.docUrl} target="_blank" rel="noopener noreferrer" className="tap font-medium text-blueprint hover:underline">Google Doc</a>
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
                <div className="px-5 py-3 border-t border-line">
                  <button onClick={() => setShowAll((v) => !v)} className="tap text-sm font-medium text-blueprint hover:underline">
                    {showAll ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${filtered.length})`}
                  </button>
                </div>
              )}
            </Panel>

            {/* Tindak lanjut terbuka */}
            <Panel
              className="lg:sticky lg:top-6"
              title="Tindak lanjut terbuka"
              hint="Dari seluruh rapat. Agenda yang sudah dibawa ke rapat berikutnya tidak dihitung ulang."
              flush
            >
              {openItems.length === 0 ? (
                <p className="px-5 py-6 text-sm text-teal">Semua tindak lanjut sudah selesai.</p>
              ) : (
                <ul className="divide-y divide-line max-h-[60vh] overflow-y-auto">
                  {openItems.map((src) => {
                    const key = `${src.meeting.id}:${src.item.id}`;
                    const late = src.item.target && src.item.target < today;
                    return (
                      <li key={key} className="px-5 py-3 flex flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-ink min-w-0">{src.item.topic || 'Tanpa judul'}</p>
                          {src.item.target && <Pill tone={late ? 'rust' : 'neutral'} className="shrink-0">{late ? 'Lewat · ' : ''}{fmtShort(src.item.target)}</Pill>}
                        </div>
                        {src.item.cta && <p className="text-xs text-ink/80">Tindak lanjut: {src.item.cta}</p>}
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-inkmute min-w-0 truncate">
                            <Link href={`/documents/meetings/${src.meeting.id}`} className="tap hover:text-blueprint hover:underline">Rapat {fmtShort(src.meeting.date)}</Link>
                            {src.item.pic ? ` · ${src.item.pic}` : ''}
                          </p>
                          <button
                            type="button"
                            onClick={() => markDone(src)}
                            disabled={!!busyItem}
                            className="tap text-sm font-medium text-teal hover:underline whitespace-nowrap disabled:opacity-40"
                          >
                            {busyItem === key ? 'Menyimpan...' : 'Tandai selesai'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {openItems.length > 0 && (
                <div className="px-5 py-3 border-t border-line">
                  <button type="button" onClick={() => copy(buildOpenItemsText(openItems), 'Rekap tindak lanjut disalin.')} className="tap text-sm font-medium text-blueprint hover:underline">
                    Salin rekap untuk WhatsApp
                  </button>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
