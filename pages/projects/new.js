import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { api } from '../../lib/api'; // <-- Ini yang tadinya error, sudah diperbaiki menjadi ../../

const emptyForm = {
  poNumber: '', projectName: '', client: '', technology: '', pic: '',
  currentStage: 'PO', status: 'In Progress', priority: 'Medium',
  tanggalPO: '', tanggalDP: '', deliveryDate: '', targetFinishDate: '', 
  remarks: '', deskripsiPesanan: '', spesifikasiTeknologi: ''
};

export default function NewProjectPage() {
  const router = useRouter();
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { api.getMeta().then(setMeta).catch((e) => setError(e.message)); }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.poNumber || !form.projectName) {
      setError('PO Number dan Project Name wajib diisi.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.addProject(form);
      router.push('/projects');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl flex flex-col gap-5">
      <h1 className="font-display text-2xl font-semibold text-ink">Project Baru</h1>
      {error && <div className="text-rust text-sm bg-panel border border-line rounded-md p-3">{error}</div>}
      <form onSubmit={handleSubmit} className="bg-panel border border-line rounded-lg p-6 flex flex-col gap-4">
        <Row label="PO Number *">
          <input required className="input" value={form.poNumber} onChange={(e) => update('poNumber', e.target.value)} />
        </Row>
        <Row label="Nama Project *">
          <input required className="input" value={form.projectName} onChange={(e) => update('projectName', e.target.value)} />
        </Row>
        <Row label="Client">
          <input className="input" value={form.client} onChange={(e) => update('client', e.target.value)} />
        </Row>
        <Row label="Technology/Capacity">
          <input className="input" value={form.technology} onChange={(e) => update('technology', e.target.value)} />
        </Row>
        <Row label="PIC">
          <input className="input" value={form.pic} onChange={(e) => update('pic', e.target.value)} />
        </Row>
        <Row label="Current Stage">
          <select className="input" value={form.currentStage} onChange={(e) => update('currentStage', e.target.value)}>
            {(meta?.stages || ['PO']).map((s) => <option key={s} value={s}>{s} ({meta?.stageWeights?.[s]}%)</option>)}
          </select>
        </Row>
        <Row label="Status">
          <select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}>
            {(meta?.statuses || ['In Progress']).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Row>
        <Row label="Priority">
          <select className="input" value={form.priority} onChange={(e) => update('priority', e.target.value)}>
            {(meta?.priorities || ['Medium']).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Row>
        <Row label="Tanggal PO">
          <input type="date" className="input" value={form.tanggalPO} onChange={(e) => update('tanggalPO', e.target.value)} />
        </Row>
        <Row label="Tanggal DP">
          <input type="date" className="input" value={form.tanggalDP} onChange={(e) => update('tanggalDP', e.target.value)} />
        </Row>
        <Row label="Delivery Date">
          <input type="date" className="input" value={form.deliveryDate} onChange={(e) => update('deliveryDate', e.target.value)} />
        </Row>
        <Row label="Remarks">
          <textarea className="input" rows={3} value={form.remarks} onChange={(e) => update('remarks', e.target.value)} />
        </Row>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-line pt-4 mt-2">
          <Row label="Deskripsi Pesanan (Teknologi)">
            <textarea className="input" rows={4} value={form.deskripsiPesanan} onChange={(e) => update('deskripsiPesanan', e.target.value)} />
          </Row>
          <Row label="Spesifikasi & Detail Teknologi">
            <textarea className="input" rows={4} value={form.spesifikasiTeknologi} onChange={(e) => update('spesifikasiTeknologi', e.target.value)} />
          </Row>
        </div>

        <button disabled={saving} className="mt-4 bg-blueprint hover:bg-blueprintdark text-white rounded-md py-2.5 font-medium disabled:opacity-60">
          {saving ? 'Menyimpan...' : 'Simpan Project'}
        </button>
      </form>
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
