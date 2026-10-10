import { STAGE_PHASES } from '../lib/stagePhases';

// Jalur tahapan project: seperti garis proses di diagram alir (P&ID) —
// setiap tahap adalah titik, tahap yang sudah lewat terisi, tahap saat ini diberi cincin.
// Klik sebuah titik untuk memindahkan project ke tahap itu (baru tersimpan setelah "Simpan perubahan").

const GROUPS = STAGE_PHASES;

const ALL_STAGES = GROUPS.flatMap((g) => g.stages);

export default function StagePipeline({ current, weights = {}, onSelect }) {
  const currentIdx = ALL_STAGES.indexOf(current);
  const interactive = typeof onSelect === 'function';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2 sm:items-start sm:gap-5">
        {GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-2 min-w-0" style={{ flex: group.stages.length }}>
            <span className="text-xs leading-4 text-inkmute overflow-hidden text-ellipsis sm:truncate" title={group.label}>
              {/* Di HP kolomnya sempit: pakai kata kunci sebelum "&" saja. Nama lengkap ada di tooltip. */}
              <span className="sm:hidden">{group.label.split(' & ')[0]}</span>
              <span className="hidden sm:inline">{group.label}</span>
            </span>
            <div className="flex items-center">
              {group.stages.map((stage, i) => {
                const idx = ALL_STAGES.indexOf(stage);
                const done = currentIdx > idx;
                const active = currentIdx === idx;
                const isLast = i === group.stages.length - 1;
                const weight = weights[stage];
                return (
                  <div key={stage} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
                    <button
                      type="button"
                      disabled={!interactive}
                      onClick={() => onSelect && onSelect(stage)}
                      title={`${stage}${weight != null ? ` (${weight}%)` : ''}`}
                      aria-label={`Tahap ${idx + 1}: ${stage}`}
                      aria-current={active ? 'step' : undefined}
                      className={`shrink-0 p-1.5 -m-1.5 rounded-full ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <span
                        className={`block rounded-full border-2 transition-all ${
                          active
                            ? 'w-[18px] h-[18px] bg-blueprint border-blueprint ring-4 ring-blueprint/20'
                            : done
                              ? 'w-3.5 h-3.5 bg-blueprint border-blueprint'
                              : 'w-3.5 h-3.5 bg-panel border-line hover:border-blueprint/60'
                        }`}
                      />
                    </button>
                    {!isLast && (
                      <span className={`flex-1 h-0.5 mx-1 ${done ? 'bg-blueprint' : 'bg-line'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm text-inkmute">
        {currentIdx >= 0 ? (
          <>
            Tahap <span className="tnum font-medium text-ink">{currentIdx + 1}</span> dari {ALL_STAGES.length}
            <span className="mx-1.5 text-line">|</span>
            <span className="font-medium text-ink">{current}</span>
          </>
        ) : (
          'Tahap belum diatur'
        )}
        {interactive && <span className="hidden sm:inline text-xs ml-3 text-inkmute">Klik titik untuk mengganti tahap</span>}
      </p>
    </div>
  );
}
