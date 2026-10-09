import { useMemo } from 'react';
import { ARCHIVE_UNITS, FLOW_PHASES, stepInfo, moduleLabel } from '../lib/techflow';

// Pemilih modul teknologi (per fase alur): centang modul, isi kapasitas, satuan, dan detail.
// Dipakai bersama oleh form arsip dan tab Teknologi di detail project, supaya datanya identik.
//   schema   = [{ key, label, hasCap, hasUnit, hasDetail }]
//   value    = [{ key, cap, unit, detail }]  (modul yang dicentang)
//   onChange = (array baru, urut sesuai schema) => void
export default function ModulePicker({ schema, value, onChange, detailMax = 4000, disabled = false }) {
  const byKey = useMemo(() => {
    const m = {};
    (value || []).forEach((x) => { m[x.key] = { cap: x.cap || '', unit: x.unit || '', detail: x.detail || '' }; });
    return m;
  }, [value]);

  // Kelompokkan modul per fase alur; modul yang tidak dikenal masuk "Lainnya".
  const groups = useMemo(() => {
    const out = FLOW_PHASES.map((ph) => ({ key: ph.key, label: ph.label, items: [] }));
    const other = { key: 'lain', label: 'Lainnya', items: [] };
    schema.forEach((s) => {
      const info = stepInfo(s.key);
      const g = info ? out.find((x) => x.key === info.phase) : other;
      g.items.push(s);
    });
    return [...out, other].filter((g) => g.items.length);
  }, [schema]);

  function emit(next) {
    onChange(schema.filter((s) => next[s.key]).map((s) => ({ key: s.key, ...next[s.key] })));
  }
  function toggle(key) {
    const next = { ...byKey };
    if (next[key]) delete next[key];
    else next[key] = { cap: '', unit: '', detail: '' };
    emit(next);
  }
  const setField = (key, field, v) => emit({ ...byKey, [key]: { ...byKey[key], [field]: v } });

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <fieldset key={g.key} disabled={disabled} className="bg-panel border border-line rounded-lg p-4 sm:p-5 shadow-sm">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-inkmute">{g.label}</legend>
          <div className="flex flex-col gap-3">
            {g.items.map((s) => {
              const on = !!byKey[s.key];
              const m = byKey[s.key] || {};
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
                          <textarea className="input font-data text-xs" rows={3} value={m.detail} onChange={(e) => setField(s.key, 'detail', e.target.value)} placeholder="Model, material, qty, dll." maxLength={detailMax} />
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
  );
}
