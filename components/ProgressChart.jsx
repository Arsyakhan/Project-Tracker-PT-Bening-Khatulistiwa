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
        DISTRIBUSI FASE PENGERJAAN
      </h3>
      
      <div className="flex-1 overflow-y-auto pr-2 max-h-[300px]">
        <div className="flex flex-col gap-4">
          {chartData.length === 0 ? (
            <p className="text-sm text-inkmute text-center">Tidak ada project aktif.</p>
          ) : (
            chartData.map((d, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                {/* Teks Tahapan & Angka diletakkan sejajar di atas grafik */}
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-ink">{d.stage}</span>
                  <span className="font-data font-semibold text-blueprint">{d.count} Project</span>
                </div>
                
                {/* Bar Grafik dibuat lebih ramping (h-2) dan membulat */}
                <div className="h-2 bg-canvas rounded-full overflow-hidden relative border border-line/50">
                  <div 
                    className="absolute top-0 left-0 h-full bg-blueprint rounded-full transition-all duration-500"
                    style={{ width: `${(d.count / maxCount) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
