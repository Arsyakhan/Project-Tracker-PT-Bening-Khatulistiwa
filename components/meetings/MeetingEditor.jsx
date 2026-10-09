import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { api } from '../../lib/api';
import { clearCache } from '../../lib/persistedCache';
import useProjects from '../../lib/useProjects';
import PageHead from '../PageHead';
import ConfirmModal from '../ConfirmModal';
import DocsTabs from '../DocsTabs';
import { useToast } from '../Toast';
import { Pill } from '../Badges';
import {
  ITEM_TYPES, ATTENDANCE_STATUSES, ITEM_STATUSES, MEETING_STATUSES, DIVISIONS,
  emptyMeeting, newItem, computeOpenItems, carryItem, itemKey, meetingPayload,
  buildWhatsAppText, buildIcs, downloadText, copyText, whatsappLink, meetingFileBase,
  fmtLong, fmtShort, relativeDay,
} from '../../lib/meetings';

function Section({ title, hint, aside, children }) {
  return (
    <section className="bg-panel border border-line rounded-lg p-5 flex flex-col gap-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-ink">{title}</h2>
          {hint && <p className="text-xs text-inkmute mt-1">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${className}`}>
      <span className="text-inkmute font-medium">{label}</span>
      {children}
    </label>
  );
}


export default function MeetingEditor({ meetingId, schedule = false }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { projects } = useProjects();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [allMeetings, setAllMeetings] = useState([]);
  const [meeting, setMeeting] = useState(null);
  const [baseline, setBaseline] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [waAttendance, setWaAttendance] = useState(true);
  const [waPrev, setWaPrev] = useState(true);

  const isNew = !meetingId;

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await api.getMeetings();
      setAllMeetings(list);
      let m;
      if (isNew) m = emptyMeeting(list, { schedule });
      else {
        m = list.find((x) => x.id === meetingId);
        if (!m) throw new Error('Rapat tidak ditemukan. Mungkin sudah dihapus.');
      }
      setMeeting(m);
      setBaseline(JSON.stringify(meetingPayload(m)));
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => (meeting ? JSON.stringify(meetingPayload(meeting)) !== baseline : false), [meeting, baseline]);

  // Peringatan sebelum menutup tab kalau ada perubahan belum disimpan
  useEffect(() => {
    function onBeforeUnload(e) {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Ctrl/Cmd + S
  const saveRef = useRef(null);
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 's') {
        e.preventDefault();
        if (saveRef.current) saveRef.current();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openItems = useMemo(() => {
    if (!meeting) return [];
    const already = new Set((meeting.items || []).map((i) => i.carriedFrom).filter(Boolean));
    return computeOpenItems(allMeetings, meeting.id).filter(({ meeting: mm, item }) => !already.has(itemKey(mm.id, item.id)));
  }, [allMeetings, meeting]);

  const waText = useMemo(
    () => (meeting ? buildWhatsAppText(meeting, { includeAttendance: waAttendance, includePrev: waPrev }) : ''),
    [meeting, waAttendance, waPrev]
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="skeleton-shimmer rounded-md h-7 w-64" />
        <div className="skeleton-shimmer rounded-lg h-48 w-full" />
        <div className="skeleton-shimmer rounded-lg h-64 w-full" />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="bg-panel border border-line rounded-lg p-6 flex flex-col gap-3">
        <p className="text-rust text-sm">{loadError}</p>
        <div className="flex gap-4 text-sm">
          <button onClick={load} className="font-medium text-blueprint hover:underline">Coba lagi</button>
          <Link href="/documents/meetings" className="font-medium text-blueprint hover:underline">Kembali ke daftar rapat</Link>
        </div>
      </div>
    );
  }

  // ---------- Perubahan state ----------
  const set = (field, value) => setMeeting((m) => ({ ...m, [field]: value }));
  const setAttendee = (i, patch) => setMeeting((m) => ({ ...m, attendees: m.attendees.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) }));
  const removeAttendee = (i) => setMeeting((m) => ({ ...m, attendees: m.attendees.filter((_, idx) => idx !== i) }));
  const addAttendee = () => setMeeting((m) => ({ ...m, attendees: [...m.attendees, { name: '', division: '', status: 'Hadir' }] }));
  const allPresent = () => setMeeting((m) => ({ ...m, attendees: m.attendees.map((a) => ({ ...a, status: 'Hadir' })) }));

  const setItem = (i, patch) => setMeeting((m) => ({ ...m, items: m.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  const removeItem = (i) => setMeeting((m) => ({ ...m, items: m.items.filter((_, idx) => idx !== i) }));
  const addItem = () => setMeeting((m) => ({ ...m, items: [...m.items, newItem()] }));
  const moveItem = (i, dir) =>
    setMeeting((m) => {
      const j = i + dir;
      if (j < 0 || j >= m.items.length) return m;
      const items = [...m.items];
      [items[i], items[j]] = [items[j], items[i]];
      return { ...m, items };
    });
  const carryOne = (src) => setMeeting((m) => ({ ...m, items: [...m.items, carryItem(src.meeting, src.item)] }));
  const carryAll = () => setMeeting((m) => ({ ...m, items: [...m.items, ...openItems.map((src) => carryItem(src.meeting, src.item))] }));

  // ---------- Simpan ----------
  async function save({ silent = false } = {}) {
    if (!meeting || saving) return null;
    if (!meeting.date) { setError('Tanggal rapat wajib diisi.'); return null; }
    setSaving(true);
    setError(null);
    try {
      const saved = await api.saveMeeting({ id: meeting.id || undefined, baseVersion: meeting.version, ...meetingPayload(meeting) });
      clearCache('meetings');
      setMeeting(saved);
      setBaseline(JSON.stringify(meetingPayload(saved)));
      setAllMeetings((list) => [saved, ...list.filter((x) => x.id !== saved.id)]);
      if (!silent) showToast('Notulensi tersimpan.', 'success');
      if (isNew) router.replace(`/documents/meetings/${saved.id}`);
      return saved;
    } catch (err) {
      setError(err.message);
      showToast(err.message, 'error');
      return null;
    } finally {
      setSaving(false);
    }
  }
  saveRef.current = () => { if (dirty || isNew) save(); };

  async function makeDoc() {
    if (generating) return;
    setGenerating(true);
    try {
      let current = meeting;
      if (dirty || isNew) {
        current = await save({ silent: true });
        if (!current) return;
      }
      const res = await api.generateMeetingDoc(current.id);
      clearCache('meetings');
      setMeeting((m) => ({ ...m, docUrl: res.documentUrl }));
      showToast(res.linkSaved ? 'Google Doc notulensi dibuat.' : 'Dokumen dibuat, tapi link belum tersimpan di sheet.', res.linkSaved ? 'success' : 'error');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete() {
    setConfirmDelete(false);
    try {
      await api.deleteMeeting({ id: meeting.id });
      clearCache('meetings');
      showToast('Rapat dihapus.', 'success');
      setBaseline(JSON.stringify(meetingPayload(meeting)));
      router.push('/documents/meetings');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function copyWa() {
    const ok = await copyText(waText);
    showToast(ok ? 'Teks disalin. Tinggal tempel di WhatsApp.' : 'Gagal menyalin. Salin manual dari kotak teks.', ok ? 'success' : 'error');
  }

  const presentCount = meeting.attendees.filter((a) => a.status === 'Hadir').length;
  const picOptions = Array.from(new Set([...DIVISIONS, ...meeting.attendees.map((a) => a.name).filter(Boolean)]));
  const projectOptions = (projects || []).slice().sort((a, b) => String(a.projectName).localeCompare(String(b.projectName)));
  const titleText = isNew ? (schedule ? 'Jadwalkan Rapat' : 'Catat Rapat Baru') : `Rapat ${fmtShort(meeting.date)}`;

  return (
    <div className="flex flex-col gap-5 pb-28">
      <PageHead title={titleText} />
      <DocsTabs active="meetings" />

      <div className="flex flex-wrap items-start justify-between gap-3 pt-2">
        <div>
          <nav className="text-xs text-inkmute flex items-center gap-1.5 mb-1">
            <Link href="/documents/meetings" className="hover:text-blueprint">Notulensi Rapat</Link>
            <span aria-hidden="true">/</span>
            <span>{isNew ? 'Baru' : fmtShort(meeting.date)}</span>
          </nav>
          <h1 className="font-display text-2xl font-semibold text-ink">{titleText}</h1>
          <p className="text-sm text-inkmute mt-1">
            {fmtLong(meeting.date)}{meeting.date && !isNew ? ` · ${relativeDay(meeting.date)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <Pill tone="amber" dot>Belum disimpan</Pill>}
          <label className="flex items-center gap-2 text-sm">
            <span className="text-inkmute">Status</span>
            <select className="input !w-auto !min-h-[34px] !py-1" value={meeting.status} onChange={(e) => set('status', e.target.value)}>
              {MEETING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* 1. Informasi umum */}
      <Section title="Informasi umum">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Tanggal rapat">
            <input type="date" className="input" value={meeting.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Jam mulai">
            <input type="time" className="input" value={meeting.startTime} onChange={(e) => set('startTime', e.target.value)} />
          </Field>
          <Field label="Jam selesai">
            <input type="time" className="input" value={meeting.endTime} onChange={(e) => set('endTime', e.target.value)} />
          </Field>
          <Field label="Sifat rapat">
            <input className="input" value={meeting.kind} onChange={(e) => set('kind', e.target.value)} />
          </Field>
          <Field label="Media / lokasi" className="sm:col-span-2">
            <input className="input" value={meeting.location} onChange={(e) => set('location', e.target.value)} />
          </Field>
          <Field label="Agenda bahasan" className="sm:col-span-3">
            <input className="input" value={meeting.agenda} onChange={(e) => set('agenda', e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* 2. Kehadiran */}
      <Section
        title="Daftar kehadiran"
        hint="Peserta diambil dari rapat sebelumnya. Tambah tamu kalau perlu."
        aside={<span className="text-sm font-data tnum text-ink">{presentCount} dari {meeting.attendees.length} hadir</span>}
      >
        <div className="flex flex-col gap-2">
          {meeting.attendees.length === 0 && <p className="text-sm text-inkmute">Belum ada peserta.</p>}
          {meeting.attendees.map((a, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_130px_auto] gap-2 items-center">
              <input className="input" placeholder="Nama" aria-label="Nama peserta" value={a.name} onChange={(e) => setAttendee(i, { name: e.target.value })} />
              <input className="input" placeholder="Divisi" aria-label="Divisi" list="division-options" value={a.division} onChange={(e) => setAttendee(i, { division: e.target.value })} />
              <select
                className={`input ${a.status !== 'Hadir' ? 'border-amber/50' : ''}`}
                aria-label={`Kehadiran ${a.name}`}
                value={a.status}
                onChange={(e) => setAttendee(i, { status: e.target.value })}
              >
                {ATTENDANCE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="button" onClick={() => removeAttendee(i)} className="text-xs text-inkmute hover:text-rust px-2 h-9" aria-label={`Hapus ${a.name || 'peserta'}`}>
                Hapus
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={addAttendee} className="text-sm font-medium text-blueprint hover:underline">+ Tambah peserta</button>
          <button type="button" onClick={allPresent} className="text-sm font-medium text-blueprint hover:underline">Tandai semua hadir</button>
        </div>
        <datalist id="division-options">{DIVISIONS.map((d) => <option key={d} value={d} />)}</datalist>
      </Section>

      {/* Tindak lanjut dari rapat sebelumnya */}
      {openItems.length > 0 && (
        <Section
          title="Tindak lanjut dari rapat sebelumnya"
          hint="Agenda yang belum selesai. Bawa ke rapat ini supaya dibahas lagi; isi lama tercatat sebagai 'Sebelumnya'."
          aside={<button type="button" onClick={carryAll} className="text-sm font-medium text-blueprint hover:underline whitespace-nowrap">Bawa semua ({openItems.length})</button>}
        >
          <ul className="flex flex-col divide-y divide-line border border-line rounded-lg max-h-72 overflow-y-auto">
            {openItems.map((src) => (
              <li key={itemKey(src.meeting.id, src.item.id)} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{src.item.topic || '(tanpa judul)'}</p>
                  <p className="text-xs text-inkmute mt-0.5">
                    Rapat {fmtShort(src.meeting.date)}{src.item.pic ? ` · ${src.item.pic}` : ''}{src.item.target ? ` · target ${fmtShort(src.item.target)}` : ''}
                  </p>
                  {src.item.cta && <p className="text-xs text-ink/80 mt-1">Tindak lanjut: {src.item.cta}</p>}
                </div>
                <button type="button" onClick={() => carryOne(src)} className="text-sm font-medium text-blueprint hover:underline whitespace-nowrap">Bawa</button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 3. Agenda & progress */}
      <Section
        title="Rincian agenda & progress"
        hint="Satu kartu per topik bahasan. Status 'Open' berarti masih perlu ditindaklanjuti di rapat berikutnya."
        aside={<span className="text-sm font-data tnum text-ink">{meeting.items.length} agenda</span>}
      >
        <div className="flex flex-col gap-4">
          {meeting.items.length === 0 && (
            <p className="text-sm text-inkmute">Belum ada agenda. Tambahkan topik pertama{openItems.length > 0 ? ' atau bawa dari rapat sebelumnya di atas' : ''}.</p>
          )}
          {meeting.items.map((it, i) => (
            <div key={it.id} className="border border-line rounded-lg p-4 flex flex-col gap-3 bg-canvas/30">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-data text-inkmute">Agenda {i + 1}{it.carriedFrom ? ' · lanjutan' : ''}</span>
                <div className="flex items-center gap-1 text-xs">
                  <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} className="px-2 h-7 rounded border border-line text-inkmute hover:text-ink disabled:opacity-30" aria-label="Naikkan">Naik</button>
                  <button type="button" onClick={() => moveItem(i, 1)} disabled={i === meeting.items.length - 1} className="px-2 h-7 rounded border border-line text-inkmute hover:text-ink disabled:opacity-30" aria-label="Turunkan">Turun</button>
                  <button type="button" onClick={() => removeItem(i)} className="px-2 h-7 rounded text-rust hover:bg-rust/10">Hapus</button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Topik bahasan" className="sm:col-span-2">
                  <input className="input" placeholder="ex: Unilever Savory, CIP room" value={it.topic} onChange={(e) => setItem(i, { topic: e.target.value })} />
                </Field>
                <Field label="Type">
                  <select className="input" value={ITEM_TYPES.includes(it.type) ? it.type : '__other'} onChange={(e) => setItem(i, { type: e.target.value === '__other' ? it.type : e.target.value })}>
                    {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    {!ITEM_TYPES.includes(it.type) && <option value="__other">{it.type || 'Lainnya'}</option>}
                  </select>
                </Field>
              </div>

              {it.prevNote && (
                <p className="text-xs text-inkmute bg-panel border border-line rounded-md px-3 py-2 whitespace-pre-wrap">Sebelumnya - {it.prevNote}</p>
              )}

              <Field label="Isi bahasan">
                <textarea className="input" rows={3} placeholder="Apa yang dibahas / diputuskan" value={it.content} onChange={(e) => setItem(i, { content: e.target.value })} />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="CTA (tindak lanjut)">
                  <input className="input" placeholder="ex: Kirim PO ke vendor" value={it.cta} onChange={(e) => setItem(i, { cta: e.target.value })} />
                </Field>
                <Field label="PIC">
                  <input className="input" list="pic-options" placeholder="Divisi atau nama" value={it.pic} onChange={(e) => setItem(i, { pic: e.target.value })} />
                </Field>
                <Field label="Target">
                  <input type="date" className="input" value={it.target} onChange={(e) => setItem(i, { target: e.target.value })} />
                </Field>
                <Field label="Status">
                  <select className="input" value={it.status} onChange={(e) => setItem(i, { status: e.target.value })}>
                    {ITEM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                {projectOptions.length > 0 && (
                  <Field label="Terkait project (opsional)" className="sm:col-span-2">
                    <select className="input" value={it.projectId || ''} onChange={(e) => setItem(i, { projectId: e.target.value })}>
                      <option value="">Tidak terkait project</option>
                      {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
                    </select>
                  </Field>
                )}
              </div>
            </div>
          ))}
        </div>
        <datalist id="pic-options">{picOptions.map((p) => <option key={p} value={p} />)}</datalist>
        <button type="button" onClick={addItem} className="self-start text-sm font-medium text-blueprint hover:underline">+ Tambah agenda</button>
      </Section>

      {/* 4. Catatan */}
      <Section title="Catatan tambahan & agenda rapat berikutnya">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Catatan tambahan">
            <textarea className="input" rows={4} value={meeting.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
          <Field label="Agenda rapat berikutnya">
            <textarea className="input" rows={4} value={meeting.nextAgenda} onChange={(e) => set('nextAgenda', e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* Bagikan */}
      <Section title="Bagikan" hint="Pratinjau pesan WhatsApp mengikuti isi di atas, termasuk yang belum disimpan.">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-blueprint" checked={waAttendance} onChange={(e) => setWaAttendance(e.target.checked)} />
            Sertakan kehadiran
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-blueprint" checked={waPrev} onChange={(e) => setWaPrev(e.target.checked)} />
            Sertakan catatan "Sebelumnya"
          </label>
        </div>
        <textarea readOnly className="input font-data text-xs leading-relaxed" rows={12} value={waText} aria-label="Pratinjau pesan WhatsApp" onFocus={(e) => e.target.select()} />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={copyWa} className="bg-blueprint hover:bg-blueprintdark text-onaccent rounded-md px-4 h-9 text-sm font-medium transition-colors">Salin untuk WhatsApp</button>
          <a href={whatsappLink(waText)} target="_blank" rel="noopener noreferrer" className="border border-line rounded-md px-4 h-9 inline-flex items-center text-sm font-medium text-ink hover:border-blueprint hover:text-blueprint transition-colors">Buka WhatsApp</a>
          <button type="button" onClick={() => downloadText(`${meetingFileBase(meeting)}.txt`, waText)} className="border border-line rounded-md px-4 h-9 text-sm font-medium text-ink hover:border-blueprint hover:text-blueprint transition-colors">Unduh .txt</button>
          <button type="button" onClick={() => downloadText(`${meetingFileBase(meeting)}.ics`, buildIcs(meeting), 'text/calendar;charset=utf-8')} className="border border-line rounded-md px-4 h-9 text-sm font-medium text-ink hover:border-blueprint hover:text-blueprint transition-colors">Tambah ke kalender (.ics)</button>
        </div>
      </Section>

      {/* Bar aksi */}
      <div className="fixed bottom-0 left-0 md:left-60 right-0 z-20 bg-panel/95 backdrop-blur border-t border-line shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="max-w-6xl mx-auto px-5 md:px-10 py-3 flex flex-wrap items-center gap-3">
          <button
            onClick={() => save()}
            disabled={saving || (!dirty && !isNew)}
            className="bg-blueprint hover:bg-blueprintdark text-onaccent rounded-md px-4 h-9 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Menyimpan...' : isNew ? 'Simpan rapat' : 'Simpan perubahan'}
          </button>
          <button
            onClick={makeDoc}
            disabled={generating || saving}
            className="border border-line rounded-md px-4 h-9 text-sm font-medium text-ink hover:border-blueprint hover:text-blueprint disabled:opacity-40 transition-colors"
          >
            {generating ? 'Membuat dokumen...' : meeting.docUrl ? 'Buat ulang Google Doc' : 'Buat Google Doc'}
          </button>
          {meeting.docUrl && (
            <a href={meeting.docUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blueprint hover:underline">Buka Google Doc</a>
          )}
          {error && <span className="text-rust text-sm truncate max-w-md" role="alert">{error}</span>}
          {!isNew && (
            <button onClick={() => setConfirmDelete(true)} className="ml-auto text-sm font-medium text-rust hover:bg-rust/10 rounded-md px-3 h-9 transition-colors">
              Hapus rapat
            </button>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Hapus rapat ini?"
        description={`Notulensi rapat ${fmtShort(meeting.date)} akan dihapus dari spreadsheet. Isinya masih tersimpan di tab Aktivitas, tapi tidak bisa dipulihkan dari web.`}
        confirmText="Ya, hapus"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
