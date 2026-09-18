import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { api } from '../../lib/api';
import StageGauge from '../../components/StageGauge';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../components/Toast';

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'jadwal', label: 'Jadwal' },
  { key: 'deskripsi', label: 'Deskripsi Teknis' },
  { key: 'checklist', label: 'Checklist Engineering' },
];

export default function ProjectDetailPage() {
  const router = useRouter();
  const { po } = router.query;
  const { data: session } = useSession();
  const { showToast } = useToast();

  const [meta, setMeta] = useState(null);
  const [project, setProject] = useState(null);
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('ringkasan');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  async function load() {
    if (!po) return;
    try {
      const [m, projects] = await Promise.all([api.getMeta(), api.getProjects()]);
      setMeta(m);
      const found = projects.find((p) => String(p.poNumber) === String(po));
      if (!found) { setError('Project tidak ditemukan.'); return; }
      setProject(found);
      setInitialSnapshot(JSON.stringify(found));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [po]);

  const isDirty = useMemo(() => {
    if (!project || !initialSnapshot) return false;
    return JSON.stringify(project) !== initialSnapshot;
  }, [project, initialSnapshot]);

  function update(field, value) {
    setProject((p) => ({ ...p, [field]: value }));
  }

  async function saveProject() {
    setSaving(true);
    setError(null);
    try {
      await api.updateProject({
        poNumber: po,
        newPoNumber: project.poNumber,
        projectName: project.projectName,
        client: project.client,
        technology: project.technology,
        pic: project.pic,
        currentStage: project.currentStage,
        status: project.status,
        priority: project.priority,
        remarks: project.remarks,
        deskripsiPesanan: project.deskripsiPesanan,
        spesifikasiTeknologi: project.spesifikasiTeknologi,
        tanggalPO: project.tanggalPO,
        tanggalDP: project.tanggalDP,
        deliveryDate: project.deliveryDate,
        targetFinishDate: project.targetFinishDate,
        user: session?.user?.email
      });
      showToast('Tersimpan ke spreadsheet.', 'success');
      if (po !== project.poNumber) {
        router.replace(`/projects/${encodeURIComponent(project.poNumber)}`);
      } else {
        await load();
      }
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
    try {
      await api.deleteProject({ poNumber: project.poNumber, user: session?.user?.email });
      router.push('/');
    } catch (err) {
      setError(err.message);
      showToast(`Gagal menghapus: ${err.message}`, 'error');
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  }

  async function updateChecklistData(item, statusVal, linkVal) {
    const newItems = { ...project.checklist.items, [item]: statusVal };
    const newLinks = { ...project.checklist.links, [item]: linkVal };
    setProject((p) => ({ ...p, checklist: { ...p.checklist, items: newItems, links: newLinks } }));
    try {
      const result = await api.updateChecklist({ poNumber: project.poNumber, items: { [item]: statusVal }, links: { [item]: linkVal }, user: session?.user?.email });
      setProject((p) => ({ ...p, engineeringDocProgress: result.progress, checklist: { ...p.checklist, progress: result.progress } }));
      setInitialSnapshot((snap) => {
        // sinkronkan snapshot supaya checklist (auto-save) tidak dianggap "belum disimpan"
        const parsed = JSON.parse(snap);
        parsed.checklist = { ...parsed.checklist, items: newItems, links: newLinks, progress: result.progress };
        parsed.engineeringDocProgress = result.progress;
        return JSON.stringify(parsed);
      });
    } catch (err) {
      setError(err.message);
      showToast(`Gagal update checklist: ${err.message}`, 'error');
    }
  }

  if (error && !project) return <div className="text-rust">{error}</div>;
  if (!project || !meta) return <div className="text-inkmute">Memuat...</div>;

  return (
    <div className="flex flex-col gap-6 max-w-3xl pb-24">
      <Head>
        <title>{project.projectName ? `${project.projectName} — Project Tracker` : 'Detail Project — Project Tracker'}</title>
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

      {activeTab === 'checklist' && project.checklist && (
        <section className="bg-panel border border-line rounded-lg p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-ink">Engineering Deliverables Checklist</h2>
            <span className="font-data text-sm text-blueprint font-medium">{project.checklist.progress}%</span>
          </div>
          <StageGauge progress={project.checklist.progress} showLabel={false} compact />
          <p className="text-xs text-inkmute -mt-2">Perubahan checklist tersimpan otomatis, tidak perlu klik "Simpan Perubahan".</p>
          <div className="grid grid-cols-1 gap-4 mt-2">
            {meta.checklistItems.map((item) => {
              const status = project.checklist.items[item] || 'Not Started';
              return (
                <Row key={item} label={item}>
                  <div className="flex gap-3 items-center">
                    <ChecklistStatusIcon status={status} />
                    <select
                      className="input w-1/3"
                      value={status}
                      onChange={(e) => updateChecklistData(item, e.target.value, project.checklist.links?.[item] || '')}
                    >
                      {meta.checklistStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input
                      type="url"
                      placeholder="URL Dokumen / Drive Link..."
                      className="input flex-1"
                      value={project.checklist.links?.[item] || ''}
                      onChange={(e) => updateChecklistData(item, project.checklist.items[item], e.target.value)}
                    />
                  </div>
                </Row>
              );
            })}
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
