import Link from 'next/link';
import StageGauge from './StageGauge';

export default function ProjectTable({ projects }) {
  if (!projects || projects.length === 0) {
    return <div className="p-6 text-center text-inkmute text-sm">Tidak ada project di kategori ini.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-inkmute uppercase bg-canvas/50 border-b border-line">
          <tr>
            <th className="px-4 py-3 font-medium">PO Number</th>
            <th className="px-4 py-3 font-medium">Project Name</th>
            <th className="px-4 py-3 font-medium">Client</th>
            <th className="px-4 py-3 font-medium">PIC</th>
            <th className="px-4 py-3 font-medium min-w-[120px]">Stage</th>
            <th className="px-4 py-3 font-medium min-w-[200px]">Progress</th>
            <th className="px-4 py-3 font-medium">Delivery</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p, idx) => (
            <tr key={idx} className="bg-panel border-b border-line hover:bg-canvas/30 transition-colors">
              <td className="px-4 py-3 font-data text-inkmute">{p.poNumber}</td>
              <td className="px-4 py-3 font-medium">
                <Link href={`/projects/${encodeURIComponent(p.poNumber)}`} className="text-blueprint hover:underline">
                  {p.projectName}
                </Link>
              </td>
              <td className="px-4 py-3 text-ink">{p.client || '-'}</td>
              <td className="px-4 py-3 text-ink">{p.pic || '-'}</td>
              <td className="px-4 py-3 text-ink">{p.currentStage}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1"><StageGauge progress={p.stageProgress} showLabel={false} compact /></div>
                  <span className="text-xs font-data font-medium text-inkmute w-8">{p.stageProgress}%</span>
                </div>
              </td>
              <td className="px-4 py-3">
                {p.deliveryDate ? (
                  <div className="flex flex-col">
                    <span className="text-ink">{p.deliveryDate}</span>
                    {p.stageProgress >= 90 ? (
                      <span className="text-xs text-teal font-medium">Terkirim / Selesai</span>
                    ) : (
                      <span className={`text-xs ${p.daysRemaining < 0 ? 'text-rust' : 'text-inkmute'}`}>
                        {p.daysRemaining < 0 ? `Terlewat ${Math.abs(p.daysRemaining)} hari` : `${p.daysRemaining} hari lagi`}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-inkmute">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
