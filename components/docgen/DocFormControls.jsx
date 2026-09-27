import { isNumericField } from '../../lib/docgen/schema';

function numProps(id) {
  return isNumericField(id) ? { type: 'number', min: 0, step: 'any', inputMode: 'decimal' } : { type: 'text' };
}

// Grid kartu checkbox untuk pilih modul (dipakai di form Commissioning).
export function ModuleToggleGrid({ modules, values, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {modules.map((m) => {
        const active = !!values[m.id];
        return (
          <label
            key={m.id}
            className={`cursor-pointer text-center text-sm font-medium border rounded-lg py-3 px-2 transition-colors ${
              active ? 'bg-blueprint text-white border-blueprint' : 'bg-canvas text-ink border-line hover:border-blueprint/50'
            }`}
          >
            <input type="checkbox" className="sr-only" checked={active} onChange={(e) => onChange(m.id, e.target.checked)} />
            {m.label}
          </label>
        );
      })}
    </div>
  );
}

export function TextField({ label, id, value, placeholder, onChange, required, invalid }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-inkmute font-medium">{label}{required ? ' *' : ''}</span>
      <input
        id={id}
        className={`input ${invalid ? 'border-rust ring-1 ring-rust' : ''}`}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(id, e.target.value)}
        {...numProps(id)}
      />
    </label>
  );
}

function MeasureField({ field, value, unitValue, onChange }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-inkmute font-medium">{field.label}</span>
      <div className="flex gap-2">
        <input
          className="input flex-[2]"
          placeholder={field.placeholder}
          value={value ?? ''}
          onChange={(e) => onChange(field.id, e.target.value)}
          {...numProps(field.id)}
        />
        <select className="input flex-1" value={unitValue ?? field.options[0]} onChange={(e) => onChange(field.unitId, e.target.value)}>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    </label>
  );
}

function GroupField({ field, values, onChange }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="text-inkmute font-medium">{field.label}</span>
      <div className="flex flex-wrap gap-2">
        {field.items.map((it) => (
          <input
            key={it.id}
            className="input"
            style={{ flex: it.flex, minWidth: 90 }}
            placeholder={it.placeholder}
            value={values[it.id] ?? ''}
            onChange={(e) => onChange(it.id, e.target.value)}
            {...numProps(it.id)}
          />
        ))}
      </div>
    </div>
  );
}

function TextAreaField({ field, value, onChange }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-inkmute font-medium">{field.label}</span>
      <textarea className="input" rows={3} placeholder={field.placeholder} value={value ?? ''} onChange={(e) => onChange(field.id, e.target.value)} />
    </label>
  );
}

// Merender satu baris field sesuai tipenya: 'text' | 'measure' | 'group' | 'textarea' | 'subheading'.
export function FieldRow({ field, values, onChange }) {
  if (field.type === 'subheading') {
    return <h5 className="text-xs font-bold uppercase tracking-wide text-blueprint border-b border-line pb-1.5 mt-2">{field.label}</h5>;
  }
  if (field.type === 'measure') {
    return <MeasureField field={field} value={values[field.id]} unitValue={values[field.unitId]} onChange={onChange} />;
  }
  if (field.type === 'group') {
    return <GroupField field={field} values={values} onChange={onChange} />;
  }
  if (field.type === 'textarea') {
    return <TextAreaField field={field} value={values[field.id]} onChange={onChange} />;
  }
  return <TextField label={field.label} id={field.id} value={values[field.id]} placeholder={field.placeholder} onChange={onChange} />;
}

// Satu section Hand Over: header + checkbox toggle, field-fieldnya tampil kalau dicentang.
export function ToggleSection({ section, values, onChange }) {
  const active = !!values[section.toggleId];
  return (
    <div className="border border-line rounded-lg overflow-hidden">
      <label className="flex items-center gap-3 px-4 py-3 bg-canvas cursor-pointer select-none">
        <input
          type="checkbox"
          className="w-4 h-4 accent-blueprint"
          checked={active}
          onChange={(e) => onChange(section.toggleId, e.target.checked)}
        />
        <span className="font-display font-semibold text-ink">{section.title}</span>
      </label>
      {active && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 bg-panel">
          {section.fields.map((f, i) => (
            <div
              key={f.id || `${f.label}-${i}`}
              className={f.type === 'textarea' || f.type === 'group' || f.type === 'subheading' ? 'sm:col-span-2' : ''}
            >
              <FieldRow field={f} values={values} onChange={onChange} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
