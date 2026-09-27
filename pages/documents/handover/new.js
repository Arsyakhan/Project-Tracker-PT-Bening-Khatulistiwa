import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useToast } from '../../../components/Toast';
import PageHead from '../../../components/PageHead';
import ProjectPicker from '../../../components/docgen/ProjectPicker';
import { TextField, ToggleSection } from '../../../components/docgen/DocFormControls';
import { HANDOVER_SECTIONS, buildHandoverEmpty } from '../../../lib/docgen/schema';

const REQUIRED = ['project_name', 'system_title', 'buyer_company'];

function draftKey(projectId) {
  return `bk_docgen_ho_draft_${projectId || 'standalone'}`;
}

export default function NewHandoverReport() {
  const router = useRouter();
  const { projectId } = router.query;
  const { showToast } = useToast();

  const [projects, setProjects] = useState(null);
  const [linkedProject, setLinkedProject] = useState(null);
  const [form, setForm] = useState(buildHandoverEmpty);
  const [invalidFields, setInvalidFields] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const fieldRefs = useRef({});

  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const key = draftKey(projectId);
    let saved = null;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) saved = JSON.parse(raw);
    } catch {}

    if (saved) {
      setForm(saved);
    } else if (projectId && projects) {
      const p = projects.find((pr) => pr.id === projectId);
      if (p) {
        setLinkedProject(p);
        setForm((f) => ({ ...f, project_name: p.projectName || '', buyer_company: p.client || '', po_number: p.poNumber || '' }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, projectId, projects]);

  useEffect(() => {
    if (projectId && projects && !linkedProject) {
      const p = projects.find((pr) => pr.id === projectId);
      if (p) setLinkedProject(p);
    }
  }, [projectId, projects, linkedProject]);

  useEffect(() => {
    if (!router.isReady) return;
    try {
      window.localStorage.setItem(draftKey(projectId), JSON.stringify(form));
    } catch {}
  }, [form, projectId, router.isReady]);

  function update(id, value) {
    setForm((f) => ({ ...f, [id]: value }));
    setInvalidFields((v) => (v[id] ? { ...v, [id]: false } : v));
  }

  function selectProject(p) {
    setLinkedProject(p);
    setForm((f) => ({ ...f, project_name: p.projectName || f.project_name, buyer_company: p.client || f.buyer_company, po_number: p.poNumber || f.po_number }));
    router.replace({ pathname: router.pathname, query: { projectId: p.id } }, undefined, { shallow: true });
  }

  function unlinkProject() {
    setLinkedProject(null);
    router.replace({ pathname: router.pathname, query: {} }, undefined, { shallow: true });
  }

  async function handleSubmit() {
    const bad = {};
    REQUIRED.forEach((id) => { if (!String(form[id] || '').trim()) bad[id] = true; });
    if (Object.keys(bad).length > 0) {
      setInvalidFields(bad);
      const firstId = REQUIRED.find((id) => bad[id]);
      fieldRefs.current[firstId]?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      fieldRefs.current[firstId]?.focus?.();
      showToast('Ada field wajib (*) yang belum diisi.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const data = await api.generateDocument({
        type: 'handover',
        payload: form,
        projectId: linkedProject?.id,
        checklistItem: 'Handover Report',
      });
      setResult(data);
      try { window.localStorage.removeItem(draftKey(projectId)); } catch {}
      showToast('Dokumen Hand Over berhasil dibuat.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function startAnother() {
    setForm(buildHandoverEmpty());
    setResult(null);
  }

  return (
    <div className="max-w-3xl flex flex-col gap-5 pb-28">
      <PageHead title="Buat Handover Report" />
      <div className="flex items-center gap-2 text-sm text-inkmute">
        <Link href="/documents" className="hover:text-blueprint hover:underline">Generator Dokumen</Link>
        <span>/</span>
        <span className="text-ink font-medium">Handover Report</span>
      </div>
      <h1 className="font-display text-2xl font-bold text-ink">Handover Report</h1>

      {result ? (
        <section className="bg-panel border border-teal/30 rounded-lg p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-teal font-display font-semibold text-lg">
            <span className="w-8 h-8 rounded-full bg-teal/15 flex items-center justify-center">&#10003;</span>
            Dokumen berhasil dibuat
          </div>
          <a href={result.documentUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 px-4 py-2.5 rounded-md bg-blueprint hover:bg-blueprintdark text-white text-sm font-medium transition-colors">
            Buka Dokumen
          </a>
          {linkedProject && (
            <p className="text-sm text-inkmute">
              {result.checklistUpdated
                ? <>Link & status checklist "Handover Report" pada project <b className="text-ink">{linkedProject.projectName}</b> sudah diperbarui otomatis (jadi "Under Review").</>
                : <>Dokumen berhasil dibuat, tapi update otomatis ke checklist project gagal -- tempel link di atas secara manual ke tab Checklist Engineering.</>}
            </p>
          )}
          <div className="flex gap-3 pt-2 border-t border-line mt-1">
            {linkedProject && (
              <Link href={`/projects/${encodeURIComponent(linkedProject.id)}`} className="text-sm font-medium text-blueprint hover:underline">
                &larr; Kembali ke project
              </Link>
            )}
            <button onClick={startAnother} className="text-sm font-medium text-inkmute hover:text-ink">Buat dokumen lain</button>
          </div>
        </section>
      ) : (
        <>
          {linkedProject ? (
            <div className="bg-blueprint/10 border border-blueprint/30 rounded-lg px-4 py-3 flex items-center justify-between gap-3 text-sm">
              <span>Membuat dokumen untuk: <b className="text-ink">{linkedProject.projectName}</b> -- PO Number & Buyer sudah terisi otomatis.</span>
              <button onClick={unlinkProject} className="text-inkmute hover:text-rust font-medium whitespace-nowrap">Lepas dari project</button>
            </div>
          ) : (
            <div className="bg-panel border border-line rounded-lg p-4 flex flex-col gap-2">
              <span className="text-sm font-medium text-ink">Kaitkan ke project yang sudah tercatat? (opsional)</span>
              <ProjectPicker projects={projects} onSelect={selectProject} />
            </div>
          )}

          <section className="bg-panel border border-line rounded-lg p-6 flex flex-col gap-4">
            <h2 className="font-display font-semibold text-ink">Data Administrasi</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div ref={(el) => (fieldRefs.current.project_name = el?.querySelector('input'))}>
                <TextField label="Project Name (Nama File)" id="project_name" value={form.project_name} placeholder="ex: Percobaan / WTP Kebumen" onChange={update} required invalid={invalidFields.project_name} />
              </div>
              <div ref={(el) => (fieldRefs.current.system_title = el?.querySelector('input'))}>
                <TextField label="System Title" id="system_title" value={form.system_title} placeholder="ex: WTP 500 CMD" onChange={update} required invalid={invalidFields.system_title} />
              </div>
              <div ref={(el) => (fieldRefs.current.buyer_company = el?.querySelector('input'))}>
                <TextField label="Buyer Company Name" id="buyer_company" value={form.buyer_company} placeholder="ex: PT Laut Bercerita" onChange={update} required invalid={invalidFields.buyer_company} />
              </div>
              <TextField label="Contractor Name" id="contractor_name" value={form.contractor_name} onChange={update} />
              <TextField label="PO Reference No" id="po_number" value={form.po_number} placeholder="ex: 09/10/200" onChange={update} />
              <TextField label="Location of Plant" id="location" value={form.location} placeholder="ex: Kebumen, Jawa Tengah" onChange={update} />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-ink">Modul Equipment</h2>
              <span className="text-xs text-inkmute">Centang modul yang ada, isi spesifikasinya.</span>
            </div>
            {HANDOVER_SECTIONS.map((section) => (
              <ToggleSection key={section.key} section={section} values={form} onChange={update} />
            ))}
          </section>

          <div className="fixed bottom-0 left-0 right-0 md:left-60 bg-panel border-t border-line px-6 py-4 flex justify-end z-20">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-blueprint hover:bg-blueprintdark text-white rounded-md px-6 py-2.5 font-medium disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Membuat dokumen...' : 'Generate Hand Over Document'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
