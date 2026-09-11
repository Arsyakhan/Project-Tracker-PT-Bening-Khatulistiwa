export default function StatusPie({ dashboard }) {
  if (!dashboard) return null;

  const total = dashboard.total || 1;
  const preDelivery = dashboard.preDelivery || 0;
  const delivered = dashboard.delivered || 0;
  const completed = dashboard.completed || 0;

  // Hitung derajat untuk porsi pie chart
  const preDeg = (preDelivery / total) * 360;
  const delDeg = (delivered / total) * 360;
  
  // Warna senada dengan screenshot kamu
  const colorPre = "#1F4E79"; // Biru Tua (Pre-Delivery)
  const colorDel = "#D38C2B"; // Oranye Emas (Delivered)
  const colorCom = "#4E7B5B"; // Hijau (Completed)

  return (
    // Tambahan h-full dan flex-col agar kotaknya merentang penuh ke bawah
    <div className="bg-panel border border-line rounded-lg p-6 h-full flex flex-col shadow-sm">
      <h3 className="text-xs font-semibold text-inkmute mb-2 uppercase tracking-wider">
        DISTRIBUSI STATUS PROJECT
      </h3>
      
      {/* flex-1 dan justify-center ini yang mendorong grafik ke tengah dan membuang ruang kosong */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 min-h-[250px]">
        
        {/* Donut Chart */}
        <div 
          className="w-48 h-48 rounded-full relative flex items-center justify-center"
          style={{
            background: `conic-gradient(
              ${colorPre} 0deg ${preDeg}deg,
              ${colorDel} ${preDeg}deg ${preDeg + delDeg}deg,
              ${colorCom} ${preDeg + delDeg}deg 360deg
            )`
          }}
        >
          {/* Lingkaran putih di tengah untuk efek donat */}
          <div className="w-28 h-28 bg-panel rounded-full absolute"></div>
        </div>

        {/* Legend / Keterangan */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: colorPre }}></div>
            <span className="text-ink">Pre-Delivery</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: colorDel }}></div>
            <span className="text-ink">Delivered</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: colorCom }}></div>
            <span className="text-ink">Completed</span>
          </div>
        </div>
        
      </div>
    </div>
  );
}
