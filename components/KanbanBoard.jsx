import { useEffect, useState } from 'react';
import Link from 'next/link';
import { STAGE_PHASES } from '../lib/stagePhases';
import { STAGES, STAGE_WEIGHTS } from '../lib/stages';

const PRIORITY_DOT = {
  High: 'bg-rust',
  Medium: 'bg-amber',
  Low: 'bg-inkmute/50',
};

function isNum(v) {
  return typeof v === 'number' && !Number.isNaN(v);
}

function DeadlineBadge({ p }) {
  if (p.stageProgress >= 90 || !p.deliveryDate || !isNum(p.daysRemaining)) return null;
  const d = p.daysRemaining;
  const cls =
    d < 0
      ? 'bg-rust/10 text-rust border border-rust/20'
      : d <= 14
      ? 'bg-amber/10 text-amberink border border-amber/20'
      : 'bg-canvas text-inkmute border border-line';
  return (
    <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 whitespace-nowrap ${cls}`}>
      {d < 0 ? `Terlewat ${Math.abs(d)} hari` : d === 0 ? 'Hari ini' : `${d} hari lagi`}
    </span>
  );
}

function Card({ p, busy, dragging, onDragStart, onDragEnd, onMove }) {
  const doc = isNum(p.engineeringDocProgress) ? p.engineeringDocProgress : 0;
  const knownStage = STAGES.includes(p.currentStage);

  return (
    <div
      draggable={!busy}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', p.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(p.id);
      }}
      onDragEnd={onDragEnd}
      className={`bg-panel border border-line rounded-lg p-3 flex flex-col gap-2 shadow-sm transition-opacity ${
        busy ? 'cursor-wait' : 'cursor-grab active:cursor-grabbing'
      } ${dragging ? 'opacity-40' : 'opacity-100'}`}
    >
      <div className="flex items-start gap-2">
        {p.priority && (
          <span
            title={`Priority: ${p.priority}`}
            className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[p.priority] || 'bg-inkmute/50'}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={`/projects/${encodeURIComponent(p.id)}`}
            draggable={false}
            className="text-sm font-semibold text-ink hover:text-blueprint leading-snug line-clamp-2"
          >
            {p.projectName}
          </Link>
          <p className="text-xs text-inkmute truncate mt-0.5">
            {[p.poNumber, p.client].filter(Boolean).join(' · ') || '-'}
          </p>
          {p.blocker && <p className="text-[11px] font-medium text-rust truncate mt-1" title={p.blocker}>Terhambat: {p.blocker}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] text-inkmute">
          <span>Dok Engineering</span>
          <span className="font-semibold text-ink">{doc}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-line overflow-hidden">
          <div className="h-full rounded-full bg-blueprint" style={{ width: `${Math.min(doc, 100)}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <DeadlineBadge p={p} />
        <select
          aria-label={`Pindahkan ${p.projectName} ke stage lain`}
          value={p.currentStage || ''}
          disabled={busy}
          onChange={(e) => onMove(p, e.target.value)}
          className="ml-auto max-w-[9rem] border border-line rounded bg-canvas text-[11px] text-inkmute px-1.5 py-1 outline-none focus:border-blueprint"
        >
          {!knownStage && <option value={p.currentStage || ''}>{p.currentStage || '(tanpa stage)'}</option>}
          {STAGES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// Papan dikelompokkan per FASE: 4 kolom di layar lebar, 2 kolom di tablet, daftar bertingkat di HP.
// Di dalam tiap fase ada tahapnya. Tahap kosong tetap bisa jadi tujuan seret, tetapi hanya setipis satu baris
// (di HP disembunyikan karena seret-lepas tidak nyaman di layar sentuh; di sana pakai menu tahap di kartu).
const PHASE_GRID = 'grid grid-cols-1 md:grid-cols-2 min-[1340px]:grid-cols-4 gap-3 items-start';

export default function KanbanBoard({ projects, busy, onMove }) {
  const [draggingId, setDraggingId] = useState(null);
  const [overStage, setOverStage] = useState(null);
  // Hanya berlaku di layar HP: fase yang dilipat. Fase tanpa project terlipat dengan sendirinya, kecuali
  // pengguna membukanya. Di layar lebar semua fase selalu terbuka.
  const [folded, setFolded] = useState({});

  // Project dengan stage yang tidak dikenal (mis. salah ketik di sheet) tetap ditampilkan
  const orphans = projects.filter((p) => !STAGES.includes(p.currentStage));
  const phases = STAGE_PHASES.map((phase) => {
    const stages = phase.stages.map((stage) => ({ stage, items: projects.filter((p) => p.currentStage === stage) }));
    const items = stages.flatMap((s) => s.items);
    return { ...phase, stages, total: items.length, blocked: items.filter((p) => p.blocker).length };
  });

  function handleDrop(e, stage) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggingId;
    setOverStage(null);
    setDraggingId(null);
    if (busy) return;
    const project = projects.find((p) => p.id === id);
    if (project && project.currentStage !== stage) onMove(project, stage);
  }

  // Papan tujuan baru dipasang sesaat SETELAH seretan berjalan. Kalau dipasang seketika, papan itu bisa menutupi
  // titik kartu yang sedang dipegang dan Chrome membatalkan seretan itu.
  const [trayOn, setTrayOn] = useState(false);
  useEffect(() => {
    if (!draggingId) {
      setTrayOn(false);
      return undefined;
    }
    const t = setTimeout(() => setTrayOn(true), 80);
    return () => clearTimeout(t);
  }, [draggingId]);

  const draggedStage = draggingId ? (projects.find((p) => p.id === draggingId) || {}).currentStage : null;

  const dnd = {
    draggingId,
    overStage,
    setOverStage,
    onDrop: handleDrop,
    onDragStart: setDraggingId,
    onDragEnd: () => {
      setDraggingId(null);
      setOverStage(null);
    },
  };

  return (
    <div className="flex flex-col gap-3">
      <div className={PHASE_GRID}>
        {phases.map((phase) => {
          const isFolded = folded[phase.id] ?? phase.total === 0;
          return (
            <section key={phase.id} aria-label={phase.label} className="rounded-lg border border-line bg-canvas min-w-0">
              <PhaseHeader
                phase={phase}
                folded={isFolded}
                onToggle={() => setFolded((f) => ({ ...f, [phase.id]: !isFolded }))}
              />
              <div
                id={`fase-${phase.id}`}
                className={`p-1.5 flex-col gap-1 md:max-h-[70vh] md:overflow-y-auto ${isFolded ? 'hidden md:flex' : 'flex'}`}
              >
                {phase.total === 0 && (
                  <p className="md:hidden text-xs text-inkmute px-1.5 py-2">Belum ada project di fase ini.</p>
                )}
                {phase.stages.map(({ stage, items }) => (
                  <StageZone key={stage} stage={stage} items={items} busy={busy} dnd={dnd} onMove={onMove} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {orphans.length > 0 && (
        <section aria-label="Stage lain atau kosong" className="rounded-lg border border-amber/40 bg-amber/5">
          <div className="px-3 py-2.5 border-b border-amber/30 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">Stage lain / kosong</h2>
              <p className="text-xs text-inkmute mt-0.5">
                Stage project ini tidak cocok dengan 12 stage baku (mungkin salah ketik di spreadsheet). Pilih stage yang benar lewat menu di kartu.
              </p>
            </div>
            <CountPill n={orphans.length} />
          </div>
          <div className="p-2 grid grid-cols-1 sm:grid-cols-2 min-[1340px]:grid-cols-4 gap-2">
            {orphans.map((p) => (
              <Card
                key={p.id}
                p={p}
                busy={busy}
                dragging={draggingId === p.id}
                onDragStart={dnd.onDragStart}
                onDragEnd={dnd.onDragEnd}
                onMove={onMove}
              />
            ))}
          </div>
        </section>
      )}

      {trayOn && draggingId && <DropTray current={draggedStage} dnd={dnd} />}
    </div>
  );
}

// Papan tujuan yang muncul selama kartu diseret (layar lebar saja). Semua 12 tahap terlihat sekaligus,
// jadi kartu bisa dilepas ke tahap mana pun tanpa menggulir kolom. Khusus mouse; keyboard dan HP memakai
// menu tahap di kartu.
function DropTray({ current, dnd }) {
  return (
    <div
      aria-hidden="true"
      className="hidden md:block fixed inset-x-0 bottom-0 md:left-64 z-30 border-t border-line bg-panel shadow-lg"
    >
      <div className="max-w-6xl mx-auto px-10 py-3">
        <p className="text-xs font-medium text-inkmute mb-2">Lepas kartu di salah satu tahap untuk memindahkannya</p>
        <div className="grid grid-cols-2 min-[1340px]:grid-cols-4 gap-x-4 gap-y-2">
          {STAGE_PHASES.map((phase) => (
            <div key={phase.id} className="min-w-0">
              <p className="text-xs font-semibold text-ink mb-1">{phase.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {phase.stages.map((stage) => (
                  <TrayChip key={stage} stage={stage} here={stage === current} dnd={dnd} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrayChip({ stage, here, dnd }) {
  const isOver = !here && dnd.overStage === stage;
  return (
    <div
      onDragOver={(e) => {
        if (here) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dnd.overStage !== stage) dnd.setOverStage(stage);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) dnd.setOverStage(null);
      }}
      onDrop={(e) => {
        if (!here) dnd.onDrop(e, stage);
      }}
      className={`min-h-[36px] inline-flex items-center rounded-md border px-2.5 text-xs font-medium transition-colors ${
        here
          ? 'border-line text-inkmute opacity-70'
          : isOver
          ? 'border-blueprint bg-blueprint/10 text-blueprint'
          : 'border-line bg-canvas text-ink'
      }`}
    >
      {stage}
      {here && <span className="font-normal">&nbsp;(sekarang)</span>}
    </div>
  );
}

function CountPill({ n }) {
  return (
    <span className="text-xs font-bold text-inkmute bg-panel border border-line rounded-full px-2 py-0.5 tnum flex-shrink-0">
      {n}
      <span className="sr-only"> project</span>
    </span>
  );
}

// Judul fase. HP: tombol untuk melipat/membuka. Layar lebar: judul biasa (tidak bisa dilipat).
function PhaseHeader({ phase, folded, onToggle }) {
  const info = (
    <>
      <span className="min-w-0 text-left">
        <span className="block text-sm font-semibold text-ink leading-snug">{phase.label}</span>
        <span className="block text-xs text-inkmute">
          {phase.stages.length} tahap
          {phase.blocked > 0 && <span className="font-medium text-rust"> · {phase.blocked} terhambat</span>}
        </span>
      </span>
      <CountPill n={phase.total} />
    </>
  );
  return (
    <>
      <h2 className={`md:hidden ${folded ? '' : 'border-b border-line'}`}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!folded}
          aria-controls={`fase-${phase.id}`}
          className="w-full min-h-[52px] px-3 py-2 flex items-center justify-between gap-3"
        >
          {info}
          <svg
            className={`w-4 h-4 flex-shrink-0 text-inkmute transition-transform ${folded ? '-rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </h2>
      <h2 className="hidden md:flex px-3 py-2.5 border-b border-line items-center justify-between gap-2">{info}</h2>
    </>
  );
}

// Satu tahap di dalam fase: tempat kartu, sekaligus tujuan seret-lepas untuk pindah tahap.
function StageZone({ stage, items, busy, dnd, onMove }) {
  const isOver = dnd.overStage === stage;
  const empty = items.length === 0;
  const titleId = `tahap-${stage.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  return (
    <div
      role="group"
      aria-labelledby={titleId}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dnd.overStage !== stage) dnd.setOverStage(stage);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) dnd.setOverStage(null);
      }}
      onDrop={(e) => dnd.onDrop(e, stage)}
      className={`rounded-md border p-1 transition-colors ${
        isOver ? 'border-blueprint bg-blueprint/5' : 'border-transparent'
      } ${empty ? 'hidden md:block' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 px-0.5 pb-1.5">
        <h3 id={titleId} className="min-w-0 text-xs font-semibold text-ink leading-snug">
          {stage}
          {STAGE_WEIGHTS[stage] !== undefined && <span className="font-normal text-inkmute"> · {STAGE_WEIGHTS[stage]}%</span>}
        </h3>
        <span className="text-xs font-bold text-inkmute tnum flex-shrink-0">{items.length}</span>
      </div>
      {empty ? (
        <p className="rounded-md border border-dashed border-line px-2 py-2.5 text-xs text-inkmute text-center">
          {dnd.draggingId ? 'Lepas di sini' : 'Kosong'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((p) => (
            <Card
              key={p.id}
              p={p}
              busy={busy}
              dragging={dnd.draggingId === p.id}
              onDragStart={dnd.onDragStart}
              onDragEnd={dnd.onDragEnd}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
