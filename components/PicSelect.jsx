import { useMemo, useState } from 'react';
import { picOptions } from '../lib/pics';

const OTHER = '__lainnya__';

// Dropdown PIC project. Pilihan: divisi/peran, lalu nama (lib/pics.js). Nilai lama yang tidak ada di daftar tetap
// muncul sebagai satu pilihan supaya tidak hilang diam-diam. "Lainnya..." membuka kolom ketik untuk nama baru.
// existing = daftar PIC yang sudah dipakai di project (dari data), supaya tulisannya seragam dengan sheet.
export default function PicSelect({ id, value, onChange, existing, disabled = false, className = 'input' }) {
  const opts = useMemo(() => picOptions(existing), [existing]);
  const text = String(value || '');
  const [custom, setCustom] = useState(false);
  const known = !text || opts.roles.includes(text) || opts.names.includes(text);

  function pick(v) {
    if (v === OTHER) {
      setCustom(true);
      onChange('');
      return;
    }
    setCustom(false);
    onChange(v);
  }

  return (
    <>
      <select id={id} className={className} value={custom ? OTHER : text} disabled={disabled} onChange={(e) => pick(e.target.value)}>
        <option value="">Pilih PIC</option>
        {!known && !custom && <option value={text}>{text} (isian lama)</option>}
        <optgroup label="Divisi / peran">
          {opts.roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </optgroup>
        <optgroup label="Nama">
          {opts.names.map((n) => <option key={n} value={n}>{n}</option>)}
        </optgroup>
        <option value={OTHER}>Lainnya (ketik sendiri)...</option>
      </select>
      {custom && (
        <input
          className={className}
          aria-label="Nama PIC"
          maxLength={200}
          placeholder="Tulis nama PIC"
          autoFocus
          value={text}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </>
  );
}
