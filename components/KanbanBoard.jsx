import { useEffect, useState } from 'react';
import Link from 'next/link';
import { STAGE_PHASES } from '../lib/stagePhases';
import { STAGES, STAGE_WEIGHTS } from '../lib/stages';
import NextActionLine from './NextActionLine';
import { nextActionInfo } from '../lib/nextAction';

// Garis tepi kiri kartu = prioritas (warna sama dengan lencana prioritas di tabel).
const PRIORITY_EDGE = {
  High: 'before:bg-rust',
  Medium: 'before:bg-amber',
  Low: 'before:bg-line',
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
      ? 'bg-amber/10 text-amberink border border-amber/25'
      : 'bg-canvas text-inkmute border border-line';
  return (
    <span className={`text-xs font-medium rounded-md px-1.5 leading-5 whitespace-nowrap shrink-0 ${cls}`}>
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
      className={`relative bg-panel border border-line rounded-lg pl-3.5 pr-3 py-3 flex flex-col gap-1.5 shadow-sm transition-[opacity,box-shadow,border-color] hover:border-blueprint/40 hover:shadow-md before:absolute before:left-0 before:inset-y-2.5 before:w-[3px] before:rounded-r ${
        PRIORITY_EDGE[p.priority] || 'before:bg-line'
      } ${busy ? 'cursor-wait' : 'cursor-grab active:cursor-grabbing'} ${dragging ? 'opacity-40' : 'opacity-100'}`}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="font-data text-xs text-inkmute truncate" title={p.poNumber || ''}>{p.poNumber || 'Tanpa PO'}</span>
        <DeadlineBadge p={p} />
      </div>
      <Link
        href={`/projects/${encodeURIComponent(p.id)}`}
        draggable={false}
        className="text-sm font-semibold text-ink hover:text-blueprint leading-snug line-clamp-2 max-md:line-clamp-none max-md:py-1"
      >
        {p.projectName}
      </Link>
      <p className="text-xs text-inkmute truncate">
        {[p.client, p.pic && `PIC ${p.pic}`].filter(Boolean).join(' · ') || '-'}
        {p.priority && <span className="sr-only">, prioritas {p.priority}</span>}
      </p>
      <NextActionLine info={nextActionInfo(p)} className="mt-0.5" />

      <div className="flex items-center gap-2 pt-2 mt-0.5 border-t border-line/70">
        <span className="flex items-baseline gap-1 shrink-0 text-xs" title={`Dokumen engineering ${doc}%`}>
          <span className="text-inkmute">Dokumen</span>
          <span className={`font-data tnum font-medium ${doc >= 100 ? 'text-teal' : 'text-ink'}`}>{doc}%</span>
        </span>
        {/* Nilainya selalu kosong supaya tampil "Pindah tahap"; tahap sekarang ditandai dan tidak bisa dipilih. */}
        <select
          aria-label={`Pindahkan ${p.projectName} ke tahap lain (sekarang ${p.currentStage || 'tanpa stage'})`}
          value=""
          disabled={busy}
          onChange={(e) => e.target.value && onMove(p, e.target.value)}
          className="ml-auto w-[8rem] shrink-0 rounded-md border border-transparent bg-transparent text-xs font-medium text-blueprint pl-1.5 pr-1 py-1 hover:border-line hover:bg-canvas focus:border-blueprint outline-none cursor-pointer max-md:w-auto max-md:flex-1 max-md:min-h-[40px] max-md:text-base max-md:border-line max-md:bg-canvas"
        >
          <option value="" disabled>Pindah tahap</option>
          {!knownStage && <option value="" disabled>{p.currentStage || '(tanpa stage)'} (sekarang)</option>}
          {STAGES.map((s) => (
            <option key={s} value={s} disabled={s === p.currentStage}>{s}{s === p.currentStage ? ' (sekarang)' : ''}</option>
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
            <section key={phase.id} aria-label={phase.label} className="rounded-xl border border-line bg-line/25 min-w-0">
              <PhaseHeader
                phase={phase}
                folded={isFolded}
                onToggle={() => setFolded((f) => ({ ...f, [phase.id]: !isFolded }))}
              />
              <div
                id={`fase-${phase.id}`}
                className={`p-2 flex-col gap-1.5 md:max-h-[72vh] md:overflow-y-auto ${isFolded ? 'hidden md:flex' : 'flex'}`}
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
                Stage project ini tidak cocok dengan 12 stage baku (mungkin salah ketik di spreadsheet). Pilih stage yang benar melalui menu pada kartu.
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
    <span className="font-data text-xs font-semibold text-ink bg-panel border border-line rounded-md px-2 leading-6 tnum flex-shrink-0">
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
      <h2 className="hidden md:flex px-3.5 py-3 border-b border-line items-center justify-between gap-2 bg-panel/70 rounded-t-xl">{info}</h2>
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
      <div className="flex items-start justify-between gap-2 px-1 pt-0.5 pb-1.5">
        <h3 id={titleId} className="min-w-0 text-xs font-semibold text-inkmute leading-snug">
          {stage}
          {STAGE_WEIGHTS[stage] !== undefined && <span className="font-normal text-inkmute"> · {STAGE_WEIGHTS[stage]}%</span>}
        </h3>
        <span className="text-xs font-bold text-inkmute tnum flex-shrink-0">{items.length}</span>
      </div>
      {empty ? (
        <p className="rounded-lg border border-dashed border-line px-2 py-2 text-xs text-inkmute text-center">
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
