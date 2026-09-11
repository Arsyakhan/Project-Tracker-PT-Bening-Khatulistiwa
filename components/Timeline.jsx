export default function Timeline({ projects }) {
  // Sort by deliveryDate ascending, exclude projects without deliveryDate
  const upcoming = [...projects]
    .filter(p => p.deliveryDate)
    .sort((a, b) => new Date(a.deliveryDate) - new Date(b.deliveryDate));

  return (
    <div className="bg-panel border border-line rounded-lg p-6 h-full flex flex-col">
      <h2 className="font-display font-semibold text-inkmute text-xs uppercase tracking-wider mb-5">
        Timeline & Delivery Date Terdekat
      </h2>
      
      <div className="flex flex-col gap-5 overflow-y-auto pr-2 flex-grow">
        {upcoming.map((p, i) => (
          <div key={i} className="flex gap-4 relative">
            {/* Garis penghubung vertikal */}
            {i !== upcoming.length - 1 && (
              <div className="absolute left-[5px] top-4 bottom-[-1.25rem] w-px bg-rust/30"></div>
            )}
            
            {/* Titik indikator */}
            <div className="w-3 h-3 rounded-full bg-rust mt-1.5 shrink-0 z-10 relative"></div>
            
            {/* Konten Timeline */}
            <div className="flex flex-col -mt-0.5">
              <span className="text-ink font-medium text-sm">{p.projectName}</span>
              <span className="text-rust text-sm mt-0.5">
                Delivery Date: {p.deliveryDate} ({p.daysRemaining} hari lagi)
              </span>
            </div>
          </div>
        ))}

        {upcoming.length === 0 && (
          <div className="text-inkmute text-sm mt-2">Tidak ada jadwal pengiriman terdekat.</div>
        )}
      </div>
    </div>
  );
}
