import Link from 'next/link';

export default function ProjectTable({ projects }) {
  if (!projects || projects.length === 0) {
    return <div className="p-6 text-center text-inkmute text-sm bg-panel rounded-lg border border-line">Tidak ada project yang ditemukan.</div>;
  }

  // Fungsi untuk memberi warna badge secara otomatis berdasarkan nama tahapan
  const getStageBadge = (stage) => {
    const s = stage?.toLowerCase() || '';
    if (s.includes('po') || s.includes('sos')) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (s.includes('procurement') || s.includes('collecting')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (s.includes('fabrication')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (s.includes('delivery')) return 'bg-orange-50 text-orange-700 border-orange-200';
    if (s.includes('installation') || s.includes('commissioning')) return 'bg-teal-50 text-teal-700 border-teal-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  return (
    <div className="overflow-x-auto bg-panel rounded-xl border border-line shadow-sm">
      <table className="w-full text-sm text-left whitespace-nowrap">
        {/* Header Tabel */}
        <thead className="text-[11px] text-inkmute uppercase bg-canvas/80 border-b border-line tracking-wider">
          <tr>
            <th className="px-5 py-4 font-semibold">PO Number</th>
            <th className="px-5 py-4 font-semibold">Project Name</th>
            <th className="px-5 py-4 font-semibold">Client</th>
            <th className="px-5 py-4 font-semibold">PIC</th>
            <th className="px-5 py-4 font-semibold">Stage</th>
            <th className="px-5 py-4 font-semibold min-w-[150px]">Progress</th>
            <th className="px-5 py-4 font-semibold text-right">Delivery Target</th>
          </tr>
        </thead>
        
        {/* Isi Tabel */}
        <tbody className="divide-y divide-line">
          {projects.map((p, idx) => (
            <tr key={idx} className="hover:bg-canvas/40 transition-colors group">
              
              {/* PO Number - Menggunakan font mono agar presisi */}
              <td className="px-5 py-4 text-xs font-mono text-inkmute">
                {p.poNumber}
              </td>
              
              {/* Project Name - Bisa di-klik */}
              <td className="px-5 py-4 font-medium whitespace-normal min-w-[250px]">
                <Link href={`/projects/${encodeURIComponent(p.poNumber)}`} className="text-blueprint group-hover:text-blueprintdark group-hover:underline transition-colors line-clamp-2 leading-snug">
                  {p.projectName}
                </Link>
              </td>
              
              {/* Client - Dengan Inisial Bulat */}
              <td className="px-5 py-4 text-ink">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-canvas border border-line flex items-center justify-center text-[10px] font-bold text-inkmute shadow-sm">
                    {p.client ? p.client.substring(0, 1).toUpperCase() : '-'}
                  </div>
                  <span className="truncate max-w-[150px] font-medium text-sm">{p.client || '-'}</span>
                </div>
              </td>
              
              {/* PIC */}
              <td className="px-5 py-4 text-ink text-sm">
                {p.pic || '-'}
              </td>
              
              {/* Stage - Berubah jadi Badge Berwarna */}
              <td className="px-5 py-4">
                <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${getStageBadge(p.currentStage)}`}>
                  {p.currentStage || 'Unknown'}
                </span>
              </td>
              
              {/* Progress Bar - Ramping dan Dinamis */}
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-canvas rounded-full overflow-hidden border border-line/50">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${p.stageProgress >= 100 ? 'bg-teal' : p.stageProgress >= 90 ? 'bg-orange-400' : 'bg-blueprint'}`}
                      style={{ width: `${p.stageProgress}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-data font-bold text-ink w-8">{p.stageProgress}%</span>
                </div>
              </td>
              
              {/* Delivery - Tanggal dan Label Status dirapikan ke kanan */}
              <td className="px-5 py-4 text-right flex flex-col items-end gap-1.5 justify-center h-full">
                {p.deliveryDate ? (
                  <>
                    <span className="text-sm font-semibold text-ink">{p.deliveryDate}</span>
                    {/* Logika Label Status */}
                    {p.stageProgress >= 100 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#4E7B5B]/10 text-[#4E7B5B] uppercase tracking-wide">
                        Selesai
                      </span>
                    ) : p.stageProgress >= 90 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blueprint/10 text-blueprint uppercase tracking-wide">
                        Terkirim
                      </span>
                    ) : (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${p.daysRemaining < 0 ? 'bg-rust/10 text-rust border border-rust/20' : 'bg-canvas text-inkmute border border-line'}`}>
                        {p.daysRemaining < 0 ? `Terlewat ${Math.abs(p.daysRemaining)} hari` : `${p.daysRemaining} hari lagi`}
                      </span>
                    )}
                  </>
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
