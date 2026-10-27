import { OPNAME_STATUS } from '../../lib/gudang';

const TONE_TEXT = { amber: 'text-amberink', teal: 'text-teal' };
const TONE_DOT = { amber: 'bg-amber', teal: 'bg-teal' };

// Status sesi stock opname: titik warna + teks (warna tidak berdiri sendiri).
export default function OpnameStatus({ status }) {
  const s = OPNAME_STATUS[status] || { label: status, tone: 'amber' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap ${TONE_TEXT[s.tone]}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${TONE_DOT[s.tone]}`} aria-hidden="true" />
      {s.label}
    </span>
  );
}
