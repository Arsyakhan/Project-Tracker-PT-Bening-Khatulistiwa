import { useState } from 'react';
import Link from 'next/link';
import { STAGES, STAGE_WEIGHTS } from '../lib/stages';
import NextActionLine from './NextActionLine';
import { nextActionInfo } from '../lib/nextAction';

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
    <span className={`text-xs font-semibold rounded px-1.5 py-0.5 whitespace-nowrap ${cls}`}>
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
            className="text-sm font-semibold text-ink hover:text-blueprint leading-snug line-clamp-2 max-md:line-clamp-none max-md:py-1.5"
          >
            {p.projectName}
          </Link>
          <p className="text-xs text-inkmute truncate mt-0.5">
            {[p.poNumber, p.client].filter(Boolean).join(' · ') || '-'}
          </p>
          <NextActionLine info={nextActionInfo(p)} className="mt-1.5" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-inkmute">
          <span>Dok Engineering</span>
          <span className="font-semibold text-ink">{doc}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-line overflow-hidden">
          <div className="h-full rounded-full bg-blueprint" style={{ width: `${Math.min(doc, 100)}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <DeadlineBadge p={p} />
        <select
          aria-label={`Pindahkan ${p.projectName} ke stage lain`}
          value={p.currentStage || ''}
          disabled={busy}
          onChange={(e) => onMove(p, e.target.value)}
          className="ml-auto max-w-[9rem] border border-line rounded bg-canvas text-xs text-inkmute px-1.5 py-1 outline-none focus:border-blueprint max-md:max-w-none max-md:flex-1 max-md:min-h-[40px] max-md:text-base"
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

export default function KanbanBoard({ projects, busy, onMove }) {
  const [draggingId, setDraggingId] = useState(null);
  const [overStage, setOverStage] = useState(null);

  // Project dengan stage yang tidak dikenal (mis. salah ketik di sheet) tetap ditampilkan
  const orphans = projects.filter((p) => !STAGES.includes(p.currentStage));
  const columns = [
    ...STAGES.map((stage) => ({ stage, droppable: true, items: projects.filter((p) => p.currentStage === stage) })),
    ...(orphans.length > 0 ? [{ stage: 'Stage lain / kosong', droppable: false, items: orphans }] : []),
  ];

  function handleDrop(e, stage) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggingId;
    setOverStage(null);
    setDraggingId(null);
    if (busy) return;
    const project = projects.find((p) => p.id === id);
    if (project && project.currentStage !== stage) onMove(project, stage);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
      {columns.map((col) => {
        const isOver = overStage === col.stage && col.droppable;
        return (
          <div
            key={col.stage}
            onDragOver={(e) => {
              if (!col.droppable) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (overStage !== col.stage) setOverStage(col.stage);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setOverStage(null);
            }}
            onDrop={(e) => col.droppable && handleDrop(e, col.stage)}
            className={`w-64 flex-shrink-0 rounded-lg border flex flex-col transition-colors ${
              isOver ? 'border-blueprint bg-blueprint/5' : 'border-line bg-canvas'
            }`}
          >
            <div className="px-3 py-2.5 border-b border-line flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink truncate" title={col.stage}>{col.stage}</p>
                {STAGE_WEIGHTS[col.stage] !== undefined && (
                  <p className="text-[10px] text-inkmute">{STAGE_WEIGHTS[col.stage]}%</p>
                )}
              </div>
              <span className="text-[11px] font-bold text-inkmute bg-panel border border-line rounded-full px-2 py-0.5">
                {col.items.length}
              </span>
            </div>

            <div className="p-2 flex flex-col gap-2 min-h-[120px] max-h-[65vh] overflow-y-auto">
              {col.items.length === 0 ? (
                <p className="text-[11px] text-inkmute text-center py-6">
                  {col.droppable ? 'Kosong — seret kartu ke sini' : 'Kosong'}
                </p>
              ) : (
                col.items.map((p) => (
                  <Card
                    key={p.id}
                    p={p}
                    busy={busy}
                    dragging={draggingId === p.id}
                    onDragStart={setDraggingId}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverStage(null);
                    }}
                    onMove={onMove}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
