import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { api } from '../../lib/api';
import { addRecentProject } from '../../lib/recentlyViewed';
import { DOC_GENERATOR_ROUTE } from '../../lib/docgen/schema';
import StageGauge from '../../components/StageGauge';
import StagePipeline from '../../components/StagePipeline';
import { StatusBadge, PriorityBadge, DeliveryHint, Pill } from '../../components/Badges';
import { fmtDate, todayISO, initialOf, nameFromEmail, timeAgo } from '../../lib/projectHelpers';
import { SYSTEMS, RO_OPTIONS, normalizeSystems, detectSystems, effectiveSystems, systemLabel, docReadiness } from '../../lib/systems';
import SpecsEditor from '../../components/SpecsEditor';
import { packSpecs, buildSpecValues, visibleSections, overallProgress } from '../../lib/docgen/specs';
import { canDelete, canWrite } from '../../lib/roles';
import TechFlow from '../../components/TechFlow';
import SimilarArchive from '../../components/SimilarArchive';
import { projectFlowModules, SYSTEM_DISPLAY_ORDER } from '../../lib/techflow';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../components/Toast';
import { SkeletonBlock } from '../../components/Skeleton';

// Field yang diedit lewat tombol "Simpan Perubahan". Checklist disimpan otomatis & terpisah,
// jadi TIDAK ikut menentukan status "Belum disimpan".
const EDITABLE_FIELDS = [
  'poNumber', 'projectName', 'client', 'technology', 'pic',
  'currentStage', 'status', 'priority',
  'tanggalPO', 'tanggalDP', 'deliveryDate', 'targetFinishDate',
  'remarks', 'deskripsiPesanan', 'spesifikasiTeknologi',
  'lokasiPlant', 'alamat', 'kontakOwner', 'sistemTerpasang',
];

function pickEditable(p) {
  const out = {};
  EDITABLE_FIELDS.forEach((f) => { out[f] = p?.[f] ?? (f === 'sistemTerpasang' ? [] : ''); });
  return out;
}

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'jadwal', label: 'Jadwal' },
  { key: 'spesifikasi', label: 'Spesifikasi Peralatan' },
  { key: 'checklist', label: 'Checklist Engineering' },
  { key: 'komentar', label: 'Komentar' },
];

const COMMENT_MAX_LENGTH = 2000;

export default function ProjectDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { showToast } = useToast();
  const { data: session } = useSession();

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
  // Spesifikasi peralatan (dipakai form Hand Over). Disimpan terpisah di tab "Project Specs".
  const [specsValues, setSpecsValues] = useState(null);   // nilai yang sedang diedit
  const [specsSaved, setSpecsSaved] = useState(null);     // nilai terakhir yang tersimpan di server
  const [specsVersion, setSpecsVersion] = useState(0);
  const [specsLoading, setSpecsLoading] = useState(false);
  const [specsError, setSpecsError] = useState(null);
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

  // Ganti project -> spesifikasi project sebelumnya jangan ikut terbawa
  useEffect(() => {
    setSpecsValues(null);
    setSpecsSaved(null);
    setSpecsVersion(0);
    setSpecsError(null);
  }, [id]);

  async function loadSpecs() {
    const current = projectRef.current;
    if (!current?.id) return;
    setSpecsLoading(true);
    setSpecsError(null);
    try {
      const res = await api.getSpecs(current.id);
      const values = buildSpecValues(current, res.specs);
      setSpecsValues(values);
      setSpecsSaved(values);
      setSpecsVersion(res.version || 0);
    } catch (err) {
      setSpecsError(err.message);
    } finally {
      setSpecsLoading(false);
    }
  }

  // Dimuat di latar belakang begitu project terbuka (dipakai juga untuk kartu "Kesiapan dokumen").
  useEffect(() => {
    if (!project?.id || specsValues !== null || specsLoading || specsError) return;
    loadSpecs();
  }, [project?.id, specsValues, specsLoading, specsError]);

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

  const projectDirty = useMemo(() => {
    if (!project || !initialSnapshot) return false;
    return JSON.stringify(pickEditable(project)) !== initialSnapshot;
  }, [project, initialSnapshot]);

  const specsDirty = useMemo(() => {
    if (!specsValues || !specsSaved) return false;
    return JSON.stringify(packSpecs(specsValues)) !== JSON.stringify(packSpecs(specsSaved));
  }, [specsValues, specsSaved]);

  const isDirty = projectDirty || specsDirty;

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

  function discardChanges() {
    if (!initialSnapshot) return;
    setProject((p) => ({ ...p, ...JSON.parse(initialSnapshot) }));
    if (specsSaved) setSpecsValues(specsSaved);
    setError(null);
  }

  // Ctrl/Cmd + S = simpan
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

  function update(field, value) {
    setProject((p) => ({ ...p, [field]: value }));
  }

  function updateSpec(fieldId, value) {
    setSpecsValues((v) => ({ ...(v || {}), [fieldId]: value }));
  }

  async function saveProject() {
    setSaving(true);
    setError(null);
    try {
      // "user" tidak dikirim dari sini: server mengisinya dari sesi login.
      let projectSaved = false;
      if (projectDirty) {
        await api.updateProject({ projectId: project.id, ...pickEditable(project) });
        projectSaved = true;
      }
      if (specsDirty) {
        try {
          const res = await api.saveSpecs({
            projectId: project.id,
            specs: packSpecs(specsValues),
            baseVersion: specsVersion,
          });
          setSpecsVersion(res.version);
          setSpecsSaved(specsValues);
        } catch (err) {
          // Data project sudah tersimpan; hanya spesifikasi yang gagal (mis. bentrok versi).
          if (projectSaved) await load();
          setError(`Spesifikasi belum tersimpan: ${err.message}`);
          showToast(`Spesifikasi gagal disimpan: ${err.message}`, 'error');
          return;
        }
      }
      showToast('Tersimpan ke spreadsheet.', 'success');
      if (projectSaved) await load();
    } catch (err) {
      setError(err.message);
      showToast(`Gagal menyimpan: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  saveRef.current = () => { if (isDirty && !saving && !deleting) saveProject(); };

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

  if (error && !project) return <div className="bg-panel border border-line rounded-lg p-6 text-rust">{error}</div>;
  if (!project || !meta) return <DetailSkeleton />;

  // ---- Turunan data untuk tampilan ----
  const checklist = project.checklist;
  const items = meta.checklistItems;
  const statusOf = (item) => (checklist?.items?.[item]) || 'Not Started';
  const applicable = items.filter((i) => statusOf(i) !== 'N/A');
  const doneCount = applicable.filter((i) => statusOf(i) === 'Completed').length;
  const reviewCount = applicable.filter((i) => statusOf(i) === 'Under Review').length;
  const hasRemarks = project.remarks && String(project.remarks).trim() && String(project.remarks).trim() !== '-';
  const today = todayISO();
  const canDeleteProject = canDelete(session?.user?.role || 'admin'); // pengecekan sebenarnya di server
  const canArchive = canWrite(session?.user?.role || 'admin') && project.currentStage === 'Hand Over and Finished';
  const targetDays = project.targetFinishDate
    ? Math.round((new Date(`${project.targetFinishDate}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000)
    : null;
  const targetHint =
    targetDays === null ? '' : targetDays < 0 ? `Terlewat ${Math.abs(targetDays)} hari` : targetDays === 0 ? 'Hari ini' : `${targetDays} hari lagi`;

  const savedSystems = normalizeSystems(project.sistemTerpasang);
  const detectedKeys = detectSystems(project);
  const shownSystems = effectiveSystems(project);
  const filterCount = ['birm', 'mmf', 'acf'].filter((k) => savedSystems.includes(k)).length;
  const readiness = {
    commissioning: docReadiness(project, 'commissioning'),
    handover: docReadiness(project, 'handover'),
  };
  const allMissing = Array.from(new Set([...readiness.commissioning.missing, ...readiness.handover.missing]));
  const specSections = visibleSections(project);
  const flowModules = projectFlowModules(project, specsValues);
  const displaySystems = SYSTEM_DISPLAY_ORDER.map((k) => SYSTEMS.find((x) => x.key === k)).filter(Boolean);
  const specProgress = specsValues ? overallProgress(specSections, specsValues) : null;
  const commPercent = Math.round(((4 - readiness.commissioning.missing.length) / 4) * 100);

  // Gabungkan isi kolom lama "Spesifikasi Teknologi" ke "Lingkup pesanan", lalu kosongkan kolom lama.
  // Baru tersimpan setelah "Simpan perubahan"; isi lama tetap tercatat di tab Aktivitas.
  function mergeOldSpec() {
    const oldSpec = String(project.spesifikasiTeknologi || '').trim();
    if (!oldSpec) return;
    const cur = String(project.deskripsiPesanan || '').trim();
    update('deskripsiPesanan', cur ? `${cur}\n${oldSpec}` : oldSpec);
    update('spesifikasiTeknologi', '');
  }

  function toggleSystem(key) {
    const cur = savedSystems;
    let next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    if (key === 'ro' && !next.includes('ro')) next = next.filter((k) => k !== 'ro_large' && k !== 'recycle');
    update('sistemTerpasang', normalizeSystems(next));
  }

  const dateWarnings = [];
  if (project.tanggalPO && project.tanggalDP && project.tanggalDP < project.tanggalPO) dateWarnings.push('Tanggal DP lebih awal dari Tanggal PO.');
  if (project.tanggalPO && project.deliveryDate && project.deliveryDate < project.tanggalPO) dateWarnings.push('Delivery Date lebih awal dari Tanggal PO.');
  if (project.tanggalDP && project.deliveryDate && project.deliveryDate < project.tanggalDP) dateWarnings.push('Delivery Date lebih awal dari Tanggal DP.');

  const scheduleEvents = [
    { label: 'Tanggal PO', date: project.tanggalPO },
    { label: 'Tanggal DP', date: project.tanggalDP },
    { label: 'Delivery Date', date: project.deliveryDate },
    { label: 'Target selesai', date: project.targetFinishDate },
  ];

  return (
    <div className="flex flex-col gap-5 pb-28">
      <Head>
        <title>{project.projectName ? `${project.projectName} — Bening Hub` : 'Detail Project — Bening Hub'}</title>
      </Head>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-inkmute">
        <Link href="/projects" className="hover:text-blueprint transition-colors">Semua Project</Link>
        <span aria-hidden="true">/</span>
        <span className="font-data truncate">{project.poNumber || 'Tanpa PO'}</span>
      </nav>

      {/* Kepala halaman: gaya title block gambar teknik */}
      <header className="bg-panel border border-line rounded-lg overflow-hidden shadow-sm">
        <div className="bp-grid px-5 pt-5 pb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="text-xs font-data text-inkmute bg-panel/70 rounded border border-transparent hover:border-line focus:border-blueprint outline-none w-fit max-w-full px-1.5 py-0.5 transition-colors"
              value={project.poNumber}
              onChange={(e) => update('poNumber', e.target.value)}
              title="Klik untuk mengedit PO Number"
              aria-label="PO Number"
            />
            <StatusBadge status={project.status} />
            <PriorityBadge priority={project.priority} />
            {isDirty && (
              <Pill tone="amber" dot>Belum disimpan</Pill>
            )}
          </div>
          <AutoGrowTitle value={project.projectName} onChange={(v) => update('projectName', v)} />
          {shownSystems.keys.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-1">
              <TechFlow modules={flowModules} />
              {shownSystems.detected && <span className="text-[11px] text-inkmute">terdeteksi otomatis dari nama project, belum disimpan</span>}
            </div>
          )}
        </div>

        <dl className="grid grid-cols-2 md:grid-cols-5 border-t border-line divide-x divide-y md:divide-y-0 divide-line">
          <TitleCell label="Client" value={project.client} />
          <TitleCell label="Lokasi plant" value={project.lokasiPlant} />
          <TitleCell label="PIC" value={project.pic} />
          <TitleCell label="Teknologi / kapasitas" value={project.technology} />
          <TitleCell className="col-span-2 md:col-span-1" label="Delivery" value={project.deliveryDate ? fmtDate(project.deliveryDate) : ''} extra={<DeliveryHint p={project} />} />
        </dl>
      </header>

      {/* Project selesai: tawarkan mencatat teknologinya ke arsip */}
      {canArchive && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-teal/10 border border-teal/30 rounded-lg px-4 py-3">
          <p className="text-sm text-ink flex-1">
            <b>Project ini sudah selesai.</b> Catat teknologinya ke arsip sebagai acuan untuk project berikutnya. Alur dan kapasitas terisi otomatis dari data project.
          </p>
          <Link href={`/arsip/new?from=${encodeURIComponent(project.id)}`} className="btn btn-secondary whitespace-nowrap">Arsipkan teknologi</Link>
        </div>
      )}

      {/* Catatan / kendala aktif */}
      {hasRemarks && (
        <div className="flex gap-3 bg-amber/10 border border-amber/30 border-l-4 border-l-amber rounded-lg px-4 py-3">
          <svg className="w-5 h-5 text-amberink shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Catatan project</p>
            <p className="text-sm text-ink/80 whitespace-pre-wrap break-words mt-0.5">{project.remarks}</p>
          </div>
        </div>
      )}

      {/* Pipeline tahapan */}
      <section className="bg-panel border border-line rounded-lg p-5 shadow-sm">
        <StagePipeline
          current={project.currentStage}
          weights={meta.stageWeights}
          onSelect={(stage) => update('currentStage', stage)}
        />
      </section>

      {/* Ringkasan angka */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-panel border border-line rounded-lg p-4 flex flex-col gap-2 shadow-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-inkmute">Progress tahapan</span>
            <span className="font-data tnum text-lg font-semibold text-ink">{meta.stageWeights[project.currentStage] ?? project.stageProgress}%</span>
          </div>
          <StageGauge progress={meta.stageWeights[project.currentStage] ?? project.stageProgress} showLabel={false} compact />
          <span className="text-xs text-inkmute truncate">{project.currentStage}</span>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('checklist')}
          className="text-left bg-panel border border-line rounded-lg p-4 flex flex-col gap-2 shadow-sm hover:border-blueprint/50 transition-colors"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-inkmute">Dokumen engineering</span>
            <span className="font-data tnum text-lg font-semibold text-ink">{checklist?.progress ?? project.engineeringDocProgress}%</span>
          </div>
          <StageGauge progress={checklist?.progress ?? project.engineeringDocProgress} showLabel={false} compact />
          <span className="text-xs text-inkmute tnum">
            {doneCount} dari {applicable.length} selesai{reviewCount > 0 ? ` · ${reviewCount} direview` : ''}
          </span>
        </button>

        <div className="bg-panel border border-line rounded-lg p-4 flex flex-col gap-2 shadow-sm">
          <span className="text-xs text-inkmute">Target selesai</span>
          {project.targetFinishDate ? (
            <>
              <span className="font-data tnum text-lg font-semibold text-ink">{fmtDate(project.targetFinishDate)}</span>
              <span className={`text-xs ${targetDays < 0 ? 'text-rust font-medium' : 'text-inkmute'}`}>{targetHint}</span>
            </>
          ) : (
            <>
              <span className="text-sm text-inkmute">Belum diatur</span>
              <button type="button" onClick={() => setActiveTab('jadwal')} className="text-xs font-medium text-blueprint hover:underline self-start">
                Atur di tab Jadwal
              </button>
            </>
          )}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] items-start">
        {/* ===== Kolom utama ===== */}
        <div className="flex flex-col gap-5 min-w-0">
          <div role="tablist" className="flex gap-1 border-b border-line sticky top-[57px] md:top-0 bg-canvas z-10 overflow-x-auto -mx-1 px-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3.5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-blueprint text-blueprint'
                    : 'border-transparent text-inkmute hover:text-ink'
                }`}
              >
                {tab.label}
                {tab.key === 'spesifikasi' && specProgress && specSections.length > 0 && (
                  <span className="ml-1.5 text-xs tnum opacity-70">{specProgress.percent}%</span>
                )}
                {tab.key === 'checklist' && (
                  <span className="ml-1.5 text-xs tnum opacity-70">{checklist?.progress ?? 0}%</span>
                )}
                {tab.key === 'komentar' && comments && comments.length > 0 && (
                  <span className="ml-1.5 text-xs tnum opacity-70">{comments.length}</span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'ringkasan' && (
            <>
            <Panel title="Info umum" hint="Perubahan baru tersimpan setelah menekan Simpan perubahan.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Row label="Current stage">
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
                <Row label="Technology / capacity">
                  <input className="input" value={project.technology || ''} onChange={(e) => update('technology', e.target.value)} />
                </Row>
              </div>
              <Row label="Lingkup pesanan (sesuai PO)">
                <textarea
                  className="input"
                  rows={3}
                  placeholder="ex: Tank NaCl 5000 L, Tank NaCl 300 L (2 unit), Tank PAA 300 L (2 unit)"
                  value={project.deskripsiPesanan || ''}
                  onChange={(e) => update('deskripsiPesanan', e.target.value)}
                />
              </Row>
              {String(project.spesifikasiTeknologi || '').trim() && (
                <div className="flex flex-col gap-2 bg-canvas border border-line rounded-md px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-inkmute">Catatan lama (kolom Spesifikasi Teknologi)</span>
                    <button type="button" onClick={mergeOldSpec} className="text-xs font-medium text-blueprint hover:underline">
                      Gabungkan ke lingkup pesanan
                    </button>
                  </div>
                  <p className="text-sm text-ink/90 whitespace-pre-wrap break-words">{project.spesifikasiTeknologi}</p>
                </div>
              )}
            </Panel>

            <Panel title="Lokasi & kontak owner" hint="Dipakai otomatis di form Commissioning Report dan Hand Over.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Row label="Lokasi plant">
                  <input className="input" placeholder="ex: Kebumen, Jawa Tengah" value={project.lokasiPlant || ''} onChange={(e) => update('lokasiPlant', e.target.value)} />
                </Row>
                <Row label="Nama kontak owner (klien)">
                  <input className="input" placeholder="Nama yang menandatangani di pihak klien" value={project.kontakOwner || ''} onChange={(e) => update('kontakOwner', e.target.value)} />
                </Row>
              </div>
              <Row label="Alamat lengkap">
                <textarea className="input" rows={2} placeholder="Alamat detail lokasi plant" value={project.alamat || ''} onChange={(e) => update('alamat', e.target.value)} />
              </Row>
            </Panel>

            <Panel title="Sistem terpasang" hint="Urut sesuai alur pengolahan air (air baku sampai air produk). Modul yang dipilih otomatis aktif di form Commissioning dan Hand Over, lengkap dengan nomor tag P&ID.">
              {savedSystems.length === 0 && detectedKeys.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-blueprint/10 border border-blueprint/25 rounded-md px-3 py-2 text-sm">
                  <span className="text-ink">Terdeteksi dari nama project: <b>{detectedKeys.map(systemLabel).join(', ')}</b></span>
                  <button type="button" onClick={() => update('sistemTerpasang', normalizeSystems(detectedKeys))} className="text-sm font-medium text-blueprint hover:underline">
                    Terapkan
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {displaySystems.map((sys) => {
                  const checked = savedSystems.includes(sys.key);
                  return (
                    <label
                      key={sys.key}
                      className={`flex items-start gap-2.5 rounded-md border px-3 py-2 cursor-pointer transition-colors ${checked ? 'border-blueprint/50 bg-blueprint/10' : 'border-line hover:border-blueprint/40'}`}
                    >
                      <input type="checkbox" className="mt-0.5 w-4 h-4 accent-blueprint" checked={checked} onChange={() => toggleSystem(sys.key)} />
                      <span className="text-sm text-ink leading-snug">
                        {sys.label}
                        {sys.hint && <span className="block text-[11px] text-inkmute">{sys.hint}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
              {savedSystems.includes('ro') && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {RO_OPTIONS.map((opt) => {
                    const checked = savedSystems.includes(opt.key);
                    return (
                      <label
                        key={opt.key}
                        className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 cursor-pointer text-sm transition-colors ${checked ? 'border-blueprint/50 bg-blueprint/10 text-ink' : 'border-line text-ink hover:border-blueprint/40'}`}
                      >
                        <input type="checkbox" className="w-4 h-4 accent-blueprint" checked={checked} onChange={() => toggleSystem(opt.key)} />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              )}
              {filterCount > 2 && (
                <p className="text-xs text-amberink">Template Hand Over hanya punya 2 slot filter. Filter ketiga perlu dicatat manual di "Item Tambahan".</p>
              )}
            </Panel>

            {canDeleteProject && (
              <details className="group rounded-lg border border-rust/30 bg-panel">
                <summary className="cursor-pointer select-none list-none px-4 py-3 text-sm font-medium text-rust flex items-center justify-between">
                  Zona berbahaya
                  <span className="text-xs text-inkmute group-open:hidden">Klik untuk membuka</span>
                </summary>
                <div className="px-4 pb-4 pt-1 flex flex-col sm:flex-row sm:items-center gap-3 border-t border-rust/20">
                  <p className="text-sm text-inkmute flex-1">
                    Menghapus project menghapus barisnya dari spreadsheet secara permanen. Hanya admin yang bisa melakukannya.
                  </p>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={saving || deleting}
                    className="text-sm font-medium text-rust border border-rust/40 hover:bg-rust/10 rounded-md px-3 h-9 disabled:opacity-60 transition-colors whitespace-nowrap"
                  >
                    Hapus project...
                  </button>
                </div>
              </details>
            )}
            </>
          )}

          {activeTab === 'jadwal' && (
            <Panel title="Jadwal & tanggal penting">
              {dateWarnings.length > 0 && (
                <div className="flex flex-col gap-1 bg-amber/10 border border-amber/30 rounded-md px-3 py-2 text-sm text-ink" role="alert">
                  {dateWarnings.map((w) => <span key={w}>⚠ {w} Cek kembali tanggalnya.</span>)}
                </div>
              )}
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
              <Row label="Remarks (kendala, menunggu material, dll.)">
                <textarea className="input" rows={3} value={project.remarks || ''} onChange={(e) => update('remarks', e.target.value)} />
              </Row>
            </Panel>
          )}

          {activeTab === 'spesifikasi' && flowModules.length > 0 && <SimilarArchive modules={flowModules} />}

          {activeTab === 'spesifikasi' && (
            <SpecsEditor
              sections={specSections}
              values={specsValues}
              onChange={updateSpec}
              loading={specsLoading && specsValues === null}
              error={specsError}
              onRetry={loadSpecs}
              onGoSummary={() => setActiveTab('ringkasan')}
              scopeText={project.deskripsiPesanan}
              oldSpecText={project.spesifikasiTeknologi}
              version={specsVersion}
            />
          )}

          {activeTab === 'checklist' && !checklist && (
            <Panel title="Checklist engineering">
              <p className="text-sm text-inkmute">Checklist untuk project ini belum tersedia. Muat ulang halaman untuk membuatnya otomatis.</p>
            </Panel>
          )}

          {activeTab === 'checklist' && checklist && (
            <Panel
              title="Engineering deliverables"
              hint="Status tersimpan otomatis saat diubah. Link tersimpan saat selesai mengetik (klik di luar kolom atau tekan Enter)."
              aside={<span className="font-data tnum text-sm font-semibold text-blueprint">{checklist.progress}%</span>}
            >
              <StageGauge progress={checklist.progress} showLabel={false} compact />
              {allMissing.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-amber/10 border border-amber/30 rounded-md px-3 py-2 text-sm">
                  <span className="text-ink">Data untuk mengisi dokumen otomatis belum lengkap: <b>{allMissing.join(', ')}</b>.</span>
                  <button type="button" onClick={() => setActiveTab('ringkasan')} className="text-sm font-medium text-blueprint hover:underline">Lengkapi di Ringkasan</button>
                </div>
              )}
              <div className="border border-line rounded-lg divide-y divide-line overflow-hidden">
                {items.map((item) => {
                  const status = statusOf(item);
                  const savedLink = checklist.links?.[item] || '';
                  const docSlug = DOC_GENERATOR_ROUTE[item];
                  return (
                    <div
                      key={item}
                      className={`grid gap-2.5 p-3 md:grid-cols-[minmax(0,190px)_136px_minmax(0,1fr)_auto] md:items-center ${status === 'N/A' ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ChecklistStatusIcon status={status} />
                        <span className="text-sm font-medium text-ink truncate" title={item}>{item}</span>
                      </div>
                      <select
                        className="input !min-h-[34px] !py-1"
                        aria-label={`Status ${item}`}
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
                      <div className="flex items-center gap-3 md:justify-end min-h-[20px]">
                        {savedLink && (
                          <a href={savedLink} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blueprint hover:underline whitespace-nowrap">
                            Buka
                          </a>
                        )}
                        {docSlug && readiness[docSlug] && (
                          <span title={readiness[docSlug].ready ? 'Data project cukup untuk mengisi form otomatis' : `Kurang: ${readiness[docSlug].missing.join(', ')}`}>
                            {docSlug === 'handover' && readiness.handover.ready && specProgress && specSections.length > 0 ? (
                              <Pill tone={specProgress.percent >= 100 ? 'teal' : 'amber'} dot>Spesifikasi {specProgress.percent}%</Pill>
                            ) : (
                              <Pill tone={readiness[docSlug].ready ? 'teal' : 'amber'} dot>{readiness[docSlug].ready ? 'Data siap' : 'Data kurang'}</Pill>
                            )}
                          </span>
                        )}
                        {docSlug && (
                          <Link
                            href={`/documents/${docSlug}/new?projectId=${encodeURIComponent(project.id)}`}
                            className="text-xs font-medium text-blueprint hover:underline whitespace-nowrap"
                            title={savedLink ? 'Buat ulang dokumen (link lama akan diganti)' : 'Buat dokumen otomatis dari data project ini'}
                          >
                            {savedLink ? 'Buat ulang' : '+ Buat dokumen'}
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {activeTab === 'komentar' && (
            <Panel title="Komentar">
              {commentsError && <p className="text-rust text-sm">{commentsError}</p>}
              {commentsLoading && comments === null && <p className="text-inkmute text-sm">Memuat komentar...</p>}
              {comments && comments.length === 0 && !commentsLoading && (
                <p className="text-inkmute text-sm">Belum ada komentar. Catat keputusan atau kendala project di sini.</p>
              )}
              {comments && comments.length > 0 && (
                <ul className="flex flex-col gap-4 max-h-[440px] overflow-y-auto pr-1">
                  {comments.map((c, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="w-8 h-8 rounded-full bg-blueprint/10 text-blueprint text-xs font-bold flex items-center justify-center shrink-0">
                        {initialOf(nameFromEmail(c.user))}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-medium text-ink">{nameFromEmail(c.user)}</span>
                          <span className="text-xs text-inkmute" title={new Date(c.timestamp).toLocaleString('id-ID')}>{timeAgo(c.timestamp)}</span>
                        </div>
                        <p className="text-sm text-ink/90 whitespace-pre-wrap break-words mt-0.5">{c.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-col gap-2 pt-4 border-t border-line">
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
                  <span className="text-[11px] text-inkmute tnum">{commentDraft.length}/{COMMENT_MAX_LENGTH}</span>
                  <button
                    onClick={submitComment}
                    disabled={postingComment || !commentDraft.trim()}
                    className="bg-blueprint hover:bg-blueprintdark text-onaccent rounded-md px-4 h-9 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {postingComment ? 'Mengirim...' : 'Kirim komentar'}
                  </button>
                </div>
              </div>
            </Panel>
          )}
        </div>

        {/* ===== Kolom samping ===== */}
        <aside className="flex flex-col gap-4 min-w-0">
          <section className="bg-panel border border-line rounded-lg p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-ink mb-3">Kesiapan dokumen</h2>
            <div className="flex flex-col gap-3.5">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-ink">Commissioning Report</span>
                  <span className="font-data tnum font-semibold text-ink">{commPercent}%</span>
                </div>
                <div className="h-1.5 bg-line/60 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${commPercent >= 100 ? 'bg-teal' : 'bg-blueprint'}`} style={{ width: `${commPercent}%` }} />
                </div>
                {readiness.commissioning.missing.length > 0 ? (
                  <button onClick={() => setActiveTab('ringkasan')} className="text-[11px] text-amberink hover:underline mt-1.5 text-left">
                    Kurang: {readiness.commissioning.missing.join(', ')}
                  </button>
                ) : (
                  <p className="text-[11px] text-teal mt-1.5">Data lengkap, siap di-generate</p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-ink">Hand Over Report</span>
                  <span className="font-data tnum font-semibold text-ink">{specProgress && specSections.length > 0 ? `${specProgress.percent}%` : '-'}</span>
                </div>
                <div className="h-1.5 bg-line/60 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${specProgress && specProgress.percent >= 100 ? 'bg-teal' : 'bg-blueprint'}`} style={{ width: `${specProgress && specSections.length > 0 ? specProgress.percent : 0}%` }} />
                </div>
                <button onClick={() => setActiveTab(specSections.length > 0 ? 'spesifikasi' : 'ringkasan')} className="text-[11px] text-blueprint hover:underline mt-1.5 text-left">
                  {specSections.length === 0 ? 'Pilih sistem terpasang dulu' : specProgress && specProgress.percent >= 100 ? 'Spesifikasi lengkap' : 'Lengkapi spesifikasi peralatan'}
                </button>
              </div>
            </div>
          </section>

          <section className="bg-panel border border-line rounded-lg p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-ink mb-3">Garis waktu</h2>
            <ol className="flex flex-col">
              {scheduleEvents.map((ev, i) => {
                const has = !!ev.date;
                const passed = has && ev.date <= today;
                const isLast = i === scheduleEvents.length - 1;
                return (
                  <li key={ev.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`w-2.5 h-2.5 rounded-full mt-1.5 border-2 ${passed ? 'bg-blueprint border-blueprint' : has ? 'bg-panel border-blueprint' : 'bg-panel border-line'}`} />
                      {!isLast && <span className="w-px flex-1 bg-line my-1" />}
                    </div>
                    <div className={`pb-3.5 ${isLast ? 'pb-0' : ''}`}>
                      <p className="text-xs text-inkmute">{ev.label}</p>
                      <p className={`text-sm tnum ${has ? 'font-medium text-ink' : 'text-inkmute'}`}>{has ? fmtDate(ev.date) : 'Belum diisi'}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {checklist && (
            <section className="bg-panel border border-line rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-ink">Status dokumen</h2>
                <button onClick={() => setActiveTab('checklist')} className="text-xs font-medium text-blueprint hover:underline">Kelola</button>
              </div>
              <ul className="flex flex-col gap-2">
                {items.map((item) => {
                  const status = statusOf(item);
                  const link = checklist.links?.[item];
                  return (
                    <li key={item} className="flex items-center gap-2 text-xs">
                      <ChecklistStatusIcon status={status} small />
                      <span className={`flex-1 truncate ${status === 'N/A' ? 'text-inkmute' : 'text-ink'}`}>{item}</span>
                      {link ? (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-blueprint hover:underline shrink-0">Buka</a>
                      ) : (
                        <span className="text-inkmute shrink-0">{status === 'N/A' ? 'N/A' : status === 'Completed' ? 'Selesai' : status === 'Not Started' ? 'Belum' : status === 'Drafting' ? 'Draft' : 'Review'}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {/* Bar aksi - selalu terlihat di bawah */}
      <div className="fixed bottom-0 left-0 md:left-60 right-0 z-20 bg-panel/95 backdrop-blur border-t border-line shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="max-w-6xl mx-auto px-5 md:px-10 py-3 flex items-center gap-3">
          <button
            onClick={saveProject}
            disabled={saving || deleting || !isDirty}
            className="bg-blueprint hover:bg-blueprintdark text-onaccent rounded-md px-4 h-9 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Menyimpan...' : 'Simpan perubahan'}
          </button>
          {isDirty && !saving && (
            <button
              onClick={discardChanges}
              className="text-sm font-medium text-inkmute hover:text-ink px-2 h-9"
            >
              Batalkan
            </button>
          )}
          <span className="hidden sm:inline text-xs text-inkmute">
            {isDirty ? 'Ada perubahan yang belum disimpan · Ctrl+S untuk simpan' : 'Semua perubahan sudah tersimpan'}
          </span>
          {error && <span className="text-rust text-sm truncate">{error}</span>}
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
        description={'Kalau kamu pindah halaman sekarang, perubahan yang belum di-"Simpan perubahan" akan hilang.'}
        confirmText="Ya, Tinggalkan Halaman"
        cancelText="Tetap di Sini"
        danger={true}
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />
    </div>
  );
}

// Judul project: textarea yang tingginya menyesuaikan isi, supaya nama panjang tidak terpotong di HP.
function AutoGrowTitle({ value, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      className="font-display text-2xl sm:text-[28px] leading-tight font-semibold text-ink bg-transparent rounded border-b-2 border-transparent hover:border-line focus:border-blueprint outline-none w-full pb-1 transition-colors resize-none overflow-hidden block"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))}
      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
      title="Klik untuk mengedit nama project"
      aria-label="Nama project"
    />
  );
}

function TitleCell({ label, value, extra, className = '' }) {
  return (
    <div className={`px-4 py-3 min-w-0 ${className}`}>
      <dt className="text-xs text-inkmute">{label}</dt>
      <dd className="mt-1 flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-ink truncate max-w-full" title={value || ''}>{value || '-'}</span>
        {extra}
      </dd>
    </div>
  );
}

function Panel({ title, hint, aside, children }) {
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
      placeholder="URL dokumen / Drive link..."
      aria-label="Link dokumen"
      className="input !min-h-[34px] !py-1"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
    />
  );
}

const ICON_STYLE = {
  Completed: { cls: 'bg-teal/15 text-teal', glyph: '✓' },
  'Under Review': { cls: 'bg-amber/15 text-amberink', glyph: '◐' },
  Drafting: { cls: 'bg-blueprint/15 text-blueprint', glyph: '✎' },
  'N/A': { cls: 'bg-inkmute/10 text-inkmute', glyph: '–' },
  'Not Started': { cls: 'bg-inkmute/10 text-inkmute', glyph: '○' },
};

function ChecklistStatusIcon({ status, small = false }) {
  const s = ICON_STYLE[status] || ICON_STYLE['Not Started'];
  return (
    <span
      className={`${small ? 'w-4 h-4 text-[10px]' : 'w-5 h-5 text-xs'} rounded-full flex items-center justify-center shrink-0 ${s.cls}`}
      title={status}
    >
      {s.glyph}
    </span>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-5 pb-28">
      <SkeletonBlock className="h-3.5 w-40" />
      <div className="bg-panel border border-line rounded-lg p-5 flex flex-col gap-3">
        <SkeletonBlock className="h-3 w-32" />
        <SkeletonBlock className="h-8 w-2/3" />
        <SkeletonBlock className="h-14 w-full mt-2" />
      </div>
      <div className="bg-panel border border-line rounded-lg p-5">
        <SkeletonBlock className="h-16 w-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-panel border border-line rounded-lg p-4 flex flex-col gap-3">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-2 w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <SkeletonBlock className="h-72 w-full" />
        <SkeletonBlock className="h-72 w-full hidden lg:block" />
      </div>
    </div>
  );
}
