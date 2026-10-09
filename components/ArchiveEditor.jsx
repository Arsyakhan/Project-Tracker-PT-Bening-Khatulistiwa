import { useMemo, useState } from 'react';
import TechFlow from './TechFlow';
import { ARCHIVE_UNITS, FLOW_PHASES, stepInfo, moduleLabel } from '../lib/techflow';

// Form tambah / ubah satu project arsip. Hanya modul yang kolomnya ada di sheet yang bisa dipilih.
// initial = { name, year, modules: [{ key, cap, unit, detail }] }
export default function ArchiveEditor({ schema, initial, saving, error, submitLabel = 'Simpan', onSubmit, onCancel, notice }) {
  const [name, setName] = useState(initial?.name || '');
  const [year, setYear] = useState(initial?.year || String(new Date().getFullYear()));
  const [mods, setMods] = useState(() => {
    const m = {};
    (initial?.modules || []).forEach((x) => { m[x.key] = { cap: x.cap || '', unit: x.unit || '', detail: x.detail || '' }; });
    return m;
  });
  const [localError, setLocalError] = useState('');

  // Kelompokkan modul sheet per fase alur; modul yang tidak dikenal masuk "Lainnya".
  const groups = useMemo(() => {
    const out = FLOW_PHASES.map((ph) => ({ key: ph.key, label: ph.label, items: [] }));
    const other = { key: 'lain', label: 'Lainnya', items: [] };
    const order = {};
    schema.forEach((s, i) => { order[s.key] = i; });
    schema.forEach((s) => {
      const info = stepInfo(s.key);
      const g = info ? out.find((x) => x.key === info.phase) : other;
      g.items.push(s);
    });
    return [...out, other].filter((g) => g.items.length);
  }, [schema]);

  const chosen = schema.filter((s) => mods[s.key]).map((s) => ({ key: s.key, label: s.label, ...mods[s.key] }));

  function toggle(key) {
    setMods((cur) => {
      const next = { ...cur };
      if (next[key]) delete next[key];
      else next[key] = { cap: '', unit: '', detail: '' };
      return next;
    });
  }
  const setField = (key, field, value) => setMods((cur) => ({ ...cur, [key]: { ...cur[key], [field]: value } }));

  function submit(e) {
    e.preventDefault();
    setLocalError('');
    if (!name.trim()) return setLocalError('Nama project wajib diisi.');
    if (!/^\d{4}$/.test(year.trim())) return setLocalError('Tahun harus 4 angka, mis. 2026.');
    onSubmit({
      name: name.trim(),
      year: year.trim(),
      modules: chosen.map((m) => ({ key: m.key, cap: String(m.cap).trim(), unit: m.unit, detail: m.detail })),
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

      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <fieldset key={g.key} className="bg-panel border border-line rounded-lg p-4 sm:p-5 shadow-sm">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-inkmute">{g.label}</legend>
            <div className="flex flex-col gap-3">
              {g.items.map((s) => {
                const on = !!mods[s.key];
                const m = mods[s.key] || {};
                const unitOptions = m.unit && !ARCHIVE_UNITS.includes(m.unit) ? [...ARCHIVE_UNITS, m.unit] : ARCHIVE_UNITS;
                return (
                  <div key={s.key} className={`rounded-md border px-3 py-2.5 ${on ? 'border-blueprint/50 bg-blueprint/5' : 'border-line'}`}>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 accent-blueprint" checked={on} onChange={() => toggle(s.key)} />
                      <span className="text-sm font-medium text-ink">{moduleLabel(s)}</span>
                    </label>
                    {on && (s.hasCap || s.hasDetail) && (
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-[120px_120px_1fr] gap-3">
                        {s.hasCap && (
                          <label className="flex flex-col gap-1">
                            <span className="text-xs text-inkmute">Kapasitas</span>
                            <input className="input font-data" inputMode="decimal" value={m.cap} onChange={(e) => setField(s.key, 'cap', e.target.value)} placeholder="mis. 40" />
                          </label>
                        )}
                        {s.hasUnit && (
                          <label className="flex flex-col gap-1">
                            <span className="text-xs text-inkmute">Satuan</span>
                            <select className="input" value={m.unit} onChange={(e) => setField(s.key, 'unit', e.target.value)}>
                              <option value="">-</option>
                              {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </label>
                        )}
                        {s.hasDetail && (
                          <label className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                            <span className="text-xs text-inkmute">Detail spesifikasi (opsional)</span>
                            <textarea className="input font-data text-xs" rows={3} value={m.detail} onChange={(e) => setField(s.key, 'detail', e.target.value)} placeholder="Model, material, qty, dll." maxLength={4000} />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {shownError && <p className="text-sm text-rust bg-rust/10 border border-rust/30 rounded-md px-3 py-2" role="alert">{shownError}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : submitLabel}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Batal</button>
        <span className="text-xs text-inkmute">Tersimpan langsung ke tab [ARSIP] FINISHED PROJECT di spreadsheet.</span>
      </div>
    </form>
  );
}
