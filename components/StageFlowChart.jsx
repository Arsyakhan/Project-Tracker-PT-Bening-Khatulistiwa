import Link from 'next/link';
import { STAGE_PHASES } from '../lib/stagePhases';
import { STAGES } from '../lib/stages';

// "Posisi project di alur": 12 tahap dari PO sampai Hand Over digambar sebagai satu jalur proses (seperti garis pada
// diagram alir), dikelompokkan per fase. Tiap tahap menunjukkan jumlah project yang sedang berada di sana; batang
// tumbuh dari jalur. Klik sebuah tahap untuk membuka Semua Project dengan filter tahap itu.
// Warna hanya untuk arti: biru = sedang dikerjakan, hijau = selesai (Hand Over), merah = ada yang terhambat.

const SHORT = {
  'BOM, PID, EWD, GAD': 'BOM, P&ID, EWD, GAD',
  'Procurement of Material': 'Procurement',
  'Collecting Material / Inspection': 'Collecting / Inspection',
  'Preparation Manual Book': 'Manual Book',
  'Hand Over and Finished': 'Hand Over',
};
const FINAL = 'Hand Over and Finished';

function stageHref(stage) {
  return `/projects?stage=${encodeURIComponent(stage)}`;
}

export default function StageFlowChart({ projects }) {
  const byStage = Object.fromEntries(STAGES.map((s) => [s, { total: 0, blocked: 0 }]));
  let other = 0;
  projects.forEach((p) => {
    const row = byStage[p.currentStage];
    if (!row) { other += 1; return; }
    row.total += 1;
    if (p.blocker) row.blocked += 1;
  });
  const max = Math.max(1, ...STAGES.map((s) => byStage[s].total));
  const lastWithProject = STAGES.reduce((acc, s, i) => (byStage[s].total > 0 ? i : acc), -1);

  return (
    <div className="flex flex-col gap-4">
      {/* Layar lebar: jalur mendatar */}
      <div className="hidden md:flex items-stretch" role="list" aria-label="Jumlah project per tahap">
        {STAGE_PHASES.map((phase, pi) => (
          <div key={phase.id} className="flex flex-col min-w-0" style={{ flex: phase.stages.length }}>
            <div className="flex items-stretch">
              {phase.stages.map((stage) => {
                const idx = STAGES.indexOf(stage);
                const { total, blocked } = byStage[stage];
                const h = total === 0 ? 0 : Math.max(10, Math.round((total / max) * 100));
                const done = stage === FINAL;
                return (
                  <Link
                    key={stage}
                    href={stageHref(stage)}
                    role="listitem"
                    title={`${stage}: ${total} project${blocked ? `, ${blocked} terhambat` : ''}`}
                    className="group flex-1 min-w-0 flex flex-col items-center rounded-lg pt-2 hover:bg-canvas focus-visible:bg-canvas transition-colors"
                  >
                    <span className={`font-display tnum text-lg font-semibold leading-none ${total === 0 ? 'text-inkmute/50' : done ? 'text-teal' : 'text-ink'}`}>
                      {total}
                    </span>
                    <span className="h-3.5 mt-1 text-[11px] leading-[14px] font-medium text-rust tnum">{blocked > 0 ? `${blocked} terhambat` : ''}</span>
                    <span className="relative w-full h-[104px] flex items-end justify-center">
                      <span
                        className={`w-[38%] max-w-[34px] rounded-t-md transition-[height] duration-500 ease-standard ${done ? 'bg-teal' : 'bg-blueprint'} ${total === 0 ? '' : 'group-hover:opacity-90'}`}
                        style={{ height: `${h}%` }}
                      />
                      {blocked > 0 && (
                        <span className="absolute bottom-0 w-[38%] max-w-[34px] rounded-t-sm bg-rust" style={{ height: `${Math.max(6, Math.round((blocked / max) * 100))}%` }} aria-hidden="true" />
                      )}
                    </span>
                    {/* Jalur: garis penuh sampai tahap terakhir yang berisi project */}
                    <span className="relative w-full h-4 flex items-center justify-center" aria-hidden="true">
                      <span className={`absolute inset-x-0 h-0.5 ${idx <= lastWithProject ? 'bg-blueprint/70' : 'bg-line'}`} />
                      <span className={`relative w-2.5 h-2.5 rounded-full border-2 ${total > 0 ? (done ? 'bg-teal border-teal' : 'bg-blueprint border-blueprint') : 'bg-panel border-line'}`} />
                    </span>
                    <span className="mt-1.5 px-1 pb-2 text-xs leading-snug text-center text-inkmute group-hover:text-ink line-clamp-2 min-h-[2.75em]">
                      {SHORT[stage] || stage}
                    </span>
                  </Link>
                );
              })}
            </div>
            <div className={`mx-1 mt-1 border-t-2 pt-2 ${pi === 3 ? 'border-teal/50' : 'border-line'}`}>
              <span className="block text-xs font-semibold text-ink truncate">{phase.label}</span>
              <span className="block text-xs text-inkmute tnum">
                {phase.stages.reduce((n, s) => n + byStage[s].total, 0)} project
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* HP: daftar per fase dengan batang mendatar */}
      <div className="md:hidden flex flex-col gap-4">
        {STAGE_PHASES.map((phase) => (
          <div key={phase.id}>
            <p className="text-xs font-semibold text-ink mb-1.5">{phase.label}</p>
            <ul className="flex flex-col gap-1">
              {phase.stages.map((stage) => {
                const { total, blocked } = byStage[stage];
                const done = stage === FINAL;
                return (
                  <li key={stage}>
                    <Link href={stageHref(stage)} className="grid grid-cols-[8.5rem_minmax(0,1fr)_2rem] items-center gap-3 py-1.5 min-h-[40px]">
                      <span className="min-w-0">
                        <span className="block text-sm text-ink truncate">{SHORT[stage] || stage}</span>
                        {blocked > 0 && <span className="block text-xs font-medium text-rust">{blocked} terhambat</span>}
                      </span>
                      <span className="h-2 rounded-full bg-line/60 overflow-hidden">
                        <span className={`block h-full rounded-full ${done ? 'bg-teal' : 'bg-blueprint'}`} style={{ width: `${(total / max) * 100}%` }} />
                      </span>
                      <span className={`text-sm font-semibold tnum text-right ${total === 0 ? 'text-inkmute' : 'text-ink'}`}>{total}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {other > 0 && (
        <p className="text-xs text-amberink">
          {other} project memakai stage yang tidak dikenal (mungkin salah ketik di spreadsheet) dan tidak tergambar di jalur.
        </p>
      )}
    </div>
  );
}
