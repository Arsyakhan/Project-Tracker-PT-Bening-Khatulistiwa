import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { api } from '../../lib/api';
import useProjects from '../../lib/useProjects';
import { useToast } from '../../components/Toast';
import PageHead from '../../components/PageHead';
import PicInput from '../../components/PicInput';
import { findDuplicatePo, todayISO } from '../../lib/projectHelpers';

const emptyForm = {
  poNumber: '', projectName: '', client: '', technology: '', pic: '',
  currentStage: 'PO', status: 'In Progress', priority: 'Medium',
  tanggalPO: '', tanggalDP: '', deliveryDate: '', targetFinishDate: '',
  remarks: '', deskripsiPesanan: '',
  nextAction: '', nextActionOwner: '', nextActionDue: '',
};

export default function NewProjectPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { showToast } = useToast();
  const uid = useId().replace(/:/g, '');
  const id = (name) => `${uid}-${name}`;
  const { projects } = useProjects();
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.getMeta().then(setMeta).catch((e) => showToast(e.message, 'error')); }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: '' }));
  }

  // Kolom langkah berikutnya baru ada di backend v2.6; sebelum itu isiannya diam-diam dibuang, jadi jangan ditawarkan.
  const showNext = !!projects && projects.some((p) => p.nextAction !== undefined);
  const duplicate = findDuplicatePo(projects, form.poNumber);
  const today = todayISO();
  const dateNotes = [];
  if (form.tanggalPO && form.deliveryDate && form.deliveryDate < form.tanggalPO) dateNotes.push('Tanggal kirim lebih awal dari Tanggal PO. Cek lagi tahunnya.');
  else if (form.deliveryDate && form.deliveryDate < today) dateNotes.push('Tanggal kirim sudah lewat, jadi project ini langsung tampil terlambat.');

  async function handleSubmit(e) {
    e.preventDefault();
    const next = {};
    if (!form.poNumber.trim()) next.poNumber = 'PO Number wajib diisi.';
    if (!form.projectName.trim()) next.projectName = 'Nama project wajib diisi.';
    setErrors(next);
    if (next.poNumber || next.projectName) {
      document.getElementById(next.poNumber ? id('po') : id('name'))?.focus();
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, poNumber: form.poNumber.trim(), projectName: form.projectName.trim(), user: session?.user?.email };
      if (!showNext) {
        delete payload.nextAction;
        delete payload.nextActionOwner;
        delete payload.nextActionDue;
      }
      const created = await api.addProject(payload);
      showToast('Project baru berhasil ditambahkan.', 'success');
      // Langsung ke halaman project: di sana PIC, spesifikasi, dan langkah berikutnya bisa dilengkapi.
      router.push(created && created.id ? `/projects/${encodeURIComponent(created.id)}` : '/projects');
    } catch (err) {
      showToast(err.message, 'error');
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl flex flex-col gap-5">
      <PageHead title="Project Baru" />
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Project Baru</h1>
        <p className="text-sm text-inkmute mt-1">Isi PO Number dan nama project dulu. Sisanya bisa dilengkapi nanti di halaman project.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Section title="Data utama">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field id={id('po')} label="PO Number" required error={errors.poNumber}
              hint={duplicate && (
                <p className="text-xs text-amberink">
                  PO ini sudah dipakai project &ldquo;{duplicate.projectName}&rdquo;.{' '}
                  <Link href={`/projects/${encodeURIComponent(duplicate.id)}`} className="font-medium underline">Buka project itu</Link>
                </p>
              )}>
              <input id={id('po')} className="input" autoComplete="off" aria-required="true" aria-invalid={!!errors.poNumber}
                aria-describedby={errors.poNumber ? `${id('po')}-err` : undefined}
                value={form.poNumber} onChange={(e) => update('poNumber', e.target.value)} />
            </Field>
            <Field id={id('name')} label="Nama project" required error={errors.projectName}>
              <input id={id('name')} className="input" aria-required="true" aria-invalid={!!errors.projectName}
                aria-describedby={errors.projectName ? `${id('name')}-err` : undefined}
                value={form.projectName} onChange={(e) => update('projectName', e.target.value)} />
            </Field>
            <Field id={id('client')} label="Client">
              <input id={id('client')} className="input" value={form.client} onChange={(e) => update('client', e.target.value)} />
            </Field>
            <Field id={id('pic')} label="PIC project">
              <PicInput id={id('pic')} value={form.pic} onChange={(v) => update('pic', v)} />
            </Field>
            <Field id={id('tpo')} label="Tanggal PO">
              <input id={id('tpo')} type="date" className="input" value={form.tanggalPO} onChange={(e) => update('tanggalPO', e.target.value)} />
            </Field>
            <Field id={id('kirim')} label="Tanggal kirim"
              hint={dateNotes.length > 0
                ? <p className="text-xs text-amberink">{dateNotes[0]}</p>
                : <p className="text-xs text-inkmute">Kosong berarti belum dihitung terlambat. Bisa diisi nanti di tab Jadwal.</p>}>
              <input id={id('kirim')} type="date" className="input" value={form.deliveryDate} onChange={(e) => update('deliveryDate', e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Posisi di alur" hint="Project baru biasanya mulai dari stage PO. Ubah kalau project ini sudah berjalan.">
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-4">
            <Field id={id('stage')} label="Stage saat ini">
              <select id={id('stage')} className="input" value={form.currentStage} onChange={(e) => update('currentStage', e.target.value)}>
                {(meta?.stages || ['PO']).map((s) => <option key={s} value={s}>{s}{meta?.stageWeights?.[s] != null ? ` (${meta.stageWeights[s]}%)` : ''}</option>)}
              </select>
            </Field>
            <Field id={id('status')} label="Status">
              <select id={id('status')} className="input" value={form.status} onChange={(e) => update('status', e.target.value)}>
                {(meta?.statuses || ['In Progress']).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field id={id('prio')} label="Prioritas">
              <select id={id('prio')} className="input" value={form.priority} onChange={(e) => update('priority', e.target.value)}>
                {(meta?.priorities || ['Medium']).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
        </Section>

        {showNext && (
          <Section title="Langkah pertama" hint="Satu hal konkret yang harus terjadi berikutnya, siapa yang mengerjakan, dan kapan. Supaya project ini langsung muncul di halaman Hari Ini.">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px_170px] gap-4">
              <Field id={id('next')} label="Langkah berikutnya">
                <input id={id('next')} className="input" maxLength={200} placeholder="ex: Kirim SOS ke client"
                  value={form.nextAction} onChange={(e) => update('nextAction', e.target.value)} />
              </Field>
              <Field id={id('owner')} label="PIC (siapa)">
                <PicInput id={id('owner')} value={form.nextActionOwner} onChange={(v) => update('nextActionOwner', v)} showDivision />
              </Field>
              <Field id={id('due')} label="Target tanggal">
                <input id={id('due')} type="date" className="input" value={form.nextActionDue} onChange={(e) => update('nextActionDue', e.target.value)} />
              </Field>
            </div>
          </Section>
        )}

        <details className="group bg-panel border border-line rounded-lg">
          <summary className="flex items-center justify-between gap-3 cursor-pointer select-none px-4 sm:px-5 py-3 min-h-[44px] text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
            <span>
              Data lain <span className="font-normal text-inkmute">(opsional)</span>
            </span>
            <svg aria-hidden="true" viewBox="0 0 20 20" className="w-4 h-4 text-inkmute transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 8l5 5 5-5" />
            </svg>
          </summary>
          <div className="flex flex-col gap-4 px-4 sm:px-5 pb-4 sm:pb-5 pt-1 border-t border-line">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
              <Field id={id('tech')} label="Teknologi / kapasitas">
                <input id={id('tech')} className="input" placeholder="ex: RO 4 MPH" value={form.technology} onChange={(e) => update('technology', e.target.value)} />
              </Field>
              <Field id={id('tdp')} label="Tanggal DP">
                <input id={id('tdp')} type="date" className="input" value={form.tanggalDP} onChange={(e) => update('tanggalDP', e.target.value)} />
              </Field>
            </div>
            <Field id={id('scope')} label="Lingkup pesanan (sesuai PO)">
              <textarea id={id('scope')} className="input" rows={3} placeholder="ex: Tank NaCl 5000 L, Tank NaCl 300 L (2 unit)"
                value={form.deskripsiPesanan} onChange={(e) => update('deskripsiPesanan', e.target.value)} />
            </Field>
            <Field id={id('remarks')} label="Catatan (kendala, menunggu material, dll.)">
              <textarea id={id('remarks')} className="input" rows={3} value={form.remarks} onChange={(e) => update('remarks', e.target.value)} />
            </Field>
          </div>
        </details>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
          <Link href="/projects" className="btn btn-ghost max-md:min-h-[40px]">Batal</Link>
          <button disabled={saving} className="btn btn-primary sm:min-w-[170px] max-md:min-h-[40px]">
            {saving ? 'Menyimpan...' : 'Simpan Project'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="bg-panel border border-line rounded-lg p-4 sm:p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
        {hint && <p className="text-xs text-inkmute mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

// Label + isian + pesan. Isian dan label dihubungkan lewat id (bukan dibungkus <label>) supaya petunjuk
// dan pesan galat tidak ikut menjadi nama isian untuk pembaca layar.
function Field({ id, label, required, error, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm min-w-0">
      <label htmlFor={id} className="text-inkmute font-medium">
        {label}
        {required && <span className="text-rust" aria-hidden="true"> *</span>}
      </label>
      {children}
      {error && <p id={`${id}-err`} className="text-xs text-rust" role="alert">{error}</p>}
      {hint}
    </div>
  );
}
