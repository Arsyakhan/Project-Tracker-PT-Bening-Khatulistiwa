import { Pill } from './Badges';
import { dueText } from '../lib/nextAction';
import { fmtShort } from '../lib/meetings';

// Blok kecil: apa yang ditunggu / langkah berikutnya, siapa yang mengerjakan, dan kapan.
// info = hasil nextActionInfo(). Kosong: tampil tanda "–" kalau showEmpty, kalau tidak tidak tampil apa-apa.
export default function NextActionLine({ info, showEmpty = false, className = '' }) {
  if (!info) return null;
  if (info.empty) {
    if (!showEmpty) return null;
    return (
      <span className={`text-sm text-inkmute ${className}`} title="Belum ada langkah berikutnya">
        –<span className="sr-only">Belum ada langkah berikutnya</span>
      </span>
    );
  }
  return (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}>
      {info.blocked && (
        <p className="text-xs leading-snug text-rust line-clamp-2" title={info.blocker}>
          <b className="font-semibold">Menunggu:</b> {info.blocker}
          {info.blockedDays !== null && (
            <span className="whitespace-nowrap"> · {info.blockedDays === 0 ? 'hari ini' : `${info.blockedDays} hari`}</span>
          )}
        </p>
      )}
      {info.action && (
        <>
          <p className="text-xs leading-snug text-ink line-clamp-2" title={info.action}>
            <span aria-hidden="true" className="font-semibold text-blueprint">→ </span>
            {info.action}
          </p>
          {(info.owner || info.due) && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-inkmute">
              {info.owner && <span className="truncate max-w-full">PIC {info.owner}</span>}
              {info.due && (
                <span title={fmtShort(info.due)}>
                  <Pill tone={info.tone}>{dueText(info.dueDays)}</Pill>
                </span>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
