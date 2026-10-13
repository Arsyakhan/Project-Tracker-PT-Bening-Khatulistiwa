import { useEffect, useRef } from 'react';
import { FieldRow } from './docgen/DocFormControls';
import AddEquipment from './AddEquipment';
import { sectionProgress, overallProgress, fieldKey } from '../lib/docgen/specs';

function Bar({ percent, tone }) {
  return (
    <div className="h-1.5 w-16 bg-line/60 rounded-full overflow-hidden shrink-0">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

// Tab "Spesifikasi Peralatan": mengikuti Teknologi project, SATU modul = SATU seksi (urut sesuai alur). Seksi tidak
// mengikuti pengelompokan template dokumen Hand Over (lib/docgen/specModules.js).
// Kolom yang bisa diturunkan dari Teknologi terisi otomatis (ditandai); mengetik di kolom itu menjadi koreksi manual.
// Koreksi yang berbeda dari Teknologi diberi penanda "Beda dari Teknologi" + tombol untuk kembali ke nilai Teknologi.
// "+ Tambah peralatan" mencentang modul di Teknologi tanpa pindah tab (seksinya langsung muncul dan digulir ke layar).
export default function SpecsEditor({
  sections,          // seksi yang relevan untuk project ini
  values,            // nilai semua field
  onChange,          // (id, value) => void
  loading,
  error,
  onRetry,
  onGoTech,          // pindah ke tab Teknologi (untuk mengisi teknologi project)
  autoIds,           // Set id kolom yang masih nilai otomatis dari Teknologi
  version,
  diffs,             // hasil specDiffs: { byField, bySection, total }
  onResetDiff,       // (diff) => void: kembalikan kolom ke nilai Teknologi
  canEdit = true,    // false untuk peran lihat saja (tombol ubah dimatikan)
  addSchema,         // modul yang boleh ditambah lewat tombol "+ Tambah peralatan"
  ticked,            // Set kunci modul yang sudah dicentang di Teknologi
  pending,           // Set kunci modul yang dicentang tetapi belum tersimpan
  onAddModule,       // (key) => void: centang modul di Teknologi
}) {
  // Setelah modul ditambah lewat tombol, seksi barunya dibuka dan digulir ke layar.
  const prevKeys = useRef(null);
  const wantScroll = useRef(false);
  useEffect(() => {
    const keys = new Set(sections.map((s) => s.key));
    if (wantScroll.current && prevKeys.current) {
      const fresh = sections.find((s) => !prevKeys.current.has(s.key));
      const el = fresh ? document.getElementById(`spec-sec-${fresh.key}`) : null;
      if (el) {
        el.open = true;
        const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }
      wantScroll.current = false;
    }
    prevKeys.current = keys;
  });

  const addBox = onAddModule && addSchema ? (
    <AddEquipment
      schema={addSchema}
      ticked={ticked || new Set()}
      pending={pending}
      disabled={!canEdit}
      onAdd={(key) => { wantScroll.current = true; onAddModule(key); }}
    />
  ) : null;

  if (error) {
    return (
      <div className="bg-panel border border-line rounded-lg p-5 flex flex-col gap-3">
        <p className="text-sm text-rust">Gagal memuat spesifikasi: {error}</p>
        <button onClick={onRetry} className="w-fit text-sm font-medium text-blueprint hover:underline">Coba lagi</button>
      </div>
    );
  }

  if (loading || values === null) {
    return (
      <div className="bg-panel border border-line rounded-lg p-5">
        <p className="text-sm text-inkmute">Memuat spesifikasi peralatan...</p>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="bg-panel border border-line rounded-lg p-6 flex flex-col items-start gap-3">
        <p className="font-display font-semibold text-ink">Teknologi project belum diisi</p>
        <p className="text-sm text-inkmute">
          Kolom spesifikasi muncul sesuai teknologi project (RO, UF, Softener, dst.). Isi teknologinya di tab Teknologi, atau tambah peralatan langsung dari sini.
        </p>
        <button onClick={onGoTech} className="tap text-sm font-medium text-blueprint hover:underline">Isi teknologi</button>
        {addBox}
      </div>
    );
  }

  const total = overallProgress(sections, values);
  const auto = autoIds || new Set();
  const autoCount = (section) => {
    let n = 0;
    section.fields.forEach((f) => {
      if (f.type === 'text' || f.type === 'measure' || f.type === 'textarea') { if (auto.has(f.id)) n += 1; }
      else if (f.type === 'group') f.items.forEach((it) => { if (auto.has(it.id)) n += 1; });
    });
    return n;
  };
  const isAuto = (f) => (f.type === 'group' ? f.items.some((it) => auto.has(it.id)) : auto.has(f.id));
  const autoTotal = sections.reduce((a, sec) => a + autoCount(sec), 0);
  const diffTotal = diffs?.total || 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-panel border border-line rounded-lg p-5 flex flex-col gap-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-ink">Spesifikasi peralatan</h2>
            <p className="text-xs text-inkmute mt-1">
              Satu modul di tab Teknologi = satu seksi di sini. Kapasitas dan teks Detail Spesifikasi ("Label : isi") dibaca ke kolom-kolomnya secara otomatis. Ketik untuk mengoreksi (kolom yang berbeda dari Teknologi diberi tanda); kosongkan kolom untuk kembali otomatis. Form Hand Over memakai data ini.
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="font-data tnum text-lg font-semibold text-blueprint">{total.percent}%</span>
            <p className="text-xs text-inkmute tnum">{total.filled} dari {total.total} kolom</p>
          </div>
        </div>
        <div className="h-2 bg-line/60 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${total.percent >= 100 ? 'bg-teal' : 'bg-blueprint'}`} style={{ width: `${total.percent}%` }} />
        </div>
        {autoTotal > 0 && <p className="text-xs text-teal" role="status">{autoTotal} kolom terisi otomatis dari Teknologi.</p>}
        {diffTotal > 0 && <p className="text-xs text-amberink" role="status">{diffTotal} kolom sudah dikoreksi dan berbeda dari Teknologi (ditandai di bawah).</p>}
        {version > 0 && <p className="text-xs text-inkmute">Versi tersimpan: {version}</p>}
        {addBox}
      </div>

      {sections.map((section, idx) => {
        const p = sectionProgress(section, values);
        const percent = p.total > 0 ? Math.round((p.filled / p.total) * 100) : 0;
        const sectionAuto = autoCount(section);
        const sectionDiff = diffs?.bySection?.[section.key] || 0;
        return (
          <details key={section.key} id={`spec-sec-${section.key}`} open={idx === 0} className="bg-panel border border-line rounded-lg overflow-hidden shadow-sm group scroll-mt-20">
            <summary className="cursor-pointer select-none flex items-center gap-3 px-4 py-3 bg-canvas/60 hover:bg-canvas transition-colors list-none [&::-webkit-details-marker]:hidden">
              <svg className="w-4 h-4 text-inkmute transition-transform group-open:rotate-90 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-display font-semibold text-ink flex-1 min-w-0 truncate">{section.title}</span>
              {sectionDiff > 0 && <span className="text-xs text-amberink whitespace-nowrap hidden sm:inline">{sectionDiff} beda dari Teknologi</span>}
              {sectionAuto > 0 && <span className="text-xs text-teal whitespace-nowrap hidden sm:inline">{sectionAuto} otomatis</span>}
              <span className={`text-xs font-data tnum ${percent >= 100 ? 'text-teal' : 'text-inkmute'}`}>{p.filled}/{p.total}</span>
              <Bar percent={percent} tone={percent >= 100 ? 'bg-teal' : 'bg-blueprint'} />
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
              {section.hint && <p className="sm:col-span-2 text-xs text-inkmute -mb-1">{section.hint}</p>}
              {section.fields.map((f, i) => {
                const diff = f.type === 'subheading' ? null : diffs?.byField?.[fieldKey(f)];
                return (
                  <div
                    key={f.id || `${f.label}-${i}`}
                    className={f.type === 'textarea' || f.type === 'group' || f.type === 'subheading' ? 'sm:col-span-2' : ''}
                  >
                    <FieldRow field={f} values={values} onChange={onChange} />
                    {isAuto(f) && <span className="block text-xs text-teal mt-1">otomatis dari Teknologi</span>}
                    {diff && (
                      <p className="mt-1 text-xs text-amberink flex flex-wrap items-baseline gap-x-2 gap-y-0.5" data-testid="spec-diff">
                        <span>Beda dari Teknologi: <span className="font-data">{diff.text}</span></span>
                        {canEdit && onResetDiff && (
                          <button type="button" onClick={() => onResetDiff(diff)} className="tap font-medium text-blueprint hover:underline">
                            Pakai nilai Teknologi
                          </button>
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
