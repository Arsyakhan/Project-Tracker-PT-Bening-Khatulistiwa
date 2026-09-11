export default function ProgressChart({ projects }) {
  // Hanya ambil project yang masih aktif (progress di bawah 100%)
  const activeProjects = projects.filter(p => p.stageProgress < 100);

  // Urutan tahapan sesuai dengan pipeline engineering agar grafiknya urut secara logis
  const stageOrder = [
    'PO', 'SOS', 'BOM, PID, EWD, GAD', 'Review & Approval',
    'Procurement of Material', 'Collecting Material / Inspection',
    'Fabrication', 'Delivery', 'Installation', 'Commissioning',
    'Preparation Manual Book'
  ];

  // Hitung jumlah project di masing-masing tahap
  const stageCounts = {};
  activeProjects.forEach(p => {
    const stage = p.currentStage || 'Unknown';
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
  });

  // Susun data untuk dirender, diurutkan berdasarkan stageOrder
  const chartData = Object.keys(stageCounts)
    .map(stage => ({
      stage: stage,
      count: stageCounts[stage],
      index: stageOrder.indexOf(stage)
    }))
    .sort((a, b) => {
      if (a.index !== -1 && b.index !== -1) return a.index - b.index;
      if (a.index !== -1) return -1;
      if (b.index !== -1) return 1;
      return 0;
    });

  // Cari angka tertinggi untuk menentukan skala panjang bar (grafik batang)
  const maxCount = Math.max(...chartData.map(d => d.count), 1);

  return (
    <div className="bg-panel border border-line rounded-lg p-6 h-full flex flex-col shadow-sm">
      <h3 className="text-xs font-semibold text-inkmute mb-5 uppercase tracking-wider">
        DISTRIBUSI FASE PENGERJAAN (BOTTLENECK)
      </h3>
      
      <div className="flex-1 overflow-y-auto pr-2 max-h-[300px]">
        <div className="flex flex-col justify-center gap-4">
          {chartData.length === 0 ? (
            <p className="text-sm text-inkmute text-center">Tidak ada project aktif.</p>
          ) : (
            chartData.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                {/* Nama Tahapan */}
                <div 
                  className="w-1/3 text-[11px] font-medium text-ink text-right leading-tight" 
                  title={d.stage}
                >
                  {d.stage}
                </div>
                
                {/* Bar Grafik */}
                <div className="flex-1 h-5 bg-canvas rounded-sm overflow-hidden relative border border-line/50">
                  <div 
                    className="absolute top-0 left-0 h-full bg-blueprint rounded-sm transition-all duration-500"
                    style={{ width: `${(d.count / maxCount) * 100}%` }}
                  ></div>
                </div>
                
                {/* Angka Total */}
                <div className="w-5 text-xs font-data text-ink font-semibold">
                  {d.count}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
