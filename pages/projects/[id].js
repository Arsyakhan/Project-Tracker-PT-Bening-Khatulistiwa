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
import { SYSTEMS, RO_OPTIONS, normalizeSystems, projectSystems, documentExtras, deriveSystemKeys, docReadiness, systemLabel } from '../../lib/systems';
import SpecsEditor from '../../components/SpecsEditor';
import { packSpecs, buildSpecValues, visibleSections, overallProgress, derivedSpecs, withDerived, autoSpecIds, specDiffs, MEASURE_UNIT } from '../../lib/docgen/specs';
import { canDelete, canWrite } from '../../lib/roles';
import TechFlow from '../../components/TechFlow';
import SimilarArchive from '../../components/SimilarArchive';
import NextActionCard from '../../components/NextActionCard';
import PicSelect from '../../components/PicSelect';
import ModulePicker from '../../components/ModulePicker';
import {
  followsRules, deriveStatus, derivePriority, stageForStatus, stageAdvance, RULE_SUMMARY,
} from '../../lib/projectRules';
import {
  TECH_SCHEMA, TECH_DETAIL_MAX, TECH_EXTRA_KEYS, currentTech, writeTech, hasDosingModule,
  projectTechModules, readTech,
  GRID_DETAIL_MAX, gridModules, sameTech, gridTechModules, gridCurrentTech,
} from '../../lib/techflow';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../components/Toast';
import { SkeletonBlock } from '../../components/Skeleton';
import { daysBetween, fmtShort } from '../../lib/meetings';

// Field yang diedit lewat tombol "Simpan Perubahan". Checklist disimpan otomatis & terpisah,
// jadi TIDAK ikut menentukan status "Belum disimpan".
const EDITABLE_FIELDS = [
  'poNumber', 'projectName', 'client', 'technology', 'pic',
  'currentStage', 'status', 'priority',
  'tanggalPO', 'tanggalDP', 'deliveryDate', 'targetFinishDate',
  'remarks',
  'lokasiPlant', 'alamat', 'kontakOwner', 'sistemTerpasang',
  'nextAction', 'nextActionOwner', 'nextActionDue', 'blocker',
];

function pickEditable(p) {
  const out = {};
  EDITABLE_FIELDS.forEach((f) => { out[f] = p?.[f] ?? (f === 'sistemTerpasang' ? [] : ''); });
  return out;
}

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'teknologi', label: 'Teknologi' },
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
  // Kolom yang sedang mengikuti aturan otomatis (lib/projectRules.js). Bukan data tersimpan: saat halaman dimuat,
  // sebuah kolom dianggap otomatis kalau isinya sama dengan hasil aturan, selain itu manual (hanya diberi saran).
  const [auto, setAuto] = useState({ status: true, priority: true });
  const [allPics, setAllPics] = useState([]); // PIC yang sudah dipakai di semua project, untuk pilihan dropdown PIC

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
  // Teknologi project = grid kolom AA-CT di tab Project Tracker (Code.gs v2.8). null = belum dimuat.
  //   mode 'grid'  : { mode, saved (modul tersimpan), work (modul yang sedang diedit), edited, rev }
  //   mode 'legacy': backend belum v2.8, teknologi masih tersimpan di Spesifikasi (kunci tech_*)
  const [tech, setTechState] = useState(null);
  const [techLoading, setTechLoading] = useState(false);
  const [techError, setTechError] = useState(null);
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
      setAuto(followsRules(found));
      setAllPics(projects.map((p) => p.pic).filter(Boolean));
      setInitialSnapshot(JSON.stringify(pickEditable(found)));
      addRecentProject({ id: found.id, poNumber: found.poNumber, projectName: found.projectName });
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [id]);

  // ?tab=checklist (mis. dari halaman Dokumen) membuka tab itu langsung.
  useEffect(() => {
    const t = router.query.tab;
    if (typeof t === 'string' && TABS.some((x) => x.key === t)) setActiveTab(t);
  }, [router.query.tab]);

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
    setTechState(null);
    setTechError(null);
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

  async function loadTech() {
    const current = projectRef.current;
    if (!current?.id) return;
    setTechLoading(true);
    setTechError(null);
    try {
      const res = await api.getTech(current.id);
      if (projectRef.current?.id !== current.id) return; // sudah pindah ke project lain
      const modules = gridModules(res.modules);
      setTechState({ mode: 'grid', saved: modules, work: modules, edited: false, rev: res.rev, schema: res.schema });
    } catch (err) {
      if (projectRef.current?.id !== current.id) return;
      // Backend belum v2.8 (Code.gs/Archive.gs baru belum ditempel): pakai cara lama supaya tab tetap berfungsi.
      if (/Unknown action/i.test(err.message)) setTechState({ mode: 'legacy' });
      else setTechError(err.message);
    } finally {
      setTechLoading(false);
    }
  }

  // Dimuat begitu project yang dibuka sudah tampil (bukan project sebelumnya yang masih tertinggal saat pindah halaman).
  useEffect(() => {
    if (!project?.id || String(project.id) !== String(id) || tech !== null || techLoading || techError) return;
    loadTech();
  }, [project?.id, id, tech, techLoading, techError]);

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

  // Teknologi (grid) yang diedit tapi belum disimpan.
  const techDirty = useMemo(
    () => tech?.mode === 'grid' && tech.edited && !sameTech(tech.work, tech.saved),
    [tech],
  );

  const isDirty = projectDirty || specsDirty || techDirty;

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
    const restored = { ...projectRef.current, ...JSON.parse(initialSnapshot) };
    setProject(restored);
    setAuto(followsRules(restored)); // kembali ke keadaan tersimpan, jangan sampai aturan langsung menimpa lagi
    if (specsSaved) setSpecsValues(specsSaved);
    setTechState((t) => (t?.mode === 'grid' ? { ...t, work: t.saved, edited: false } : t));
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

  // ---- Aturan otomatis Stage / Status / Prioritas (lib/projectRules.js) ----
  // Kolom yang sedang otomatis ikut berubah setiap kali dasarnya berubah: stage, hambatan, tanggal kirim, target selesai.
  // Berjalan di mana pun dasar itu diubah (kartu Info umum, kartu Langkah berikutnya, tab Jadwal).
  useEffect(() => {
    if (!project || !meta) return;
    const patch = {};
    if (auto.status) {
      const s = deriveStatus(project);
      if (s && s.value !== project.status && meta.statuses.includes(s.value)) patch.status = s.value;
    }
    if (auto.priority) {
      const r = derivePriority(project, todayISO());
      if (r.value && r.value !== project.priority && meta.priorities.includes(r.value)) patch.priority = r.value;
    }
    if (Object.keys(patch).length > 0) setProject((p) => ({ ...p, ...patch }));
  }, [auto, meta, project?.currentStage, project?.status, project?.priority, project?.blocker, project?.deliveryDate, project?.targetFinishDate]);

  // PM mengubah Status sendiri: kolom itu jadi manual, dan Completed / buka lagi ikut menyelaraskan Stage.
  function changeStatus(next) {
    const link = stageForStatus(next, projectRef.current?.currentStage);
    setAuto((a) => ({ ...a, status: false }));
    setProject((p) => ({ ...p, status: next, ...(link ? { currentStage: link.stage } : {}) }));
    if (link) showToast(`Stage ikut dipindah ke ${link.stage} (${link.reason}). Tekan Simpan perubahan untuk menyimpan.`, 'info');
  }

  function changePriority(next) {
    setAuto((a) => ({ ...a, priority: false }));
    update('priority', next);
  }

  // Menyalakan lagi "Otomatis" langsung menerapkan hasil aturan (lewat efek di atas).
  function toggleAuto(field, on) {
    setAuto((a) => ({ ...a, [field]: on }));
  }

  // Saran stage dari checklist: dipindahkan hanya atas permintaan PM (tombol), atau otomatis saat PM baru saja
  // menyelesaikan item checklist yang menjadi dasarnya (lihat updateChecklistData).
  function applyStageAdvance(adv) {
    setProject((p) => ({ ...p, currentStage: adv.stage }));
  }

  // Mengubah kolom yang masih nilai otomatis dari Teknologi = koreksi manual. Angka dan satuannya disimpan sepaket,
  // jadi mengubah salah satunya ikut menetapkan pasangannya (supaya tidak bergeser saat Teknologi berubah).
  function updateSpec(fieldId, value) {
    setSpecsValues((v0) => {
      const v = v0 || {};
      const next = { ...v, [fieldId]: value };
      const empty = (id) => !String(v[id] ?? '').trim();
      const unitOf = MEASURE_UNIT[fieldId];
      if (unitOf && specsDerived[fieldId] !== undefined && empty(fieldId) && String(value).trim()) {
        if (specsDerived[unitOf]) next[unitOf] = specsDerived[unitOf];
      }
      const capOf = Object.keys(MEASURE_UNIT).find((k) => MEASURE_UNIT[k] === fieldId);
      if (capOf && specsDerived[capOf] !== undefined && empty(capOf)) next[capOf] = specsDerived[capOf];
      return next;
    });
  }

  async function saveProject() {
    setSaving(true);
    setError(null);
    try {
      // "user" tidak dikirim dari sini: server mengisinya dari sesi login.
      // Teknologi (grid) disimpan lebih dulu: sistem untuk dokumen diturunkan darinya, jadi kalau teknologi ditolak
      // (mis. barisnya diubah orang lain di sheet) tidak ada yang tersimpan setengah-setengah.
      let techSavedNow = null;
      if (techDirty) {
        try {
          const res = await api.saveProjectTech({ projectId: project.id, modules: tech.work, baseRev: tech.rev });
          techSavedNow = gridModules(res.modules);
          setTechState({ mode: 'grid', saved: techSavedNow, work: techSavedNow, edited: false, rev: res.rev, schema: res.schema });
        } catch (err) {
          setError(`Teknologi belum tersimpan: ${err.message}`);
          showToast(`Teknologi gagal disimpan: ${err.message}`, 'error');
          return;
        }
      }
      // Kolom lama "Sistem Terpasang" sekarang hanya menyimpan opsi dokumen; sisa isi lama dibersihkan begitu teknologi tercatat.
      const payloadProject = pickEditable(project);
      let cleanLegacy = false;
      if (techSavedNow && techSavedNow.length > 0) {
        const extras = documentExtras(project);
        if (JSON.stringify(normalizeSystems(project.sistemTerpasang)) !== JSON.stringify(extras)) {
          payloadProject.sistemTerpasang = extras;
          cleanLegacy = true;
        }
      }
      let projectSaved = false;
      if (projectDirty || cleanLegacy) {
        try {
          await api.updateProject({ projectId: project.id, ...payloadProject });
        } catch (err) {
          if (techSavedNow === null) throw err;
          setError(`Teknologi sudah tersimpan, tetapi data project belum: ${err.message}`);
          showToast(`Teknologi tersimpan, data project gagal: ${err.message}`, 'error');
          return;
        }
        projectSaved = true;
      }
      // Spesifikasi: hanya koreksi manual yang disimpan; nilai otomatis dari Teknologi tidak disalin.
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
          if (projectSaved || techSavedNow !== null) await load();
          setError(`Spesifikasi belum tersimpan: ${err.message}`);
          showToast(`Spesifikasi gagal disimpan: ${err.message}`, 'error');
          return;
        }
      }
      showToast('Tersimpan ke spreadsheet.', 'success');
      // Daftar project (yang membawa ringkasan teknologi) dimuat ulang supaya kesiapan dokumen ikut diperbarui.
      if (projectSaved || techSavedNow !== null) await load();
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
        // Item yang baru diselesaikan bisa menjadi bukti project sudah lebih jauh dari stage-nya (mis. Handover Report
        // Completed): stage maju otomatis (tidak pernah mundur) dan tersimpan bersama "Simpan perubahan". Baru
        // dijalankan setelah checklist benar-benar tersimpan, supaya tidak tertinggal kalau penyimpanannya gagal.
        if (statusVal === 'Completed' || statusVal === 'N/A') {
          const now = projectRef.current;
          const adv = now && stageAdvance(now.currentStage, now.checklist?.items);
          if (adv) {
            applyStageAdvance(adv);
            showToast(`Stage dipindah ke ${adv.stage}: ${adv.reason}. Tekan Simpan perubahan untuk menyimpan.`, 'info');
          }
        }
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
        showToast(`Gagal memperbarui checklist: ${err.message}`, 'error');
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
  const writable = canWrite(session?.user?.role || 'admin');
  const canArchive = writable && project.currentStage === 'Hand Over and Finished';
  const targetDays = project.targetFinishDate
    ? Math.round((new Date(`${project.targetFinishDate}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000)
    : null;
  const targetHint =
    targetDays === null ? '' : targetDays < 0 ? `Terlewat ${Math.abs(targetDays)} hari` : targetDays === 0 ? 'Hari ini' : `${targetDays} hari lagi`;
  // Aturan otomatis (lib/projectRules.js): hasil aturan untuk keadaan form sekarang, dan saran stage dari checklist.
  const statusRule = deriveStatus(project);
  const priorityRule = derivePriority(project, today);
  const stageHint = stageAdvance(project.currentStage, checklist?.items);

  // Teknologi yang sedang dibuka di halaman (termasuk yang belum disimpan): sumber sistem, seksi spesifikasi, dan nilai otomatis.
  const gridTech = tech?.mode === 'grid' ? tech : null;
  const techForSystems = gridTech ? (gridTech.edited ? gridTech.work : gridTech.saved) : (readTech(specsValues || {}) || undefined);
  const savedSystems = normalizeSystems(project.sistemTerpasang); // isi kolom lama; di sini hanya untuk opsi dokumen
  const shownSystems = projectSystems(project, techForSystems);
  const filterCount = ['birm', 'mmf', 'acf'].filter((k) => shownSystems.keys.includes(k)).length;
  const readiness = {
    commissioning: docReadiness(project, 'commissioning'),
    handover: docReadiness(project, 'handover'),
  };
  const allMissing = Array.from(new Set([...readiness.commissioning.missing, ...readiness.handover.missing]));
  const specSections = visibleSections(project, techForSystems);
  // Teknologi: dari grid (backend v2.8) atau, kalau backend belum v2.8, dari kunci tech_* di Spesifikasi.
  const flowModules = gridTech
    ? gridTechModules(project, gridTech.edited ? gridTech.work : gridTech.saved, specsValues || {})
    : projectTechModules(project, specsValues || {});
  const techValue = gridTech
    ? (gridTech.edited ? gridTech.work : gridCurrentTech(project, gridTech.saved, specsValues || {}))
    : currentTech(project, specsValues || {});
  // Modul yang bisa dicentang: yang kolomnya ada di sheet (backend v2.8 mengirim `schema`); tanpa itu semua modul web.
  const pickerSchema = gridTech && Array.isArray(gridTech.schema) ? TECH_SCHEMA.filter((s) => gridTech.schema.includes(s.key)) : TECH_SCHEMA;
  const techSaved = gridTech ? (gridTech.edited || gridTech.saved.length > 0) : !!readTech(specsValues || {});
  // Tab Teknologi menunggu teknologi (dan spesifikasi, untuk isi awal dari data lama) selesai dimuat.
  const techTabLoading = (specsLoading && specsValues === null) || (techLoading && tech === null) || (tech === null && !techError);
  const techTabError = techError || specsError;
  // Spesifikasi Peralatan: nilai otomatis dari Teknologi (kapasitas + Detail Spesifikasi) mengisi kolom yang belum dikoreksi manual.
  const specsDerived = techForSystems && techForSystems.length > 0 ? derivedSpecs(techForSystems) : {};
  const shownSpecs = specsValues ? withDerived(specsValues, specsDerived) : null;
  const autoIds = specsValues ? autoSpecIds(specsValues, specsDerived) : new Set();
  // Koreksi manual yang isinya lain dari Teknologi: ditandai di tab Spesifikasi (specsValues = isian manual saja).
  const specDiff = specsValues ? specDiffs(specSections, specsValues, specsDerived) : null;
  // Untuk tombol "+ Tambah peralatan": modul yang sudah dicentang, dan yang dicentang tetapi belum tersimpan.
  const tickedKeys = new Set((techValue || []).map((m) => m.key));
  const savedTechKeys = new Set(((gridTech ? gridTech.saved : readTech(specsSaved || {})) || []).map((m) => m.key));
  const pendingTechKeys = new Set([...tickedKeys].filter((k) => !savedTechKeys.has(k)));
  const specProgress = shownSpecs ? overallProgress(specSections, shownSpecs) : null;
  const commPercent = Math.round(((4 - readiness.commissioning.missing.length) / 4) * 100);

  function retryTech() {
    if (techError) loadTech();
    if (specsError) loadSpecs();
  }

  // Opsi dokumen (CIP/dosing terpisah, tangki antara, panel, RO besar, recycle): disimpan di kolom lama "Sistem Terpasang".
  function toggleSystem(key) {
    const cur = savedSystems;
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    update('sistemTerpasang', normalizeSystems(next));
  }

  // Ubah teknologi: modulnya ditahan sebagai perubahan yang belum disimpan (grid; di mode lama di Spesifikasi, tech_*).
  // Sistem untuk dokumen dan nilai Spesifikasi otomatis ikut dihitung dari situ (tidak ada data kedua yang perlu disamakan).
  function setTech(modules) {
    if (gridTech) { setTechState((t) => ({ ...t, work: modules, edited: true })); return; }
    // Mode lama (backend belum v2.8, daftar project belum membawa teknologi): dokumen masih membaca kolom
    // "Sistem Terpasang", jadi diturunkan dan ditulis seperti dulu.
    const prevDosing = hasDosingModule(techValue);
    const extras = savedSystems.filter((k) => TECH_EXTRA_KEYS.includes(k) && !(k === 'dosing' && prevDosing));
    setSpecsValues((v) => ({ ...(v || {}), ...writeTech(modules) }));
    update('sistemTerpasang', normalizeSystems(deriveSystemKeys(modules, extras)));
  }

  // Tombol "+ Tambah peralatan" di tab Spesifikasi: mencentang satu modul di Teknologi (urutan mengikuti alur, sama seperti
  // ModulePicker). Ikut "Simpan perubahan"; seksi barunya langsung muncul karena Spesifikasi membaca Teknologi yang belum tersimpan.
  function addTechModule(key) {
    if (!writable) return;
    const cur = techValue || [];
    if (cur.some((m) => m.key === key)) return;
    const byKey = Object.fromEntries(cur.map((m) => [m.key, m]));
    byKey[key] = { key, cap: '', unit: '', detail: '' };
    const ordered = pickerSchema.filter((s) => byKey[s.key]).map((s) => byKey[s.key]);
    const rest = cur.filter((m) => !pickerSchema.some((s) => s.key === m.key)); // modul yang tak dikenal tidak dibuang
    setTech([...ordered, ...rest]);
  }

  // "Pakai nilai Teknologi": kolom yang dikoreksi dikembalikan ke otomatis (angka dikosongkan, satuan disamakan).
  function resetSpecDiff(diff) {
    setSpecsValues((v) => ({ ...(v || {}), ...diff.set }));
  }

  const dateWarnings = [];
  if (project.tanggalPO && project.tanggalDP && project.tanggalDP < project.tanggalPO) dateWarnings.push('Tanggal DP lebih awal dari Tanggal PO.');
  if (project.tanggalPO && project.deliveryDate && project.deliveryDate < project.tanggalPO) dateWarnings.push('Tanggal kirim lebih awal dari Tanggal PO.');
  if (project.tanggalDP && project.deliveryDate && project.deliveryDate < project.tanggalDP) dateWarnings.push('Tanggal kirim lebih awal dari Tanggal DP.');

  const scheduleEvents = [
    { label: 'Tanggal PO', date: project.tanggalPO },
    { label: 'Tanggal DP', date: project.tanggalDP },
    { label: 'Tanggal kirim', date: project.deliveryDate },
    { label: 'Target selesai', date: project.targetFinishDate },
  ];

  return (
    <div className="flex flex-col gap-5 pb-28">
      <Head>
        <title>{project.projectName ? `${project.projectName} — Bening Hub` : 'Detail Project — Bening Hub'}</title>
      </Head>

      {/* Jejak navigasi */}
      <nav aria-label="Jejak navigasi" className="flex items-center gap-1.5 text-xs text-inkmute min-w-0 -mb-1">
        <Link href="/projects" className="tap hover:text-blueprint transition-colors">Project</Link>
        <span aria-hidden="true" className="text-line">/</span>
        <span aria-current="page" className="font-data truncate">{project.poNumber || 'Tanpa PO'}</span>
      </nav>

      {/* Kepala halaman: satu "title block" gambar teknik. Identitas project, jalur tahapan, dan angka kunci di satu panel. */}
      <header className="bg-panel border border-line rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 sm:px-6 pt-5 pb-4 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="text-xs font-data text-inkmute bg-transparent rounded border border-transparent hover:border-line focus:border-blueprint outline-none max-w-full px-1.5 py-0.5 -ml-1.5 max-md:py-2 max-md:text-sm transition-colors"
              value={project.poNumber}
              size={Math.max(10, String(project.poNumber || '').length + 1)}
              onChange={(e) => update('poNumber', e.target.value)}
              title="Klik untuk mengedit PO Number"
              aria-label="PO Number"
            />
            <StatusBadge status={project.status} />
            <PriorityBadge priority={project.priority} />
            {project.blocker && <Pill tone="rust" dot>Terhambat</Pill>}
            {isDirty && <Pill tone="amber" dot>Belum disimpan</Pill>}
          </div>
          <h1 className="sr-only">{project.projectName || 'Detail project'}</h1>
          <AutoGrowTitle value={project.projectName} onChange={(v) => update('projectName', v)} />
          <p className="text-sm text-inkmute -mt-1">
            {[project.client, project.lokasiPlant, project.technology].filter(Boolean).join(' · ') || 'Client dan lokasi belum diisi'}
          </p>
          {flowModules.length > 0 ? (
            <div className="flex flex-col gap-1.5 pt-2">
              <TechFlow modules={flowModules} />
              {(shownSystems.detected || !techSaved) && (
                <span className="text-xs text-inkmute">
                  {shownSystems.detected ? 'Terdeteksi otomatis dari nama project, belum disimpan.' : 'Dibaca dari data lama (kolom Sistem Terpasang dan spesifikasi).'}
                  {writable && <> <button type="button" onClick={() => setActiveTab('teknologi')} className="tap font-medium text-blueprint hover:underline">Lengkapi di tab Teknologi</button></>}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-inkmute pt-1">
              Teknologi belum dicatat.{' '}
              {writable && <button type="button" onClick={() => setActiveTab('teknologi')} className="tap font-medium text-blueprint hover:underline">Susun alur teknologi</button>}
            </p>
          )}
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-line bg-canvas/40">
          <StagePipeline
            current={project.currentStage}
            weights={meta.stageWeights}
            onSelect={(stage) => update('currentStage', stage)}
          />
        </div>

        <dl className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 border-t border-line" style={{ gap: 1, background: 'rgb(var(--color-line))' }}>
          <TitleCell label="PIC" value={project.pic} />
          <TitleCell label="Tanggal PO" value={project.tanggalPO ? fmtDate(project.tanggalPO) : ''} />
          <TitleCell label="Tanggal kirim" value={project.deliveryDate ? fmtDate(project.deliveryDate) : ''} extra={<DeliveryHint p={project} />} />
          <TitleCell
            label="Target selesai"
            value={project.targetFinishDate ? fmtDate(project.targetFinishDate) : ''}
            extra={project.targetFinishDate ? (
              <span className={`text-xs ${targetDays < 0 ? 'text-rust font-medium' : 'text-inkmute'}`}>{targetHint}</span>
            ) : (
              <button type="button" onClick={() => setActiveTab('jadwal')} className="tap text-xs font-medium text-blueprint hover:underline">Atur</button>
            )}
          />
          <MeterCell
            label="Progres tahapan"
            value={meta.stageWeights[project.currentStage] ?? project.stageProgress}
            sub={project.currentStage}
          />
          <MeterCell
            label="Dokumen engineering"
            value={checklist?.progress ?? project.engineeringDocProgress}
            sub={`${doneCount} dari ${applicable.length} selesai${reviewCount > 0 ? `, ${reviewCount} direview` : ''}`}
            onClick={() => setActiveTab('checklist')}
          />
        </dl>
      </header>

      {/* Hal yang perlu diperhatikan: hambatan, catatan, dan tawaran arsip */}
      {(project.blocker || hasRemarks || canArchive) && (
        <div className="flex flex-col gap-3">
          {project.blocker && (
            <div role="status" className="flex gap-3 bg-panel border border-line border-l-4 border-l-rust rounded-xl px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-rust">
                  Terhambat{project.blockedSince ? ` sejak ${fmtShort(project.blockedSince)} (${Math.max(daysBetween(project.blockedSince, todayISO()) ?? 0, 0)} hari)` : ''}
                </p>
                <p className="text-sm text-ink mt-0.5 break-words">Menunggu: {project.blocker}</p>
              </div>
            </div>
          )}
          {hasRemarks && (
            <div className="flex gap-3 bg-panel border border-line border-l-4 border-l-amber rounded-xl px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amberink">Catatan project</p>
                <p className="text-sm text-ink whitespace-pre-wrap break-words mt-0.5">{project.remarks}</p>
              </div>
            </div>
          )}
          {canArchive && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-panel border border-line border-l-4 border-l-teal rounded-xl px-4 py-3 shadow-sm">
              <p className="text-sm text-ink flex-1">
                <b className="font-semibold">Project ini sudah selesai.</b> Catat teknologinya ke arsip sebagai acuan untuk project berikutnya. Alur dan kapasitas terisi otomatis dari data project.
              </p>
              <Link href={`/arsip/new?from=${encodeURIComponent(project.id)}`} className="btn btn-secondary whitespace-nowrap">Arsipkan teknologi</Link>
            </div>
          )}
        </div>
      )}

      <NextActionCard project={project} writable={writable} update={update} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] items-start">
        {/* ===== Kolom utama ===== */}
        <div className="flex flex-col gap-5 min-w-0">
          <div className="sticky top-[57px] md:top-0 z-10 -mx-1 px-1 py-2 bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
            <div role="tablist" aria-label="Bagian project" className="flex w-full max-w-full items-center gap-0.5 p-0.5 rounded-lg bg-line/50 border border-line overflow-x-auto">
              {TABS.map((tab) => {
                const on = activeTab === tab.key;
                const badge =
                  tab.key === 'spesifikasi' && specProgress && specSections.length > 0 ? `${specProgress.percent}%`
                  : tab.key === 'checklist' ? `${checklist?.progress ?? 0}%`
                  : tab.key === 'komentar' && comments && comments.length > 0 ? comments.length
                  : null;
                return (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={on}
                    onClick={() => setActiveTab(tab.key)}
                    className={`h-9 max-md:h-10 px-3.5 inline-flex items-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                      on ? 'bg-panel text-ink shadow-sm' : 'text-inkmute hover:text-ink'
                    }`}
                  >
                    {tab.label}
                    {badge !== null && <span className={`font-data tnum text-xs ${on ? 'text-blueprint' : 'text-inkmute'}`}>{badge}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === 'ringkasan' && (
            <>
            <Panel title="Info umum" hint="Perubahan baru tersimpan setelah menekan Simpan perubahan. Status dan Prioritas mengikuti aturan otomatis dan tetap dapat diubah manual.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <FieldBlock id="info-stage" label="Stage saat ini">
                  <select id="info-stage" className="input" value={project.currentStage} onChange={(e) => update('currentStage', e.target.value)}>
                    {meta.stages.map((s) => <option key={s} value={s}>{s} ({meta.stageWeights[s]}%)</option>)}
                  </select>
                  {stageHint && writable && (
                    <p data-testid="stage-hint" className="text-xs text-amberink flex flex-wrap items-center gap-x-2">
                      <span>Saran: pindah ke <b className="font-medium">{stageHint.stage}</b> ({stageHint.reason}).</span>
                      <button type="button" onClick={() => applyStageAdvance(stageHint)} className="tap font-medium text-blueprint hover:underline">Pindahkan</button>
                    </p>
                  )}
                </FieldBlock>
                <FieldBlock
                  id="info-status"
                  label="Status"
                  aside={statusRule && (
                    <AutoToggle checked={auto.status} disabled={!writable} onChange={(on) => toggleAuto('status', on)} />
                  )}
                >
                  <select id="info-status" className="input" value={project.status} aria-describedby="info-status-note" onChange={(e) => changeStatus(e.target.value)}>
                    {meta.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <RuleNote
                    id="info-status-note"
                    testId="status-note"
                    auto={auto.status}
                    rule={statusRule}
                    current={project.status}
                    canApply={writable}
                    onApply={() => toggleAuto('status', true)}
                    noRule="Stage ini tidak dikenal aturan, jadi status diatur manual."
                  />
                </FieldBlock>
                <FieldBlock
                  id="info-priority"
                  label="Prioritas"
                  aside={priorityRule.value && (
                    <AutoToggle checked={auto.priority} disabled={!writable} onChange={(on) => toggleAuto('priority', on)} />
                  )}
                >
                  <select id="info-priority" className="input" value={project.priority} aria-describedby="info-priority-note" onChange={(e) => changePriority(e.target.value)}>
                    {meta.priorities.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <RuleNote
                    id="info-priority-note"
                    testId="priority-note"
                    auto={auto.priority}
                    rule={priorityRule.value ? priorityRule : null}
                    current={project.priority}
                    canApply={writable}
                    onApply={() => toggleAuto('priority', true)}
                    noRule=""
                  />
                </FieldBlock>
                <Row label="PIC">
                  <PicSelect value={project.pic} existing={allPics} onChange={(v) => update('pic', v)} />
                </Row>
                <Row label="Client">
                  <input className="input" value={project.client || ''} onChange={(e) => update('client', e.target.value)} />
                </Row>
                <Row label="Bentuk Project">
                  <input className="input" placeholder="ex: Skid, Plant, Retrofit" value={project.technology || ''} onChange={(e) => update('technology', e.target.value)} />
                </Row>
              </div>
              <details data-testid="rules-details" className="text-sm">
                <summary className="tap cursor-pointer select-none w-fit font-medium text-blueprint hover:underline">Lihat aturan otomatis</summary>
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  {RULE_SUMMARY.map((g) => (
                    <div key={g.title} className="min-w-0">
                      <h3 className="font-medium text-ink">{g.title}</h3>
                      <ul className="mt-1 list-disc pl-4 space-y-1 text-xs text-inkmute">
                        {g.lines.map((l) => <li key={l} className="break-words">{l}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
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

            {canDeleteProject && (
              <details className="group rounded-xl border border-rust/30 bg-panel">
                <summary className="cursor-pointer select-none list-none px-4 py-3 text-sm font-medium text-rust flex items-center justify-between">
                  Hapus project
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
                    className="text-sm font-medium text-rust border border-rust/40 hover:bg-rust/10 rounded-md px-3 h-9 max-md:h-10 disabled:opacity-60 transition-colors whitespace-nowrap"
                  >
                    Hapus project...
                  </button>
                </div>
              </details>
            )}
            </>
          )}

          {activeTab === 'teknologi' && (
            <div className="flex flex-col gap-4">
              {techTabLoading ? (
                <Panel title="Teknologi"><p className="text-sm text-inkmute">Memuat...</p></Panel>
              ) : techTabError ? (
                <Panel title="Teknologi">
                  <p className="text-sm text-rust">Gagal memuat data teknologi: {techTabError}</p>
                  <button type="button" onClick={retryTech} className="tap w-fit text-sm font-medium text-blueprint hover:underline">Coba lagi</button>
                </Panel>
              ) : (
                <>
                  <Panel
                    title="Alur teknologi"
                    hint={gridTech
                      ? 'Urut dari air baku sampai air produk, sama dengan data arsip project selesai. Tersimpan di tab Project Tracker (grid kolom Spesifikasi Teknologi), jadi bisa juga diisi dari spreadsheet. Sistem untuk dokumen, kapasitas, dan Spesifikasi Peralatan (Hand Over) diambil dari sini.'
                      : 'Urut dari air baku sampai air produk, sama dengan data arsip project selesai. Sistem untuk dokumen dan kapasitas di Spesifikasi Peralatan diambil dari sini.'}
                  >
                    {!techSaved && techValue.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-blueprint/10 border border-blueprint/25 rounded-md px-3 py-2 text-sm">
                        <span className="text-ink">Terisi dari data lama (kolom Sistem Terpasang dan spesifikasi). Belum tersimpan sebagai teknologi.</span>
                        {writable && <button type="button" onClick={() => setTech(techValue)} className="tap text-sm font-medium text-blueprint hover:underline">Pakai data ini</button>}
                      </div>
                    )}
                    <TechFlow modules={techValue.map((m) => ({ ...m, label: (TECH_SCHEMA.find((x) => x.key === m.key) || {}).label }))} emptyText="Centang modul di bawah untuk menyusun alurnya." />
                  </Panel>

                  <ModulePicker schema={pickerSchema} value={techValue} onChange={setTech} detailMax={gridTech ? GRID_DETAIL_MAX : TECH_DETAIL_MAX} disabled={!writable} specHelp />

                  <Panel title="Opsi dokumen" hint="Hanya untuk dokumen Commissioning dan Hand Over. Tidak masuk alur teknologi.">
                    <div className="flex flex-wrap gap-2">
                      {SYSTEMS.filter((x) => TECH_EXTRA_KEYS.includes(x.key)).concat(RO_OPTIONS.filter(() => shownSystems.keys.includes('ro'))).map((opt) => {
                        const derived = opt.key === 'dosing' && hasDosingModule(techValue);
                        const checked = derived || savedSystems.includes(opt.key);
                        return (
                          <label
                            key={opt.key}
                            className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${derived || !writable ? 'opacity-70' : 'cursor-pointer'} ${checked ? 'border-blueprint/50 bg-blueprint/10 text-ink' : 'border-line text-ink hover:border-blueprint/40'}`}
                          >
                            <input type="checkbox" className="w-4 h-4 accent-blueprint" checked={checked} disabled={derived || !writable} onChange={() => toggleSystem(opt.key)} />
                            {opt.key === 'dosing' ? 'Chemical Dosing / CIP terpisah' : opt.label}
                            {derived && <span className="text-xs text-inkmute">otomatis dari pompa dosing</span>}
                          </label>
                        );
                      })}
                    </div>
                    {filterCount > 2 && (
                      <p className="text-xs text-amberink">Template Hand Over hanya punya 2 slot filter. Filter ketiga perlu dicatat manual di "Item Tambahan".</p>
                    )}
                  </Panel>

                  {flowModules.length > 0 && <SimilarArchive modules={flowModules} />}
                </>
              )}
            </div>
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
                <Row label="Tanggal kirim">
                  <input type="date" className="input" value={project.deliveryDate || ''} onChange={(e) => update('deliveryDate', e.target.value)} />
                </Row>
                <Row label="Target selesai">
                  <input type="date" className="input" value={project.targetFinishDate || ''} onChange={(e) => update('targetFinishDate', e.target.value)} />
                </Row>
              </div>
              <Row label="Catatan (kendala, menunggu material, dll.)">
                <textarea className="input" rows={3} value={project.remarks || ''} onChange={(e) => update('remarks', e.target.value)} />
              </Row>
            </Panel>
          )}

          {activeTab === 'spesifikasi' && (
            <SpecsEditor
              sections={specSections}
              values={shownSpecs}
              autoIds={autoIds}
              onChange={updateSpec}
              loading={specsLoading && specsValues === null}
              error={specsError}
              onRetry={loadSpecs}
              onGoTech={() => setActiveTab('teknologi')}
              version={specsVersion}
              diffs={specDiff}
              onResetDiff={resetSpecDiff}
              canEdit={writable}
              addSchema={pickerSchema}
              ticked={tickedKeys}
              pending={pendingTechKeys}
              onAddModule={tech !== null && !techError ? addTechModule : undefined}
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
                        onInvalid={() => showToast('Tautan harus diawali http:// atau https://', 'error')}
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
                  <span className="text-xs text-inkmute tnum">{commentDraft.length}/{COMMENT_MAX_LENGTH}</span>
                  <button
                    onClick={submitComment}
                    disabled={postingComment || !commentDraft.trim()}
                    className="bg-blueprint hover:bg-blueprintdark text-onaccent rounded-md px-4 h-9 max-md:h-10 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {postingComment ? 'Mengirim...' : 'Kirim komentar'}
                  </button>
                </div>
              </div>
            </Panel>
          )}
        </div>

        {/* ===== Kolom samping ===== */}
        <aside className="flex flex-col gap-4 min-w-0 lg:sticky lg:top-6">
          <section className="bg-panel border border-line rounded-xl p-4 shadow-sm">
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
                  <button onClick={() => setActiveTab('ringkasan')} className="tap text-xs text-amberink hover:underline mt-1.5 text-left">
                    Kurang: {readiness.commissioning.missing.join(', ')}
                  </button>
                ) : (
                  <p className="text-xs text-teal mt-1.5">Data lengkap, dokumen siap dibuat</p>
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
                <button onClick={() => setActiveTab(specSections.length > 0 ? 'spesifikasi' : 'teknologi')} className="tap text-xs text-blueprint hover:underline mt-1.5 text-left">
                  {specSections.length === 0 ? 'Teknologi belum diisi' : specProgress && specProgress.percent >= 100 ? 'Spesifikasi lengkap' : 'Lengkapi spesifikasi peralatan'}
                </button>
              </div>
            </div>
          </section>

          <section className="bg-panel border border-line rounded-xl p-4 shadow-sm">
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
            <section className="bg-panel border border-line rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-ink">Status dokumen</h2>
                <button onClick={() => setActiveTab('checklist')} className="tap text-xs font-medium text-blueprint hover:underline">Kelola</button>
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
                        <a href={link} target="_blank" rel="noopener noreferrer" className="tap text-blueprint hover:underline shrink-0">Buka</a>
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

      {/* Bar simpan: hanya muncul kalau ada perubahan, sedang menyimpan, atau ada galat (tidak memakan layar HP saat tak perlu) */}
      {(isDirty || saving || error) && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 z-20 bg-panel/95 backdrop-blur border-t border-line shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-6xl mx-auto px-5 md:px-10 py-3 flex items-center gap-3">
            <button
              onClick={saveProject}
              disabled={saving || deleting || !isDirty}
              className="bg-blueprint hover:bg-blueprintdark text-onaccent rounded-md px-4 h-10 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Menyimpan...' : 'Simpan perubahan'}
            </button>
            {isDirty && !saving && (
              <button
                onClick={discardChanges}
                className="text-sm font-medium text-inkmute hover:text-ink px-3 h-10"
              >
                Batalkan
              </button>
            )}
            {isDirty && (
              <span className="hidden sm:inline text-xs text-inkmute">Perubahan belum disimpan · Ctrl+S untuk menyimpan</span>
            )}
            {error && <span role="alert" className="text-rust text-sm min-w-0 line-clamp-2">{error}</span>}
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Hapus project ini?"
        description={`Tindakan ini tidak bisa dibatalkan. Data project "${project.projectName}" (PO: ${project.poNumber}) akan dihapus permanen dari spreadsheet.`}
        confirmText={deleting ? 'Menghapus...' : 'Hapus permanen'}
        requireText={project.projectName}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <ConfirmModal
        open={leaveModalOpen}
        title="Ada perubahan belum disimpan"
        description={'Perubahan yang belum disimpan akan hilang jika Anda meninggalkan halaman ini.'}
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
    <div className={`bg-panel px-5 py-3.5 min-w-0 ${className}`}>
      <dt className="text-xs text-inkmute">{label}</dt>
      <dd className="mt-1 flex items-center gap-2 flex-wrap min-h-[24px]">
        <span className={`text-sm font-medium truncate max-w-full ${value ? 'text-ink' : 'text-inkmute'}`} title={value || ''}>{value || 'Belum diisi'}</span>
        {extra}
      </dd>
    </div>
  );
}

// Sel angka dengan batang progres kecil; bisa diklik (mis. membuka tab Checklist).
function MeterCell({ label, value, sub, onClick }) {
  const v = Number(value) || 0;
  const body = (
    <>
      <span className="block text-xs text-inkmute truncate">{label}</span>
      <span className="mt-1 flex items-center gap-2.5 min-h-[24px]">
        <span className="font-data tnum text-sm font-semibold text-ink">{v}%</span>
        <span className="flex-1 h-1.5 rounded-full bg-line/70 overflow-hidden" aria-hidden="true">
          <span className={`block h-full rounded-full ${v >= 100 ? 'bg-teal' : 'bg-blueprint'}`} style={{ width: `${Math.min(v, 100)}%` }} />
        </span>
      </span>
      {sub && <span className="block text-xs text-inkmute truncate mt-1">{sub}</span>}
    </>
  );
  const cls = 'bg-panel px-5 py-3.5 min-w-0 text-left';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} flex flex-col justify-start hover:bg-canvas transition-colors`} aria-label={`${label} ${v}%. Buka checklist`}>{body}</button>
    );
  }
  return <div className={cls}>{body}</div>;
}

function Panel({ title, hint, aside, children }) {
  return (
    <section className="bg-panel border border-line rounded-xl p-5 flex flex-col gap-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
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

// Baris isian dengan label di kiri dan kontrol tambahan (mis. kotak "Otomatis") di kanan label. Label dikaitkan lewat
// htmlFor, bukan membungkus isian, karena isi baris ini boleh memuat tombol.
function FieldBlock({ id, label, aside, children }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm min-w-0">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-inkmute font-medium">{label}</label>
        {aside}
      </div>
      {children}
    </div>
  );
}

function AutoToggle({ checked, disabled, onChange }) {
  return (
    <label className="tap inline-flex items-center gap-1.5 text-xs text-inkmute cursor-pointer select-none">
      <input type="checkbox" className="w-4 h-4 accent-blueprint" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      Otomatis
    </label>
  );
}

// Keterangan di bawah Status / Prioritas: alasan aturan kalau sedang otomatis; kalau manual, saran aturan (bila beda).
function RuleNote({ id, testId, auto, rule, current, canApply, onApply, noRule }) {
  if (!rule) return noRule ? <p id={id} data-testid={testId} className="text-xs text-inkmute">{noRule}</p> : <span id={id} />;
  if (auto) return <p id={id} data-testid={testId} className="text-xs text-inkmute">Otomatis: {rule.reason}.</p>;
  const differs = rule.value !== current;
  return (
    <p id={id} data-testid={testId} className="text-xs text-inkmute flex flex-wrap items-center gap-x-2">
      <span>
        Diatur manual.
        {differs && <> Aturan menyarankan <b className="font-medium text-ink">{rule.value}</b> ({rule.reason}).</>}
      </span>
      {differs && canApply && <button type="button" onClick={onApply} className="tap font-medium text-blueprint hover:underline">Pakai saran</button>}
    </p>
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
