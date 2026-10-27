import Link from 'next/link';
import { fmtDate, isNum } from '../lib/projectHelpers';
import { Pill } from './Badges';

// Tenggat kirim terdekat untuk project yang belum dikirim (progres < 90%), urut dari yang paling mendesak.
// Aturan warna sama dengan lib/projectHelpers.js: lewat = merah, <= 14 hari = kuning.
function tone(d) {
  if (!isNum(d)) return 'neutral';
  if (d < 0) return 'rust';
  if (d <= 14) return 'amber';
  return 'neutral';
}
function text(d) {
  if (!isNum(d)) return '';
  if (d < 0) return `Lewat ${Math.abs(d)} hari`;
  if (d === 0) return 'Hari ini';
  return `${d} hari lagi`;
}

export default function DeliveryList({ projects, limit = 6 }) {
  const list = projects
    .filter((p) => p.deliveryDate && p.stageProgress < 90)
    .sort((a, b) => String(a.deliveryDate).localeCompare(String(b.deliveryDate)))
    .slice(0, limit);
  const noDate = projects.filter((p) => !p.deliveryDate && p.stageProgress < 90).length;

  return (
    <div className="flex flex-col">
      {list.length === 0 ? (
        <p className="px-5 py-6 text-sm text-inkmute">Tidak ada project sebelum pengiriman yang punya tanggal kirim.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${encodeURIComponent(p.id)}`} className="group grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 hover:bg-canvas transition-colors">
                <span className="flex flex-col items-center justify-center rounded-lg border border-line bg-canvas py-1 leading-none">
                  <span className="font-display tnum text-base font-semibold text-ink">{fmtDate(p.deliveryDate).split(' ')[0]}</span>
                  <span className="text-xs text-inkmute mt-0.5">{fmtDate(p.deliveryDate).split(' ')[1]}</span>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink truncate group-hover:text-blueprint">{p.projectName}</span>
                  <span className="block text-xs text-inkmute truncate mt-0.5">{[p.currentStage, p.pic].filter(Boolean).join(' · ')}</span>
                </span>
                <Pill tone={tone(p.daysRemaining)}>{text(p.daysRemaining) || fmtDate(p.deliveryDate)}</Pill>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {noDate > 0 && (
        <Link href="/projects" className="px-5 py-3 border-t border-line text-xs text-inkmute hover:text-blueprint">
          {noDate} project lain belum memiliki tanggal kirim.
        </Link>
      )}
    </div>
  );
}
