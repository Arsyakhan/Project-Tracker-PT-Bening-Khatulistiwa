import { FieldRow } from './docgen/DocFormControls';
import { sectionProgress, overallProgress } from '../lib/docgen/specs';

function Bar({ percent, tone }) {
  return (
    <div className="h-1.5 w-16 bg-line/60 rounded-full overflow-hidden shrink-0">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

// Tab "Spesifikasi Peralatan": satu seksi per sistem terpasang, isinya sama dengan form Hand Over.
export default function SpecsEditor({
  sections,          // seksi yang relevan untuk project ini
  values,            // nilai semua field
  onChange,          // (id, value) => void
  loading,
  error,
  onRetry,
  onGoSummary,       // pindah ke tab Ringkasan (untuk memilih sistem terpasang)
  scopeText,         // "Lingkup pesanan" sebagai contekan (hanya baca)
  oldSpecText,       // catatan lama dari kolom Spesifikasi Teknologi (hanya baca)
  version,
}) {
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
        <p className="font-display font-semibold text-ink">Belum ada sistem yang dipilih</p>
        <p className="text-sm text-inkmute">
          Kolom spesifikasi muncul sesuai sistem terpasang (RO, UF, Softener, dst.). Pilih sistemnya dulu di tab Ringkasan.
        </p>
        <button onClick={onGoSummary} className="text-sm font-medium text-blueprint hover:underline">Pilih sistem terpasang</button>
      </div>
    );
  }

  const total = overallProgress(sections, values);
  const hasRef = String(scopeText || '').trim() || String(oldSpecText || '').trim();

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-panel border border-line rounded-lg p-5 flex flex-col gap-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-ink">Spesifikasi peralatan</h2>
            <p className="text-xs text-inkmute mt-1">
              Diisi sekali di sini, lalu form Hand Over terisi otomatis. Tersimpan bersama tombol Simpan perubahan.
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
        {version > 0 && <p className="text-xs text-inkmute">Versi tersimpan: {version}</p>}
      </div>

      {hasRef && (
        <details className="bg-canvas border border-line rounded-lg group">
          <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-ink flex items-center justify-between">
            Contekan: lingkup pesanan
            <span className="text-xs text-inkmute font-normal">hanya baca</span>
          </summary>
          <div className="px-4 pb-3 flex flex-col gap-2">
            {String(scopeText || '').trim() && <p className="text-sm text-ink/90 whitespace-pre-wrap break-words">{scopeText}</p>}
            {String(oldSpecText || '').trim() && (
              <p className="text-sm text-inkmute whitespace-pre-wrap break-words border-t border-line pt-2">{oldSpecText}</p>
            )}
          </div>
        </details>
      )}

      {sections.map((section, idx) => {
        const p = sectionProgress(section, values);
        const percent = p.total > 0 ? Math.round((p.filled / p.total) * 100) : 0;
        return (
          <details key={section.key} open={idx === 0} className="bg-panel border border-line rounded-lg overflow-hidden shadow-sm group">
            <summary className="cursor-pointer select-none flex items-center gap-3 px-4 py-3 bg-canvas/60 hover:bg-canvas transition-colors list-none [&::-webkit-details-marker]:hidden">
              <svg className="w-4 h-4 text-inkmute transition-transform group-open:rotate-90 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-display font-semibold text-ink flex-1 min-w-0 truncate">{section.title}</span>
              <span className={`text-xs font-data tnum ${percent >= 100 ? 'text-teal' : 'text-inkmute'}`}>{p.filled}/{p.total}</span>
              <Bar percent={percent} tone={percent >= 100 ? 'bg-teal' : 'bg-blueprint'} />
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
              {section.fields.map((f, i) => (
                <div
                  key={f.id || `${f.label}-${i}`}
                  className={f.type === 'textarea' || f.type === 'group' || f.type === 'subheading' ? 'sm:col-span-2' : ''}
                >
                  <FieldRow field={f} values={values} onChange={onChange} />
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
