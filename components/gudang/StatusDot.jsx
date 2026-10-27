const TONE_TEXT = { amber: 'text-amberink', teal: 'text-teal', rust: 'text-rust', muted: 'text-inkmute', blueprint: 'text-blueprint' };
const TONE_DOT = { amber: 'bg-amber', teal: 'bg-teal', rust: 'bg-rust', muted: 'bg-inkmute/50', blueprint: 'bg-blueprint' };

// Status singkat: titik warna + teks (warna tidak pernah berdiri sendiri). status = { label, tone }.
export default function StatusDot({ status, className = '' }) {
  if (!status) return null;
  const tone = status.tone || 'muted';
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap ${TONE_TEXT[tone]} ${className}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${TONE_DOT[tone]}`} aria-hidden="true" />
      {status.label}
    </span>
  );
}
