import { deliveryHint } from '../lib/projectHelpers';

// Semua warna memakai token tema (bukan warna tetap), jadi otomatis benar di mode terang & gelap.
const TONES = {
  neutral: 'bg-inkmute/10 text-inkmute border-inkmute/25',
  blueprint: 'bg-blueprint/10 text-blueprint border-blueprint/25',
  teal: 'bg-teal/10 text-teal border-teal/25',
  amber: 'bg-amber/10 text-amber border-amber/30',
  rust: 'bg-rust/10 text-rust border-rust/25',
};

const DOTS = {
  neutral: 'bg-inkmute',
  blueprint: 'bg-blueprint',
  teal: 'bg-teal',
  amber: 'bg-amber',
  rust: 'bg-rust',
};

export function Pill({ tone = 'neutral', dot = false, className = '', children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium leading-5 whitespace-nowrap ${TONES[tone]} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${DOTS[tone]}`} />}
      {children}
    </span>
  );
}

export function stageTone(stage) {
  const s = String(stage || '').toLowerCase();
  if (s.includes('hand over')) return 'teal';
  if (s.includes('delivery') || s.includes('installation') || s.includes('commissioning') || s.includes('manual')) return 'teal';
  if (s.includes('fabrication')) return 'blueprint';
  if (s.includes('procurement') || s.includes('collecting')) return 'amber';
  return 'neutral';
}

export function StageBadge({ stage, className = '' }) {
  return <Pill tone={stageTone(stage)} className={className}>{stage || 'Belum diatur'}</Pill>;
}

const PRIORITY_TONE = { High: 'rust', Medium: 'amber', Low: 'neutral' };

export function PriorityBadge({ priority }) {
  if (!priority) return <span className="text-inkmute text-xs">-</span>;
  return <Pill tone={PRIORITY_TONE[priority] || 'neutral'} dot>{priority}</Pill>;
}

const STATUS_TONE = { 'In Progress': 'blueprint', Completed: 'teal', 'On Hold': 'amber', 'Not Started': 'neutral' };

export function StatusBadge({ status }) {
  if (!status) return null;
  return <Pill tone={STATUS_TONE[status] || 'neutral'} dot>{status}</Pill>;
}

export function DeliveryHint({ p }) {
  const h = deliveryHint(p);
  if (!h) return null;
  return <Pill tone={h.tone}>{h.text}</Pill>;
}
