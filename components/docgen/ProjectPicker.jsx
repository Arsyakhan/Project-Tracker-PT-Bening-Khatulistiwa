import { useMemo, useState } from 'react';

// Pencarian sederhana: ketik nama project / PO Number / client, klik salah satu hasil.
// Dipakai supaya form Generator Dokumen tetap bisa dipakai lepas dari project (standalone),
// tapi juga gampang disambungkan ke project yang sudah ada kalau mau.
export default function ProjectPicker({ projects, onSelect, placeholder }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (projects || [])
      .filter((p) =>
        (p.projectName || '').toLowerCase().includes(q) ||
        (p.poNumber || '').toLowerCase().includes(q) ||
        (p.client || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [projects, query]);

  return (
    <div className="relative">
      <input
        className="input"
        placeholder={placeholder || 'Cari project (nama, PO Number, atau client)...'}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && query.trim() && (
        <div className="absolute z-20 mt-1 w-full bg-panel border border-line rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-inkmute">Tidak ada project yang cocok.</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-canvas transition-colors border-b border-line last:border-0"
                onMouseDown={(e) => e.preventDefault()} // biar onBlur di atas tidak duluan nutup sebelum onClick sempat jalan
                onClick={() => { onSelect(p); setQuery(''); setOpen(false); }}
              >
                <div className="font-medium text-ink">{p.projectName}</div>
                <div className="text-xs text-inkmute">{p.poNumber || '-'} &bull; {p.client || '-'}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
