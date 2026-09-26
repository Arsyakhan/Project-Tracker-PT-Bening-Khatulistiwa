import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { api } from '../../lib/api';
import { addRecentProject } from '../../lib/recentlyViewed';
import StageGauge from '../../components/StageGauge';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../components/Toast';
import { SkeletonProjectDetail } from '../../components/Skeleton';

// Field yang diedit lewat tombol "Simpan Perubahan". Checklist disimpan otomatis & terpisah,
// jadi TIDAK ikut menentukan status "Belum disimpan".
const EDITABLE_FIELDS = [
  'poNumber', 'projectName', 'client', 'technology', 'pic',
  'currentStage', 'status', 'priority',
  'tanggalPO', 'tanggalDP', 'deliveryDate', 'targetFinishDate',
  'remarks', 'deskripsiPesanan', 'spesifikasiTeknologi',
];

function pickEditable(p) {
  const out = {};
  EDITABLE_FIELDS.forEach((f) => { out[f] = p?.[f] ?? ''; });
  return out;
}

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'jadwal', label: 'Jadwal' },
  { key: 'deskripsi', label: 'Deskripsi Teknis' },
  { key: 'checklist', label: 'Checklist Engineering' },
  { key: 'komentar', label: 'Komentar' },
];

const COMMENT_MAX_LENGTH = 2000;

function formatCommentTime(iso) {
  try {
    return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { showToast } = useToast();

  const [meta, setMeta] = useState(null);
  const [project, setProject] = useState(null);
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('ringkasan');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState(null);
  const bypassGuardRef = useRef(false);
  const projectRef = useRef(null);
  const [comments, setComments] = useState(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  // Request checklist dijalankan berurutan supaya respons tidak saling menimpa
  const checklistQueueRef = useRef(Promise.resolve());

  projectRef.current = project;

  async function load() {
    if (!id) return;
    try {
      const [m, projects] = await Promise.all([api.getMeta(), api.getProjects()]);
      setMeta(m);
      const found = projects.find((p) => String(p.id) === String(id));
      if (!found) { setError('Project tidak ditemukan.'); return; }
      setError(null);
      setProject(found);
      setInitialSnapshot(JSON.stringify(pickEditable(found)));
      addRecentProject({ id: found.id, poNumber: found.poNumber, projectName: found.projectName });
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [id]);

  // Ganti project -> komentar project sebelumnya jangan ikut terbawa
  useEffect(() => {
    setComments(null);
    setCommentsError(null);
    setCommentDraft('');
  }, [id]);

  // Ambil komentar begitu tab dibuka (sekali per project, bukan tiap render)
  useEffect(() => {
    if (activeTab !== 'komentar') return;
    const pid = project?.id;
    if (!pid || comments !== null) return;
    let cancelled = false;
    setCommentsLoading(true);
    setCommentsError(null);
    api.getComments(pid)
      .then((data) => { if (!cancelled) setComments(data); })
      .catch((err) => { if (!cancelled) setCommentsError(err.message); })
      .finally(() => { if (!cancelled) setCommentsLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, project?.id, comments]);

  async function submitComment() {
    const text = commentDraft.trim();
    if (!text || postingComment) return;
    setPostingComment(true);
    try {
      const saved = await api.addComment({ projectId: project.id, text });
      setComments((prev) => [...(prev || []), saved]);
      setCommentDraft('');
    } catch (err) {
      showToast(`Gagal mengirim komentar: ${err.message}`, 'error');
    } finally {
      setPostingComment(false);
    }
  }

  const isDirty = useMemo(() => {
    if (!project || !initialSnapshot) return false;
    return JSON.stringify(pickEditable(project)) !== initialSnapshot;
  }, [project, initialSnapshot]);

  useEffect(() => {
    function handleBeforeUnload(e) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    function handleRouteChangeStart(url) {
      if (bypassGuardRef.current) {
        bypassGuardRef.current = false;
        return;
      }
      if (isDirty && url !== router.asPath) {
        setPendingUrl(url);
        setLeaveModalOpen(true);
        router.events.emit('routeChangeError');
        // eslint-disable-next-line no-throw-literal
        throw 'routeChange aborted: unsaved changes';
      }
    }
    router.events.on('routeChangeStart', handleRouteChangeStart);
    return () => router.events.off('routeChangeStart', handleRouteChangeStart);
  }, [isDirty, router]);

  function confirmLeave() {
    setLeaveModalOpen(false);
    if (pendingUrl) {
      bypassGuardRef.current = true;
      router.push(pendingUrl);
    }
  }

  function cancelLeave() {
    setLeaveModalOpen(false);
    setPendingUrl(null);
  }

  function update(field, value) {
    setProject((p) => ({ ...p, [field]: value }));
  }

  async function saveProject() {
    setSaving(true);
    setError(null);
    try {
      // "user" tidak dikirim dari sini: server mengisinya dari sesi login.
      await api.updateProject({ projectId: project.id, ...pickEditable(project) });
      showToast('Tersimpan ke spreadsheet.', 'success');
      await load();
    } catch (err) {
      setError(err.message);
      showToast(`Gagal menyimpan: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const deletedName = project.projectName;
    try {
      await api.deleteProject({ projectId: project.id });
      showToast(`Project "${deletedName}" berhasil dihapus.`, 'success');
      bypassGuardRef.current = true;
      router.push('/');
    } catch (err) {
      setError(err.message);
      showToast(`Gagal menghapus: ${err.message}`, 'error');
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  }

  function updateChecklistData(item, statusVal, linkVal) {
    const current = projectRef.current;
    if (!current?.checklist) return;
    const projectId = current.id;
    const prevStatus = current.checklist.items[item] || 'Not Started';
    const prevLink = current.checklist.links?.[item] || '';

    // Tampilan langsung berubah (optimistic)
    setProject((p) => ({
      ...p,
      checklist: {
        ...p.checklist,
        items: { ...p.checklist.items, [item]: statusVal },
        links: { ...p.checklist.links, [item]: linkVal },
      },
    }));

    checklistQueueRef.current = checklistQueueRef.current.then(async () => {
      try {
        const result = await api.updateChecklist({
          projectId,
          items: { [item]: statusVal },
          links: { [item]: linkVal },
        });
        setProject((p) => ({
          ...p,
          engineeringDocProgress: result.progress,
          checklist: { ...p.checklist, progress: result.progress },
        }));
      } catch (err) {
        // Gagal: kembalikan tampilan ke nilai yang tersimpan sebelumnya
        setProject((p) => ({
          ...p,
          checklist: {
            ...p.checklist,
            items: { ...p.checklist.items, [item]: prevStatus },
            links: { ...p.checklist.links, [item]: prevLink },
          },
        }));
        showToast(`Gagal update checklist: ${err.message}`, 'error');
      }
    });
  }

  if (error && !project) return <div className="text-rust">{error}</div>;
  if (!project || !meta) return <SkeletonProjectDetail />;

  return (
    <div className="flex flex-col gap-6 max-w-3xl pb-24">
      <Head>
        <title>{project.projectName ? `${project.projectName} — Bening Hub` : 'Detail Project — Bening Hub'}</title>
      </Head>

      <Link href="/projects" className="inline-flex items-center gap-1.5 text-xs text-inkmute hover:text-blueprint transition-colors w-fit -mb-2">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Semua Project
      </Link>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <input
            className="text-xs font-data text-inkmute bg-transparent border-b border-dashed border-transparent hover:border-line focus:border-blueprint outline-none w-fit pb-1 transition-colors"
            value={project.poNumber}
            onChange={(e) => update('poNumber', e.target.value)}
            title="Klik untuk mengedit PO Number"
          />
          {isDirty && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-amber bg-amber/10 border border-amber/30 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber"></span>
              Belum disimpan
            </span>
          )}
        </div>
        <input
          className="font-display text-2xl font-semibold text-ink bg-transparent border-b-2 border-transparent hover:border-line focus:border-blueprint outline-none w-full pb-1 transition-colors"
          value={project.projectName}
          onChange={(e) => update('projectName', e.target.value)}
          title="Klik untuk mengedit nama project"
        />
      </div>

      <section className="bg-panel border border-line rounded-lg p-4 flex flex-col gap-4">
        <StageGauge progress={project.stageProgress} activeStage={project.currentStage} />
      </section>

      {/* Navigasi Tab */}
      <div className="flex flex-wrap gap-1.5 border-b border-line sticky top-[57px] md:top-0 bg-canvas z-10 -mx-1 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3.5 py-2.5 text-sm font-medium rounded-t-md transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-blueprint text-blueprint'
                : 'border-transparent text-inkmute hover:text-ink'
            }`}
          >
            {tab.label}
            {tab.key === 'checklist' && (
              <span className="ml-1.5 text-xs opacity-70">{project.checklist?.progress ?? 0}%</span>
            )}
            {tab.key === 'komentar' && comments && comments.length > 0 && (
              <span className="ml-1.5 text-xs opacity-70">{comments.length}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'ringkasan' && (
        <section className="bg-panel border border-line rounded-lg p-6 flex flex-col gap-4">
          <h2 className="font-display font-semibold text-ink">Info Umum</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Row label="Current Stage">
              <select className="input" value={project.currentStage} onChange={(e) => update('currentStage', e.target.value)}>
                {meta.stages.map((s) => <option key={s} value={s}>{s} ({meta.stageWeights[s]}%)</option>)}
              </select>
            </Row>
            <Row label="Status">
              <select className="input" value={project.status} onChange={(e) => update('status', e.target.value)}>
                {meta.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Row>
            <Row label="Priority">
              <select className="input" value={project.priority} onChange={(e) => update('priority', e.target.value)}>
                {meta.priorities.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Row>
            <Row label="PIC">
              <input className="input" value={project.pic || ''} onChange={(e) => update('pic', e.target.value)} />
            </Row>
            <Row label="Client">
              <input className="input" value={project.client || ''} onChange={(e) => update('client', e.target.value)} />
            </Row>
            <Row label="Technology/Capacity">
              <input className="input" value={project.technology || ''} onChange={(e) => update('technology', e.target.value)} />
            </Row>
          </div>
        </section>
      )}

      {activeTab === 'jadwal' && (
        <section className="bg-panel border border-line rounded-lg p-6 flex flex-col gap-4">
          <h2 className="font-display font-semibold text-ink">Jadwal & Tanggal Penting</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Row label="Tanggal PO">
              <input type="date" className="input" value={project.tanggalPO || ''} onChange={(e) => update('tanggalPO', e.target.value)} />
            </Row>
            <Row label="Tanggal DP">
              <input type="date" className="input" value={project.tanggalDP || ''} onChange={(e) => update('tanggalDP', e.target.value)} />
            </Row>
            <Row label="Delivery Date">
              <input type="date" className="input" value={project.deliveryDate || ''} onChange={(e) => update('deliveryDate', e.target.value)} />
            </Row>
            <Row label="Target Finish Date">
              <input type="date" className="input" value={project.targetFinishDate || ''} onChange={(e) => update('targetFinishDate', e.target.value)} />
            </Row>
          </div>
          <Row label="Remarks">
            <textarea className="input" rows={3} value={project.remarks || ''} onChange={(e) => update('remarks', e.target.value)} />
          </Row>
        </section>
      )}

      {activeTab === 'deskripsi' && (
        <section className="bg-panel border border-line rounded-lg p-6 flex flex-col gap-4">
          <h2 className="font-display font-semibold text-ink">Deskripsi & Spesifikasi Teknis</h2>
          <div className="grid grid-cols-1 gap-4">
            <Row label="Deskripsi Pesanan (Teknologi)">
              <textarea className="input" rows={5} value={project.deskripsiPesanan || ''} onChange={(e) => update('deskripsiPesanan', e.target.value)} />
            </Row>
            <Row label="Spesifikasi & Detail Teknologi">
              <textarea className="input" rows={5} value={project.spesifikasiTeknologi || ''} onChange={(e) => update('spesifikasiTeknologi', e.target.value)} />
            </Row>
          </div>
        </section>
      )}

      {activeTab === 'checklist' && !project.checklist && (
        <section className="bg-panel border border-line rounded-lg p-6 text-sm text-inkmute">
          Checklist untuk project ini belum tersedia. Muat ulang halaman untuk membuatnya otomatis.
        </section>
      )}

      {activeTab === 'checklist' && project.checklist && (
        <section className="bg-panel border border-line rounded-lg p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-ink">Engineering Deliverables Checklist</h2>
            <span className="font-data text-sm text-blueprint font-medium">{project.checklist.progress}%</span>
          </div>
          <StageGauge progress={project.checklist.progress} showLabel={false} compact />
          <p className="text-xs text-inkmute -mt-2">Status tersimpan otomatis saat diubah. Link tersimpan saat kamu selesai mengetik (klik di luar kolom atau tekan Enter).</p>
          <div className="grid grid-cols-1 gap-4 mt-2">
            {meta.checklistItems.map((item) => {
              const status = project.checklist.items[item] || 'Not Started';
              const savedLink = project.checklist.links?.[item] || '';
              return (
                <Row key={item} label={item}>
                  <div className="flex gap-3 items-center">
                    <ChecklistStatusIcon status={status} />
                    <select
                      className="input w-1/3"
                      value={status}
                      onChange={(e) => updateChecklistData(item, e.target.value, savedLink)}
                    >
                      {meta.checklistStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChecklistLinkInput
                      value={savedLink}
                      onCommit={(v) => updateChecklistData(item, status, v)}
                      onInvalid={() => showToast('Link harus diawali http:// atau https://', 'error')}
                    />
                  </div>
                </Row>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === 'komentar' && (
        <section className="bg-panel border border-line rounded-lg p-6 flex flex-col gap-4">
          <h2 className="font-display font-semibold text-ink">Komentar</h2>

          {commentsError && (
            <p className="text-rust text-sm">{commentsError}</p>
          )}
          {commentsLoading && comments === null && (
            <p className="text-inkmute text-sm">Memuat komentar...</p>
          )}
          {comments && comments.length === 0 && !commentsLoading && (
            <p className="text-inkmute text-sm">Belum ada komentar. Jadi yang pertama menulis.</p>
          )}
          {comments && comments.length > 0 && (
            <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1">
              {comments.map((c, idx) => (
                <div key={idx} className="flex flex-col gap-1 bg-canvas border border-line rounded-md p-3">
                  <div className="flex items-center justify-between text-xs text-inkmute">
                    <span className="font-medium text-ink">{c.user || 'Tidak diketahui'}</span>
                    <span>{formatCommentTime(c.timestamp)}</span>
                  </div>
                  <p className="text-sm text-ink whitespace-pre-wrap break-words">{c.text}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-3 border-t border-line">
            <textarea
              className="input"
              rows={3}
              placeholder="Tulis komentar... (Ctrl+Enter untuk kirim)"
              value={commentDraft}
              maxLength={COMMENT_MAX_LENGTH}
              disabled={postingComment}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submitComment();
                }
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-inkmute">{commentDraft.length}/{COMMENT_MAX_LENGTH}</span>
              <button
                onClick={submitComment}
                disabled={postingComment || !commentDraft.trim()}
                className="bg-blueprint hover:bg-blueprintdark text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {postingComment ? 'Mengirim...' : 'Kirim Komentar'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Bar Aksi - selalu terlihat di bagian bawah, tidak terikat tab */}
      <div className="fixed bottom-0 left-0 md:left-60 right-0 z-20 bg-panel border-t border-line shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div className="max-w-6xl mx-auto px-5 md:px-10 py-3 flex items-center gap-3">
          <button
            onClick={saveProject}
            disabled={saving || deleting || !isDirty}
            className="bg-blueprint hover:bg-blueprintdark text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
          <button
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={saving || deleting}
            className="bg-rust/10 hover:bg-rust/20 text-rust rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            Hapus Project
          </button>
          {error && <span className="text-rust text-sm">{error}</span>}
        </div>
      </div>

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Hapus project ini?"
        description={`Tindakan ini tidak bisa dibatalkan. Data project "${project.projectName}" (PO: ${project.poNumber}) akan dihapus permanen dari spreadsheet.`}
        confirmText={deleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
        requireText={project.projectName}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <ConfirmModal
        open={leaveModalOpen}
        title="Ada perubahan belum disimpan"
        description={'Kalau kamu pindah halaman sekarang, perubahan yang belum di-"Simpan Perubahan" akan hilang.'}
        confirmText="Ya, Tinggalkan Halaman"
        cancelText="Tetap di Sini"
        danger={true}
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />

      <style jsx global>{`
        .input { border: 1px solid #D7E0E3; border-radius: 6px; padding: 8px 10px; font-size: 14px; background: white; width: 100%; }
      `}</style>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-inkmute font-medium">{label}</span>
      {children}
    </label>
  );
}

// Link disimpan SEKALI saat selesai mengetik (blur / Enter), bukan tiap ketikan,
// supaya tidak membanjiri backend dan link tidak tersimpan terpotong.
function ChecklistLinkInput({ value, onCommit, onInvalid }) {
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  function commit() {
    const v = draft.trim();
    if (v === value) { setDraft(value); return; }
    if (v && !/^https?:\/\//i.test(v)) {
      onInvalid?.();
      setDraft(value);
      return;
    }
    setDraft(v);
    onCommit(v);
  }

  return (
    <input
      type="text"
      inputMode="url"
      placeholder="URL Dokumen / Drive Link..."
      className="input flex-1"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
    />
  );
}

function ChecklistStatusIcon({ status }) {
  if (status === 'Completed') {
    return <span className="w-5 h-5 rounded-full bg-teal/15 text-teal flex items-center justify-center text-xs flex-shrink-0" title="Completed">✓</span>;
  }
  if (status === 'Under Review') {
    return <span className="w-5 h-5 rounded-full bg-amber/15 text-amber flex items-center justify-center text-xs flex-shrink-0" title="Under Review">⏳</span>;
  }
  if (status === 'Drafting') {
    return <span className="w-5 h-5 rounded-full bg-blueprint/15 text-blueprint flex items-center justify-center text-xs flex-shrink-0" title="Drafting">✎</span>;
  }
  if (status === 'N/A') {
    return <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs flex-shrink-0" title="N/A">–</span>;
  }
  return <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs flex-shrink-0" title="Not Started">○</span>;
}
