import { useState } from 'react';
import Link from 'next/link';

const PREVIEW_COUNT = 5;
const SOON_DAYS = 14;

function isNum(v) {
  return typeof v === 'number' && !Number.isNaN(v);
}

// Aturan penandaan (sama dengan logika badge di ProjectTable):
// - Terlambat     : belum terkirim (progress < 90%), Delivery Date sudah lewat
// - Deadline dekat: belum terkirim, Delivery Date dalam 14 hari ke depan
// - Dokumen kurang: sudah Delivery ke atas (>= 90%) tetapi Engineering Doc < 100%
function buildGroups(projects) {
  const overdue = [];
  const dueSoon = [];
  const docGap = [];

  projects.forEach((p) => {
    const days = p.daysRemaining;
    if (p.deliveryDate && p.stageProgress < 90 && isNum(days)) {
      if (days < 0) overdue.push(p);
      else if (days <= SOON_DAYS) dueSoon.push(p);
    }
    if (p.stageProgress >= 90 && p.engineeringDocProgress < 100) docGap.push(p);
  });

  overdue.sort((a, b) => a.daysRemaining - b.daysRemaining); // paling telat di atas
  dueSoon.sort((a, b) => a.daysRemaining - b.daysRemaining); // paling dekat di atas
  docGap.sort((a, b) => a.engineeringDocProgress - b.engineeringDocProgress); // paling kurang di atas

  return { overdue, dueSoon, docGap };
}

const TONES = {
  rust: { title: 'text-rust', badge: 'bg-rust/10 text-rust border border-rust/20', bar: 'bg-rust' },
  amber: { title: 'text-amber', badge: 'bg-amber/10 text-amber border border-amber/20', bar: 'bg-amber' },
  blueprint: { title: 'text-blueprint', badge: 'bg-blueprint/10 text-blueprint border border-blueprint/20', bar: 'bg-blueprint' },
};

function AttentionGroup({ title, hint, items, tone, renderBadge }) {
  const [expanded, setExpanded] = useState(false);
  const t = TONES[tone];
  const visible = expanded ? items : items.slice(0, PREVIEW_COUNT);
  const hiddenCount = items.length - visible.length;

  return (
    <div className="bg-panel border border-line rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={`text-sm font-semibold ${t.title}`}>{title}</h3>
          <p className="text-xs text-inkmute mt-0.5">{hint}</p>
        </div>
        <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${t.badge}`}>{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-inkmute py-3 text-center">Tidak ada. 👍</p>
      ) : (
        <div className="flex flex-col gap-0.5 -mx-1">
          {visible.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${encodeURIComponent(p.id)}`}
              className="flex items-center justify-between gap-3 px-2 py-2 rounded-md hover:bg-canvas transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{p.projectName}</p>
                <p className="text-xs text-inkmute truncate">
                  {[p.poNumber, p.client].filter(Boolean).join(' · ') || '-'}
                </p>
              </div>
              <span className={`flex-shrink-0 text-[10px] font-semibold rounded px-2 py-0.5 whitespace-nowrap ${t.badge}`}>
                {renderBadge(p)}
              </span>
            </Link>
          ))}
        </div>
      )}

      {items.length > PREVIEW_COUNT && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-blueprint hover:underline self-start"
        >
          {expanded ? 'Tampilkan lebih sedikit' : `Tampilkan ${hiddenCount} lainnya`}
        </button>
      )}
    </div>
  );
}

export default function AttentionPanel({ projects }) {
  const { overdue, dueSoon, docGap } = buildGroups(projects || []);
  const uniqueIds = new Set([...overdue, ...dueSoon, ...docGap].map((p) => p.id));

  if (uniqueIds.size === 0) {
    return (
      <div className="bg-panel border border-line rounded-lg p-5 flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <div>
          <p className="text-sm font-semibold text-ink">Semua project aman</p>
          <p className="text-xs text-inkmute">Tidak ada yang terlambat, mendekati deadline, atau dokumennya tertinggal.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">Perlu Perhatian</h2>
        <span className="text-xs text-inkmute">{uniqueIds.size} project butuh tindak lanjut</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AttentionGroup
          title="Terlambat"
          hint="Belum terkirim, Delivery Date sudah lewat"
          items={overdue}
          tone="rust"
          renderBadge={(p) => `Terlewat ${Math.abs(p.daysRemaining)} hari`}
        />
        <AttentionGroup
          title={`Deadline ≤ ${SOON_DAYS} hari`}
          hint="Belum terkirim, Delivery Date sudah dekat"
          items={dueSoon}
          tone="amber"
          renderBadge={(p) => (p.daysRemaining === 0 ? 'Hari ini' : `${p.daysRemaining} hari lagi`)}
        />
        <AttentionGroup
          title="Dokumen Engineering kurang"
          hint="Sudah Delivery ke atas, dokumen belum 100%"
          items={docGap}
          tone="blueprint"
          renderBadge={(p) => `Dok ${p.engineeringDocProgress}%`}
        />
      </div>
    </div>
  );
}
