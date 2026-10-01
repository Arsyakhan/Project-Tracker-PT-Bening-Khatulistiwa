import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useToast } from '../../../components/Toast';
import PageHead from '../../../components/PageHead';
import ConfirmModal from '../../../components/ConfirmModal';
import ProjectPicker from '../../../components/docgen/ProjectPicker';
import { TextField, ToggleSection } from '../../../components/docgen/DocFormControls';
import { HANDOVER_SECTIONS, buildHandoverEmpty } from '../../../lib/docgen/schema';
import { prefillHandover } from '../../../lib/docgen/prefill';
import { SPEC_FIELD_IDS, packSpecs, unpackSpecs } from '../../../lib/docgen/specs';
import { docReadiness, effectiveSystems, toHandoverModules } from '../../../lib/systems';

const REQUIRED = ['project_name', 'system_title', 'buyer_company'];

function draftKey(projectId) {
  return `bk_docgen_ho_draft_${projectId || 'standalone'}`;
}

function prefillFrom(project) {
  return prefillHandover(project);
}

export default function NewHandoverReport() {
  const router = useRouter();
  const { projectId } = router.query;
  const { showToast } = useToast();

  const [projects, setProjects] = useState(null);
  const [linkedProject, setLinkedProject] = useState(null);
  const [form, setForm] = useState(buildHandoverEmpty);
  const [initialized, setInitialized] = useState(false);
  const [invalidFields, setInvalidFields] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const fieldRefs = useRef({});
  // Spesifikasi peralatan yang tersimpan di project (lihat tab "Spesifikasi Peralatan" di detail project)
  const projectSpecsRef = useRef({});             // spesifikasi terakhir dari server (sudah dibersihkan)
  const [specsVersion, setSpecsVersion] = useState(0);
  const [specsCount, setSpecsCount] = useState(0);
  const [specsBusy, setSpecsBusy] = useState(false);
  const [confirmReloadOpen, setConfirmReloadOpen] = useState(false);
  const activeKey = useRef(null); // kunci localStorage untuk draft yang sedang aktif
  const dirty = useRef(false); // draft baru disimpan setelah pengguna benar-benar mengedit

  useEffect(() => {
    // Kalau daftar project gagal dimuat, tetap lanjut (tanpa prefill) supaya form tidak macet.
    api.getProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  // Ambil spesifikasi tersimpan milik sebuah project. Gagal = lanjut tanpa spesifikasi (form tetap bisa dipakai).
  async function fetchProjectSpecs(pid) {
    try {
      const res = await api.getSpecs(pid);
      const specs = unpackSpecs(res.specs);
      projectSpecsRef.current = specs;
      setSpecsVersion(res.version || 0);
      setSpecsCount(Object.keys(packSpecs(specs)).length);
      return specs;
    } catch {
      projectSpecsRef.current = {};
      setSpecsVersion(0);
      setSpecsCount(0);
      return {};
    }
  }

  // Inisialisasi form SEKALI per project: pulihkan draft kalau ada, kalau tidak isi dari data project.
  useEffect(() => {
    if (!router.isReady) return;
    if (projectId && projects === null) return; // tunggu daftar project supaya prefill bisa jalan
    const key = draftKey(projectId);
    if (activeKey.current === key) return;
    activeKey.current = key;

    let saved = null;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) saved = JSON.parse(raw);
    } catch {}

    const p = projectId && projects ? projects.find((pr) => pr.id === projectId) || null : null;
    setLinkedProject(p);

    (async () => {
      // Spesifikasi project selalu diambil (untuk nomor versi), tapi hanya dipakai kalau tidak ada draft.
      const specs = p ? await fetchProjectSpecs(p.id) : {};
      if (saved) setForm({ ...buildHandoverEmpty(), ...saved });
      else if (p) setForm({ ...buildHandoverEmpty(), ...prefillFrom(p), ...specs });
      else setForm(buildHandoverEmpty());
      dirty.current = false;
      setInitialized(true);
    })();
  }, [router.isReady, projectId, projects]);

  // Simpan draft otomatis, tapi HANYA setelah pengguna mengedit -- supaya form kosong / hasil
  // prefill awal tidak ikut tersimpan lalu menimpa prefill di kunjungan berikutnya.
  useEffect(() => {
    if (!dirty.current || !activeKey.current) return;
    try {
      window.localStorage.setItem(activeKey.current, JSON.stringify(form));
    } catch {}
  }, [form]);

  function update(id, value) {
    dirty.current = true;
    setForm((f) => ({ ...f, [id]: value }));
    setInvalidFields((v) => (v[id] ? { ...v, [id]: false } : v));
  }

  function selectProject(p) {
    activeKey.current = draftKey(p.id); // supaya efek inisialisasi tidak menimpa form yang sedang diisi
    setLinkedProject(p);
    setForm((f) => ({ ...f, ...prefillFrom(p) }));
    fetchProjectSpecs(p.id).then((specs) => {
      if (Object.keys(specs).length > 0) setForm((f) => ({ ...f, ...specs }));
    });
    router.replace({ pathname: router.pathname, query: { projectId: p.id } }, undefined, { shallow: true });
  }

  function unlinkProject() {
    activeKey.current = draftKey(null);
    projectSpecsRef.current = {};
    setSpecsVersion(0);
    setSpecsCount(0);
    setLinkedProject(null);
    router.replace({ pathname: router.pathname, query: {} }, undefined, { shallow: true });
  }

  const readiness = linkedProject ? docReadiness(linkedProject, 'handover') : null;
  const hoNotes = [];
  if (linkedProject) {
    const info = toHandoverModules(effectiveSystems(linkedProject).keys);
    if (info.overflowFilters.length > 0) hoNotes.push(`Template Hand Over hanya punya 2 slot filter. Tambahkan secara manual di "Item Tambahan": ${info.overflowFilters.join(', ')}.`);
    if (info.notInHandover.length > 0) hoNotes.push(`${info.notInHandover.join(', ')} tidak punya seksi di template Hand Over.`);
  }

  // Simpan isian spesifikasi di form ini ke project, supaya koreksi saat serah terima tidak hilang.
  async function saveSpecsToProject() {
    if (!linkedProject || specsBusy) return;
    const packed = packSpecs(form);
    if (Object.keys(packed).length === 0) {
      showToast('Belum ada spesifikasi yang diisi untuk disimpan.', 'error');
      return;
    }
    setSpecsBusy(true);
    try {
      const res = await api.saveSpecs({ projectId: linkedProject.id, specs: packed, baseVersion: specsVersion });
      projectSpecsRef.current = unpackSpecs(packed);
      setSpecsVersion(res.version);
      setSpecsCount(Object.keys(packed).length);
      showToast('Spesifikasi tersimpan ke project.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSpecsBusy(false);
    }
  }

  // Ganti isian spesifikasi di form dengan data terbaru dari project.
  async function reloadSpecsFromProject() {
    if (!linkedProject) return;
    setConfirmReloadOpen(false);
    setSpecsBusy(true);
    try {
      const specs = await fetchProjectSpecs(linkedProject.id);
      const base = buildHandoverEmpty();
      dirty.current = true;
      setForm((f) => {
        const next = { ...f };
        SPEC_FIELD_IDS.forEach((id) => { next[id] = base[id]; });
        return { ...next, ...prefillFrom(linkedProject), ...specs };
      });
      showToast('Spesifikasi dimuat ulang dari project.', 'success');
    } finally {
      setSpecsBusy(false);
    }
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
      dirty.current = false;
      try { window.localStorage.removeItem(activeKey.current || draftKey(projectId)); } catch {}
      showToast('Dokumen Hand Over berhasil dibuat.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function startAnother() {
    dirty.current = false;
    setResult(null);
    setInvalidFields({});
    setForm(linkedProject ? { ...buildHandoverEmpty(), ...prefillFrom(linkedProject), ...projectSpecsRef.current } : buildHandoverEmpty());
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

      {!initialized ? (
        <p className="text-sm text-inkmute">Memuat data project...</p>
      ) : result ? (
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
              <div className="min-w-0">
                <span>Membuat dokumen untuk: <b className="text-ink">{linkedProject.projectName}</b> -- data project (PO, client, lokasi, sistem terpasang) sudah terisi otomatis. Periksa kembali sebelum generate.</span>
                {!readiness.ready && (
                  <span className="block text-xs text-amber mt-1">
                    Belum lengkap di project: {readiness.missing.join(', ')}.{' '}
                    <Link href={`/projects/${encodeURIComponent(linkedProject.id)}`} className="underline font-medium">Lengkapi di detail project</Link>
                  </span>
                )}
                {readiness.note && <span className="block text-xs text-inkmute mt-1">{readiness.note}</span>}
                {hoNotes.map((n) => <span key={n} className="block text-xs text-inkmute mt-1">{n}</span>)}
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
                  <span className="text-inkmute">
                    {specsCount > 0
                      ? `Spesifikasi peralatan: ${specsCount} kolom terisi dari project.`
                      : 'Spesifikasi peralatan project belum diisi.'}
                  </span>
                  <button type="button" onClick={saveSpecsToProject} disabled={specsBusy} className="font-medium text-blueprint hover:underline disabled:opacity-50">
                    Simpan ke project
                  </button>
                  <button type="button" onClick={() => setConfirmReloadOpen(true)} disabled={specsBusy} className="font-medium text-blueprint hover:underline disabled:opacity-50">
                    Muat ulang dari project
                  </button>
                </span>
              </div>
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
              <div ref={(el) => { fieldRefs.current.project_name = el?.querySelector('input'); }}>
                <TextField label="Project Name (Nama File)" id="project_name" value={form.project_name} placeholder="ex: Percobaan / WTP Kebumen" onChange={update} required invalid={invalidFields.project_name} />
              </div>
              <div ref={(el) => { fieldRefs.current.system_title = el?.querySelector('input'); }}>
                <TextField label="System Title" id="system_title" value={form.system_title} placeholder="ex: WTP 500 CMD" onChange={update} required invalid={invalidFields.system_title} />
              </div>
              <div ref={(el) => { fieldRefs.current.buyer_company = el?.querySelector('input'); }}>
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
      <ConfirmModal
        open={confirmReloadOpen}
        title="Muat ulang dari project?"
        description="Isian spesifikasi peralatan di form ini akan diganti dengan data yang tersimpan di project. Perubahan yang belum disimpan ke project akan hilang."
        confirmText="Ya, muat ulang"
        cancelText="Batal"
        danger={true}
        onConfirm={reloadSpecsFromProject}
        onCancel={() => setConfirmReloadOpen(false)}
      />
    </div>
  );
}
