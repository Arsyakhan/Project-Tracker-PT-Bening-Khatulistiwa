import { fmtDate } from '../lib/projectHelpers';

// Warna titik mengikuti urgensi: lewat tenggat = merah, <= 14 hari = kuning, sisanya biru.
function dotClass(days) {
  if (typeof days !== 'number' || Number.isNaN(days)) return 'bg-inkmute';
  if (days < 0) return 'bg-rust';
  if (days <= 14) return 'bg-amber';
  return 'bg-blueprint';
}

function hintText(days) {
  if (typeof days !== 'number' || Number.isNaN(days)) return '';
  const d = Math.round(days);
  if (d < 0) return `Terlewat ${Math.abs(d)} hari`;
  if (d === 0) return 'Hari ini';
  return `${d} hari lagi`;
}

export default function Timeline({ projects }) {
  // Hanya project yang belum masuk tahap Delivery (progress < 90%), diurutkan dari tenggat terdekat.
  const activeProjects = projects
    .filter((p) => p.deliveryDate && p.stageProgress < 90)
    .sort((a, b) => new Date(a.deliveryDate) - new Date(b.deliveryDate))
    .slice(0, 10);

  return (
    <div className="bg-panel border border-line rounded-lg p-6 h-full flex flex-col shadow-sm">
      <h3 className="text-xs font-semibold text-inkmute mb-5 uppercase tracking-wider">
        Timeline & delivery terdekat
      </h3>
      <div className="flex-1 overflow-y-auto pr-2 max-h-[300px]">
        <div className="relative border-l-2 border-line ml-3 flex flex-col gap-6">
          {activeProjects.map((p, i) => {
            const days = Number(p.daysRemaining);
            const late = days < 0;
            return (
              <div key={p.id || p.poNumber || i} className="relative pl-6">
                <div className={`absolute w-3 h-3 rounded-full -left-[7px] top-1.5 ring-4 ring-panel ${dotClass(days)}`} />
                <p className="text-sm font-medium text-ink truncate" title={p.projectName}>
                  {p.projectName}
                </p>
                <p className={`text-xs mt-1 ${late ? 'text-rust font-medium' : 'text-inkmute'}`}>
                  Delivery: {fmtDate(p.deliveryDate)}
                  {hintText(days) && ` · ${hintText(days)}`}
                </p>
              </div>
            );
          })}
          {activeProjects.length === 0 && (
            <div className="pl-6 text-sm text-inkmute pb-4">
              Tidak ada deadline terdekat untuk project Pre-Delivery.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
