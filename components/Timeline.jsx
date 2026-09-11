export default function Timeline({ projects }) {
  // Filter: Hanya ambil project dengan progress di bawah 90% (Belum masuk tahap Delivery)
  const activeProjects = projects
    .filter(p => p.deliveryDate && p.stageProgress < 90)
    .sort((a, b) => new Date(a.deliveryDate) - new Date(b.deliveryDate))
    .slice(0, 10);

  return (
    <div className="bg-panel border border-line rounded-lg p-6 h-full flex flex-col shadow-sm">
      <h3 className="text-xs font-semibold text-inkmute mb-5 uppercase tracking-wider">
        TIMELINE & DELIVERY DATE TERDEKAT
      </h3>
      <div className="flex-1 overflow-y-auto pr-2 max-h-[300px]">
        <div className="relative border-l-2 border-line ml-3 flex flex-col gap-6">
          {activeProjects.map((p, i) => (
            <div key={i} className="relative pl-6">
              <div className="absolute w-3 h-3 bg-rust rounded-full -left-[7px] top-1.5 ring-4 ring-panel"></div>
              
              <p className="text-sm font-medium text-ink truncate" title={p.projectName}>
                {p.projectName}
              </p>
              <p className={`text-xs mt-1 ${p.daysRemaining < 0 ? 'text-rust font-medium' : 'text-inkmute'}`}>
                Delivery: {p.deliveryDate} 
                {p.daysRemaining < 0 
                  ? ` (Terlewat ${Math.abs(p.daysRemaining)} hari)` 
                  : ` (${p.daysRemaining} hari lagi)`}
              </p>
            </div>
          ))}
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
