import { useState } from 'react';
import { groupSchemaByPhase, moduleLabel } from '../lib/techflow';

// Tombol "+ Tambah peralatan" di tab Spesifikasi Peralatan: mencentang modul di Teknologi tanpa pindah tab.
// Teknologi tetap satu-satunya sumber: modul yang dipilih ikut tombol "Simpan perubahan" (sama seperti dari tab
// Teknologi), dan seksinya langsung muncul di daftar Spesifikasi.
//   schema   = modul yang boleh dicentang ([{ key, ... }], sama dengan ModulePicker)
//   ticked   = Set kunci modul yang sudah dicentang
//   pending  = Set kunci modul yang dicentang tetapi belum tersimpan (pesan hanya tampil untuk yang ditambah dari sini)
//   onAdd    = (key) => void
//   disabled = tidak boleh mengubah (peran lihat saja)
//   hint / doneNote = teks pengganti (form Hand Over memakainya: tambahan di sana hanya berlaku untuk satu dokumen)
export default function AddEquipment({
  schema, ticked, pending, onAdd, disabled = false, defaultOpen = false,
  hint = 'Pilih peralatan yang belum dicentang di Teknologi. Seksinya langsung muncul di bawah.',
  doneNote = 'Semua modul sudah dicentang di Teknologi.',
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [added, setAdded] = useState([]); // kunci modul yang ditambah lewat tombol ini
  const groups = groupSchemaByPhase((schema || []).filter((s) => !ticked.has(s.key)));
  const remaining = groups.reduce((n, g) => n + g.items.length, 0);
  const shown = (schema || []).filter((s) => added.includes(s.key) && ticked.has(s.key) && pending?.has(s.key));

  function pick(s) {
    onAdd(s.key);
    setAdded((a) => (a.includes(s.key) ? a : [...a, s.key]));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          className="btn btn-secondary h-9 max-md:h-10"
          aria-expanded={open}
          aria-controls="tambah-peralatan"
          disabled={disabled || remaining === 0}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Tutup daftar' : '+ Tambah peralatan'}
        </button>
        {disabled && <span className="text-xs text-inkmute">Peran Anda hanya bisa melihat.</span>}
        {!disabled && remaining === 0 && <span className="text-xs text-inkmute">{doneNote}</span>}
      </div>

      {shown.length > 0 && (
        <p className="text-xs text-teal" role="status">
          {shown.map((s) => moduleLabel(s, true)).join(', ')} ditambahkan ke Teknologi (belum tersimpan). Isi kolomnya di bawah, lalu klik Simpan perubahan; centang modulnya ikut tersimpan.
        </p>
      )}

      {open && remaining > 0 && (
        <div id="tambah-peralatan" className="border border-line rounded-md p-3 sm:p-4 bg-canvas/50 flex flex-col gap-3">
          <p className="text-xs text-inkmute">{hint}</p>
          {groups.map((g) => (
            <div key={g.key} className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-inkmute">{g.label}</p>
              <div className="flex flex-wrap gap-2">
                {g.items.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => pick(s)}
                    aria-label={`Tambah ${moduleLabel(s)}`}
                    title={moduleLabel(s)}
                    className="inline-flex items-center rounded-full border border-line bg-panel px-3 h-9 max-md:h-10 text-sm text-ink hover:border-blueprint/60 hover:bg-blueprint/5 transition-colors"
                  >
                    + {moduleLabel(s, true)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
