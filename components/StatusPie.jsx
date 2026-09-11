import { useState } from 'react';

export default function StatusPie({ dashboard }) {
  const [hovered, setHovered] = useState(null);

  if (!dashboard) return null;

  const total = dashboard.total || 1; // Hindari pembagian dengan nol
  const preDelivery = dashboard.preDelivery || 0;
  const delivered = dashboard.delivered || 0;
  const completed = dashboard.completed || 0;

  // Hitung persentase murni
  const prePct = (preDelivery / total) * 100;
  const delPct = (delivered / total) * 100;
  const comPct = (completed / total) * 100;

  // Kode warna sesuai dengan tema dashboard
  const colorPre = "#1F4E79"; 
  const colorDel = "#D38C2B"; 
  const colorCom = "#4E7B5B"; 

  // Kalkulasi offset presisi untuk menggambar urutan potongan pie chart
  const slices = [
    { id: 'pre', label: 'Pre-Delivery', count: preDelivery, pct: prePct, color: colorPre, offset: 0 },
    { id: 'del', label: 'Delivered', count: delivered, pct: delPct, color: colorDel, offset: 100 - prePct },
    { id: 'com', label: 'Completed', count: completed, pct: comPct, color: colorCom, offset: 100 - prePct - delPct }
  ];

  return (
    <div className="bg-panel border border-line rounded-lg p-6 h-full flex flex-col shadow-sm">
      <h3 className="text-xs font-semibold text-inkmute mb-2 uppercase tracking-wider">
        DISTRIBUSI STATUS PROJECT
      </h3>
      
      <div className="flex-1 flex flex-col items-center justify-center gap-8 min-h-[250px]">
        
        {/* Wadah Donut SVG Interaktif */}
        <div className="w-48 h-48 relative flex items-center justify-center">
          
          <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90 absolute inset-0 drop-shadow-sm">
            {/* Lingkaran abu-abu dasar (Background Track) */}
            <circle cx="21" cy="21" r="15.91549431" fill="transparent" stroke="#E3EAEC" strokeWidth="5" />
            
            {/* Potongan-potongan Pie */}
            {slices.map(slice => slice.pct > 0 && (
              <circle
                key={slice.id}
                cx="21"
                cy="21"
                r="15.91549431"
                fill="transparent"
                stroke={slice.color}
                // Jika sedang di-hover, potongan ini akan sedikit menebal
                strokeWidth={hovered?.id === slice.id ? "6" : "5"}
                strokeDasharray={`${slice.pct} ${100 - slice.pct}`}
                strokeDashoffset={slice.offset}
                className="transition-all duration-300 cursor-pointer outline-none"
                onMouseEnter={() => setHovered(slice)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </svg>

          {/* Teks Dinamis di Tengah Donut */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-300">
            {hovered ? (
              <>
                <span className="text-3xl font-display font-bold" style={{ color: hovered.color }}>
                  {hovered.count}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-inkmute mt-0.5 text-center leading-tight">
                  {hovered.label} <br/> ({Math.round(hovered.pct)}%)
                </span>
              </>
            ) : (
              <>
                <span className="text-3xl font-display font-bold text-ink">{dashboard.total || 0}</span>
                <span className="text-[10px] uppercase tracking-wider text-inkmute mt-0.5">Total Project</span>
              </>
            )}
          </div>
          
        </div>

        {/* Legend Interaktif */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium">
          {slices.map(slice => (
            <div 
              key={slice.id} 
              className={`flex items-center gap-2 cursor-pointer transition-opacity duration-300 ${
                hovered && hovered.id !== slice.id ? 'opacity-40' : 'opacity-100'
              }`}
              onMouseEnter={() => setHovered(slice)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: slice.color }}></div>
              <span className="text-ink">{slice.label}</span>
            </div>
          ))}
        </div>
        
      </div>
    </div>
  );
}
