import { useState } from 'react';
import ModulePicker from './ModulePicker';
import TechFlow from './TechFlow';

// Form tambah / ubah satu project arsip. Hanya modul yang kolomnya ada di sheet yang bisa dipilih.
// initial = { name, year, modules: [{ key, cap, unit, detail }] }
export default function ArchiveEditor({ schema, initial, saving, error, submitLabel = 'Simpan', onSubmit, onCancel, notice }) {
  const [name, setName] = useState(initial?.name || '');
  const [year, setYear] = useState(initial?.year || String(new Date().getFullYear()));
  const [modules, setModules] = useState(() => (initial?.modules || []).map((x) => ({ key: x.key, cap: x.cap || '', unit: x.unit || '', detail: x.detail || '' })));
  const [localError, setLocalError] = useState('');
  const chosen = modules.map((m) => ({ ...m, label: (schema.find((s) => s.key === m.key) || {}).label }));

  function submit(e) {
    e.preventDefault();
    setLocalError('');
    if (!name.trim()) return setLocalError('Nama project wajib diisi.');
    if (!/^\d{4}$/.test(year.trim())) return setLocalError('Tahun harus 4 angka, mis. 2026.');
    onSubmit({
      name: name.trim(),
      year: year.trim(),
      modules: modules.map((m) => ({ key: m.key, cap: String(m.cap).trim(), unit: m.unit, detail: m.detail })),
    });
  }

  const shownError = localError || error;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {notice && <div className="bg-blueprint/10 border border-blueprint/25 rounded-md px-3 py-2 text-sm text-ink">{notice}</div>}

      <section className="bg-panel border border-line rounded-lg p-4 sm:p-5 shadow-sm grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Nama project</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. TKE MUS, RO 40 MPH, 2026" maxLength={200} required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Tahun selesai</span>
          <input className="input font-data" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} maxLength={4} required />
        </label>
      </section>

      <section className="bg-panel border border-line rounded-lg p-4 sm:p-5 shadow-sm" aria-live="polite">
        <h2 className="font-display font-semibold text-ink mb-3">Alur teknologi (pratinjau)</h2>
        <TechFlow modules={chosen} emptyText="Centang modul di bawah untuk menyusun alurnya." />
      </section>

      <ModulePicker schema={schema} value={modules} onChange={setModules} />

      {shownError && <p className="text-sm text-rust bg-rust/10 border border-rust/30 rounded-md px-3 py-2" role="alert">{shownError}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : submitLabel}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Batal</button>
        <span className="text-xs text-inkmute">Tersimpan langsung ke tab [ARSIP] FINISHED PROJECT di spreadsheet.</span>
      </div>
    </form>
  );
}
