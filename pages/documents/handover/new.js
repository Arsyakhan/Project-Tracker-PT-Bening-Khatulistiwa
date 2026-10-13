import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useToast } from '../../../components/Toast';
import PageHead from '../../../components/PageHead';
import ConfirmModal from '../../../components/ConfirmModal';
import AddEquipment from '../../../components/AddEquipment';
import ProjectPicker from '../../../components/docgen/ProjectPicker';
import EquipmentSections from '../../../components/docgen/EquipmentSections';
import { TextField } from '../../../components/docgen/DocFormControls';
import { prefillHandover } from '../../../lib/docgen/prefill';
import { SPEC_FIELD_IDS, packSpecs, unpackSpecs, derivedSpecs, withDerived, autoSpecIds, buildSpecEmpty } from '../../../lib/docgen/specs';
import { moduleSpecContext } from '../../../lib/docgen/specModules';
import { DOC_OPTIONS, handoverPlan, buildHandoverPayload } from '../../../lib/docgen/handoverPayload';
import { buildEquipmentItems } from '../../../lib/docgen/handoverItems';
import { docReadiness } from '../../../lib/systems';
import { gridModules, readTech, TECH_SCHEMA } from '../../../lib/techflow';

const REQUIRED = ['project_name', 'system_title', 'buyer_company'];

function draftKey(projectId) {
  return `bk_docgen_ho_draft_${projectId || 'standalone'}`;
}

// techModules = teknologi terbaru project (dari grid / Spesifikasi); kosong -> dipakai teknologi dari daftar project.
function prefillFrom(project, techModules) {
  return prefillHandover(project, techModules && techModules.length > 0 ? techModules : undefined);
}

const toggleIn = (list, key) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

export default function NewHandoverReport() {
  const router = useRouter();
  const { projectId } = router.query;
  const { showToast } = useToast();

  const [projects, setProjects] = useState(null);
  const [linkedProject, setLinkedProject] = useState(null);
  const [form, setForm] = useState(buildSpecEmpty);
  const [initialized, setInitialized] = useState(false);
  const [invalidFields, setInvalidFields] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const fieldRefs = useRef({});
  // Spesifikasi peralatan yang tersimpan di project (lihat tab "Spesifikasi Peralatan" di detail project)
  const projectSpecsRef = useRef({});             // spesifikasi terakhir (isian tersimpan + nilai otomatis dari Teknologi)
  const derivedSpecsRef = useRef({});             // bagian yang otomatis dari Teknologi (tidak ikut disimpan ke project)
  const techRef = useRef([]);                     // teknologi terbaru project (modul yang dicentang)
  const [techMods, setTechMods] = useState(null); // sama dengan techRef; null = belum dimuat
  const [autoBase, setAutoBase] = useState(() => new Set()); // id kolom yang berasal dari nilai otomatis Teknologi
  const [specsVersion, setSpecsVersion] = useState(0);
  const [specsCount, setSpecsCount] = useState(0);
  const [specsAuto, setSpecsAuto] = useState(0);        // berapa kolom yang masih nilai otomatis dari Teknologi
  const [specsBusy, setSpecsBusy] = useState(false);
  const [confirmReloadOpen, setConfirmReloadOpen] = useState(false);
  // Penyesuaian khusus dokumen ini (tidak mengubah Teknologi project): peralatan/opsi tambahan dan butir yang tidak dicetak.
  const [localMods, setLocalMods] = useState([]);
  const [localOpts, setLocalOpts] = useState([]);
  const [excludedKeys, setExcludedKeys] = useState([]);
  const [lastAdded, setLastAdded] = useState(null);
  const activeKey = useRef(null); // kunci localStorage untuk draft yang sedang aktif
  const dirty = useRef(false); // draft baru disimpan setelah pengguna benar-benar mengedit

  useEffect(() => {
    // Kalau daftar project gagal dimuat, tetap lanjut (tanpa prefill) supaya form tidak macet.
    api.getProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  // Ambil spesifikasi milik sebuah project: nilai otomatis dari Teknologinya (kapasitas + teks Detail Spesifikasi di grid
  // tab Project Tracker), lalu isian tersimpan di atasnya (override manual menang). Backend belum v2.8 / grid masih kosong
  // = Teknologi yang tersimpan di Spesifikasi (kunci tech_*), sama seperti tab Spesifikasi di detail project.
  async function fetchProjectSpecs(pid) {
    const [specsRes, techRes] = await Promise.allSettled([api.getSpecs(pid), api.getTech(pid)]);
    let saved = {};
    let version = 0;
    if (specsRes.status === 'fulfilled') {
      saved = unpackSpecs(specsRes.value.specs);
      version = specsRes.value.version || 0;
    }
    const gridMods = techRes.status === 'fulfilled' ? gridModules(techRes.value.modules) : [];
    const mods = gridMods.length > 0 ? gridMods : (readTech(saved) || []);
    techRef.current = mods;
    setTechMods(mods);
    const derived = mods.length > 0 ? derivedSpecs(mods) : {};
    const specs = withDerived(saved, derived);
    derivedSpecsRef.current = derived;
    projectSpecsRef.current = specs;
    const auto = autoSpecIds(saved, derived);
    setAutoBase(auto);
    setSpecsVersion(version);
    setSpecsCount(Object.keys(packSpecs(specs)).length);
    setSpecsAuto(auto.size);
    return specs;
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
      if (saved) {
        // Draft versi 2 menyimpan juga penyesuaian peralatan; draft lama hanya isian form.
        const v2 = saved.__v === 2;
        setForm({ ...buildSpecEmpty(), ...(v2 ? saved.form : saved) });
        setLocalMods(v2 && Array.isArray(saved.localMods) ? saved.localMods : []);
        setLocalOpts(v2 && Array.isArray(saved.localOpts) ? saved.localOpts : []);
        setExcludedKeys(v2 && Array.isArray(saved.excluded) ? saved.excluded : []);
      } else if (p) setForm({ ...buildSpecEmpty(), ...prefillFrom(p, techRef.current), ...specs });
      else setForm(buildSpecEmpty());
      dirty.current = false;
      setInitialized(true);
    })();
  }, [router.isReady, projectId, projects]);

  // Simpan draft otomatis, tapi HANYA setelah pengguna mengedit -- supaya form kosong / hasil
  // prefill awal tidak ikut tersimpan lalu menimpa prefill di kunjungan berikutnya.
  useEffect(() => {
    if (!dirty.current || !activeKey.current) return;
    try {
      window.localStorage.setItem(activeKey.current, JSON.stringify({ __v: 2, form, localMods, localOpts, excluded: excludedKeys }));
    } catch {}
  }, [form, localMods, localOpts, excludedKeys]);

  function update(id, value) {
    dirty.current = true;
    setForm((f) => ({ ...f, [id]: value }));
    setInvalidFields((v) => (v[id] ? { ...v, [id]: false } : v));
  }

  function resetAdjustments() {
    setLocalMods([]);
    setLocalOpts([]);
    setExcludedKeys([]);
    setLastAdded(null);
  }

  function selectProject(p) {
    activeKey.current = draftKey(p.id); // supaya efek inisialisasi tidak menimpa form yang sedang diisi
    resetAdjustments();
    setLinkedProject(p);
    setForm((f) => ({ ...f, ...prefillFrom(p) }));
    fetchProjectSpecs(p.id).then((specs) => {
      // Daftar peralatan dihitung ulang dari Teknologi terbaru, lalu spesifikasi (koreksi manual) di atasnya.
      setForm((f) => ({ ...f, ...prefillFrom(p, techRef.current), ...specs }));
    });
    router.replace({ pathname: router.pathname, query: { projectId: p.id } }, undefined, { shallow: true });
  }

  function unlinkProject() {
    activeKey.current = draftKey(null);
    projectSpecsRef.current = {};
    derivedSpecsRef.current = {};
    techRef.current = [];
    setTechMods(null);
    setAutoBase(new Set());
    setSpecsVersion(0);
    setSpecsCount(0);
    setSpecsAuto(0);
    setLinkedProject(null);
    router.replace({ pathname: router.pathname, query: {} }, undefined, { shallow: true });
  }

  const readiness = linkedProject ? docReadiness(linkedProject, 'handover') : null;

  // Peralatan di dokumen = modul yang dicentang di Teknologi project (+ tambahan khusus dokumen ini). Satu modul = satu butir.
  const ctx = useMemo(() => {
    const base = linkedProject
      ? moduleSpecContext(linkedProject, techMods && techMods.length > 0 ? techMods : undefined)
      : { mods: new Set(), docOpts: new Set() };
    return { mods: new Set([...base.mods, ...localMods]), docOpts: new Set([...base.docOpts, ...localOpts]) };
  }, [linkedProject, techMods, localMods, localOpts]);
  const excluded = useMemo(() => new Set(excludedKeys), [excludedKeys]);
  const plan = useMemo(() => handoverPlan(ctx, excluded), [ctx, excluded]);
  const items = useMemo(() => buildEquipmentItems(plan.sections, form), [plan, form]);

  // Kolom yang masih berisi nilai otomatis dari Teknologi (belum dikoreksi di form ini).
  const autoIds = useMemo(() => {
    const out = new Set();
    autoBase.forEach((id) => { if (String(form[id] ?? '') === String(derivedSpecsRef.current[id] ?? '')) out.add(id); });
    return out;
  }, [autoBase, form]);

  const scrollTo = lastAdded ? plan.all.find((s) => s.modules.includes(lastAdded))?.key : null;

  function addModule(key) {
    dirty.current = true;
    setLocalMods((l) => (l.includes(key) ? l : [...l, key]));
    setExcludedKeys((l) => l.filter((k) => !plan.all.some((s) => s.key === k && s.modules.includes(key))));
    setLastAdded(key);
  }
  function toggleSection(key) {
    dirty.current = true;
    setExcludedKeys((l) => toggleIn(l, key));
  }
  function toggleOption(opt) {
    dirty.current = true;
    if (!ctx.docOpts.has(opt.key)) setLocalOpts((l) => (l.includes(opt.key) ? l : [...l, opt.key]));
    else if (localOpts.includes(opt.key)) setLocalOpts((l) => l.filter((k) => k !== opt.key));
    else setExcludedKeys((l) => toggleIn(l, opt.section));
  }

  // Simpan isian spesifikasi di form ini ke project, supaya koreksi saat serah terima tidak hilang.
  async function saveSpecsToProject() {
    if (!linkedProject || specsBusy) return;
    // Yang sama dengan nilai otomatis dari Teknologi tidak disimpan (tetap mengikuti Teknologi); hanya koreksi manual.
    const packed = packSpecs(form, derivedSpecsRef.current);
    const fullCount = Object.keys(packSpecs(form)).length;
    if (fullCount === 0) {
      showToast('Belum ada spesifikasi yang diisi untuk disimpan.', 'error');
      return;
    }
    setSpecsBusy(true);
    try {
      const res = await api.saveSpecs({ projectId: linkedProject.id, specs: packed, baseVersion: specsVersion });
      projectSpecsRef.current = withDerived(unpackSpecs(packed), derivedSpecsRef.current);
      setSpecsVersion(res.version);
      setSpecsCount(fullCount);
      showToast(Object.keys(packed).length === 0 ? 'Tidak ada koreksi manual; spesifikasi tetap mengikuti Teknologi project.' : 'Koreksi spesifikasi tersimpan ke project.', 'success');
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
      const base = buildSpecEmpty();
      dirty.current = true;
      setForm((f) => {
        const next = { ...f };
        SPEC_FIELD_IDS.forEach((id) => { next[id] = base[id]; });
        return { ...next, ...prefillFrom(linkedProject, techRef.current), ...specs };
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
    const { payload, equipment } = buildHandoverPayload(form, ctx, excluded);
    if (equipment.length === 0) {
      showToast('Belum ada peralatan yang dicetak. Centang modul di Teknologi project, atau tambah peralatan di bawah.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const data = await api.generateDocument({
        type: 'handover',
        payload,
        projectId: linkedProject?.id,
        checklistItem: 'Handover Report',
      });
      setResult({ ...data, itemTotal: equipment.length });
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
    resetAdjustments();
    setForm(linkedProject ? { ...buildSpecEmpty(), ...prefillFrom(linkedProject, techRef.current), ...projectSpecsRef.current } : buildSpecEmpty());
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
          <a href={result.documentUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 px-4 py-2.5 rounded-md bg-blueprint hover:bg-blueprintdark text-onaccent text-sm font-medium transition-colors">
            Buka Dokumen
          </a>
          {result.generator === 'dynamic' ? (
            <p className="text-sm text-inkmute" data-testid="ho-generator-note">
              Daftar peralatan disusun dari Teknologi project: <b className="text-ink">{result.itemCount ?? result.itemTotal} butir</b>, urut mengikuti alur pengolahan.
            </p>
          ) : (
            <p className="text-sm text-amberink bg-amber/10 border border-amber/30 rounded-md px-3 py-2" role="status" data-testid="ho-generator-note">
              {result.generator === 'legacy'
                ? <>Dokumen dibuat dengan susunan template lama (peralatan digabung per seksi), karena penyusunan daftar peralatan baru gagal di Apps Script{result.fallbackReason ? <> ({result.fallbackReason})</> : null}.</>
                : <>Dokumen dibuat dengan susunan template lama (peralatan digabung per seksi), karena script Generator Hand Over di Apps Script belum diperbarui.</>}
              {' '}Minta pemilik menempel <code className="font-data">apps-script/docgen/handover.gs</code> terbaru lalu men-deploy ulang; sesudah itu dokumen berikutnya langsung mengikuti Teknologi.
            </p>
          )}
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
                <span>Membuat dokumen untuk: <b className="text-ink">{linkedProject.projectName}</b> -- data project (PO, client, lokasi, teknologi) sudah terisi otomatis. Periksa kembali sebelum generate.</span>
                {!readiness.ready && (
                  <span className="block text-xs text-amberink mt-1">
                    Belum lengkap di project: {readiness.missing.join(', ')}.{' '}
                    <Link href={`/projects/${encodeURIComponent(linkedProject.id)}`} className="underline font-medium">Lengkapi di detail project</Link>
                  </span>
                )}
                {readiness.note && <span className="block text-xs text-inkmute mt-1">{readiness.note}</span>}
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
                  <span className="text-inkmute">
                    {specsCount > 0
                      ? `Spesifikasi peralatan: ${specsCount} kolom terisi dari project${specsAuto > 0 ? ` (${specsAuto} otomatis dari Teknologi)` : ''}.`
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

          <section className="flex flex-col gap-3" aria-label="Peralatan yang dicetak">
            <div>
              <h2 className="font-display font-semibold text-ink">Peralatan yang dicetak</h2>
              <p className="text-xs text-inkmute mt-1">
                {linkedProject
                  ? <>Mengikuti Teknologi project: satu modul yang dicentang = satu butir di dokumen, urut sesuai alur pengolahan. Spesifikasinya diambil dari tab Spesifikasi Peralatan (kolom yang kosong dicetak &quot;.......&quot; supaya bisa dilengkapi di Google Docs). Perubahan di bawah berlaku untuk dokumen ini; klik &quot;Simpan ke project&quot; untuk menyimpan koreksi spesifikasi. Untuk mengubah daftar modul, centang di tab Teknologi <Link href={`/projects/${encodeURIComponent(linkedProject.id)}`} className="text-blueprint hover:underline">di detail project</Link>.</>
                  : <>Pilih peralatan yang akan dicetak, lalu isi spesifikasinya. Satu peralatan = satu butir di dokumen, urut sesuai alur pengolahan. Kaitkan ke project di atas kalau ingin daftar ini langsung mengikuti Teknologi project.</>}
              </p>
            </div>

            <div className="bg-panel border border-line rounded-lg p-4 flex flex-col gap-3">
              <AddEquipment
                schema={TECH_SCHEMA}
                ticked={ctx.mods}
                onAdd={addModule}
                defaultOpen={!linkedProject && plan.sections.length === 0}
                hint="Pilih peralatan yang akan dicetak. Seksinya langsung muncul di bawah; Teknologi project tidak berubah."
                doneNote="Semua modul sudah ada di daftar."
              />
              <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3">
                <legend className="sr-only">Opsi dokumen</legend>
                <span className="text-xs font-semibold uppercase tracking-wider text-inkmute">Opsi dokumen</span>
                {DOC_OPTIONS.map((o) => (
                  <label key={o.key} className="flex items-center gap-2 text-sm text-ink cursor-pointer tap">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-blueprint"
                      checked={ctx.docOpts.has(o.key) && !excluded.has(o.section)}
                      onChange={() => toggleOption(o)}
                    />
                    {o.label}
                  </label>
                ))}
              </fieldset>
            </div>

            {plan.all.length === 0 ? (
              <div className="bg-panel border border-line rounded-lg p-5 text-sm text-inkmute" data-testid="ho-empty">
                {linkedProject
                  ? 'Teknologi project ini belum dicentang. Isi di tab Teknologi detail project, atau tambah peralatan di atas.'
                  : 'Belum ada peralatan. Tambahkan lewat "+ Tambah peralatan" di atas.'}
              </div>
            ) : (
              <EquipmentSections
                sections={plan.all}
                values={form}
                onChange={update}
                excluded={excluded}
                onToggle={toggleSection}
                autoIds={autoIds}
                scrollTo={scrollTo}
              />
            )}
          </section>

          <section className="bg-panel border border-line rounded-lg p-5 flex flex-col gap-3" aria-label="Pratinjau isi dokumen" data-testid="ho-preview">
            <div>
              <h2 className="font-display font-semibold text-ink">Pratinjau isi dokumen</h2>
              <p className="text-xs text-inkmute mt-1">
                {items.length > 0
                  ? <>{items.length} butir di &quot;Items Handed Over&quot;, persis seperti yang akan dicetak (bahasa Inggris, sama dengan template).</>
                  : 'Belum ada butir. Dokumen tidak bisa dibuat sebelum ada peralatan.'}
              </p>
            </div>
            {items.length > 0 && (
              <ol className="list-decimal pl-5 flex flex-col gap-2 text-sm text-ink">
                {items.map((it) => (
                  <li key={it.key} data-testid="ho-preview-item">
                    <span>{it.head}</span>
                    {it.rows.length > 0 && (
                      <ul className="list-disc pl-5 mt-1 flex flex-col gap-0.5 text-xs text-inkmute">
                        {it.rows.map((r, i) => <li key={`${it.key}-${i}`}>{r}</li>)}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="fixed bottom-0 left-0 right-0 md:left-60 bg-panel border-t border-line px-6 py-4 flex items-center justify-between gap-3 z-20">
            <span className="text-xs text-inkmute tnum">{items.length} butir peralatan</span>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-blueprint hover:bg-blueprintdark text-onaccent rounded-md px-6 py-2.5 font-medium disabled:opacity-60 transition-colors"
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
