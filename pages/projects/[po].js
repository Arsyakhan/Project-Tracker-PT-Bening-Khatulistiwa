import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { api } from '../../lib/api';
import StageGauge from '../../components/StageGauge';

export default function ProjectDetailPage() {
  const router = useRouter();
  const { po } = router.query;

  const [meta, setMeta] = useState(null);
  const [project, setProject] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState(null);

  async function load() {
    if (!po) return;
    try {
      const [m, projects] = await Promise.all([api.getMeta(), api.getProjects()]);
      setMeta(m);
      const found = projects.find((p) => String(p.poNumber) === String(po));
      if (!found) { setError('Project tidak ditemukan.'); return; }
      setProject(found);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [po]);

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
        targetFinishDate: project.targetFinishDate
      });
      setSavedMsg('Tersimpan ke spreadsheet.');
      if (po !== project.poNumber) {
        router.replace(`/projects/${encodeURIComponent(project.poNumber)}`);
      } else {
        await load();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(''), 2500);
    }
  }

  async function handleDelete() {
    const confirmDelete = window.confirm(`Yakin ingin menghapus project ${project.projectName} (PO: ${project.poNumber})?`);
    if (!confirmDelete) return;

    setDeleting(true);
    setError(null);
    try {
      await api.deleteProject({ poNumber: project.poNumber });
      router.push('/');
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  async function updateChecklistData(item, statusVal, linkVal) {
    const newItems = { ...project.checklist.items, [item]: statusVal };
    const newLinks = { ...project.checklist.links, [item]: linkVal };
    setProject((p) => ({ ...p, checklist: { ...p.checklist, items: newItems, links: newLinks } }));
    try {
      const result = await api.updateChecklist({ poNumber: project.poNumber, items: { [item]: statusVal }, links: { [item]: linkVal } });
      setProject((p) => ({ ...p, engineeringDocProgress: result.progress, checklist: { ...p.checklist, progress: result.progress } }));
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <div className="text-rust">{error}</div>;
  if (!project || !meta) return <div className="text-inkmute">Memuat...</div>;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex flex-col gap-1">
        <input 
          className="text-xs font-data text-inkmute bg-transparent border-b border-dashed border-transparent hover:border-line focus:border-blueprint outline-none w-fit pb-1 transition-colors" 
          value={project.poNumber} 
          onChange={(e) => update('poNumber', e.target.value)} 
          title="Klik untuk mengedit PO Number"
        />
        <input 
          className="font-display text-2xl font-semibold text-ink bg-transparent border-b-2 border-transparent hover:border-line focus:border-blueprint outline-none w-full pb-1 transition-colors" 
          value={project.projectName} 
          onChange={(e) => update('projectName', e.target.value)} 
          title="Klik untuk mengedit nama project"
        />
      </div>

      <section className="bg-panel border border-line rounded-lg p-6 flex flex-col gap-4">
        <h2 className="font-display font-semibold text-ink">Progress Tahapan</h2>
        <StageGauge progress={project.stageProgress} />

        <div className="grid grid-cols-2 gap-4 mt-2">
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
          <textarea className="input" rows={2} value={project.remarks || ''} onChange={(e) => update('remarks', e.target.value)} />
        </Row>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-line pt-4 mt-2">
          <Row label="Deskripsi Pesanan (Teknologi)">
            <textarea className="input" rows={4} value={project.deskripsiPesanan || ''} onChange={(e) => update('deskripsiPesanan', e.target.value)} />
          </Row>
          <Row label="Spesifikasi & Detail Teknologi">
            <textarea className="input" rows={4} value={project.spesifikasiTeknologi || ''} onChange={(e) => update('spesifikasiTeknologi', e.target.value)} />
          </Row>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <button onClick={saveProject} disabled={saving || deleting} className="bg-blueprint hover:bg-blueprintdark text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60">
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
          <button onClick={handleDelete} disabled={saving || deleting} className="bg-rust hover:bg-red-800 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60">
            {deleting ? 'Menghapus...' : 'Hapus Project'}
          </button>
          {savedMsg && <span className="text-teal text-sm">{savedMsg}</span>}
        </div>
      </section>

      {project.checklist && (
        <section className="bg-panel border border-line rounded-lg p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-ink">Engineering Deliverables Checklist</h2>
            <span className="font-data text-sm text-blueprint font-medium">{project.checklist.progress}%</span>
          </div>
          <StageGauge progress={project.checklist.progress} showLabel={false} compact />
          <div className="grid grid-cols-1 gap-4 mt-2">
            {meta.checklistItems.map((item) => (
              <Row key={item} label={item}>
                <div className="flex gap-3">
                  <select
                    className="input w-1/3"
                    value={project.checklist.items[item] || 'Not Started'}
                    onChange={(e) => updateChecklistData(item, e.target.value, project.checklist.links?.[item] || '')}
                  >
                    {meta.checklistStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input
                    type="url"
                    placeholder="URL Dokumen / Drive Link..."
                    className="input w-2/3"
                    value={project.checklist.links?.[item] || ''}
                    onChange={(e) => updateChecklistData(item, project.checklist.items[item], e.target.value)}
                  />
                </div>
              </Row>
            ))}
          </div>
        </section>
      )}

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
