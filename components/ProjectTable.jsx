import { useState, useMemo } from 'react';

export default function ProjectTable({ projects = [] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [picFilter, setPicFilter] = useState('');

  // Ekstrak data unik untuk dropdown filter
  const uniqueStatuses = [...new Set(projects.map(p => p.status).filter(Boolean))];
  const uniquePICs = [...new Set(projects.map(p => p.pic).filter(Boolean))];

  // Logic filter & search
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchSearch = 
        (p.projectName && p.projectName.toLowerCase().includes(search.toLowerCase())) ||
        (p.poNumber && p.poNumber.toLowerCase().includes(search.toLowerCase())) ||
        (p.client && p.client.toLowerCase().includes(search.toLowerCase()));
      
      const matchStatus = statusFilter ? p.status === statusFilter : true;
      const matchPIC = picFilter ? p.pic === picFilter : true;
      
      return matchSearch && matchStatus && matchPIC;
    });
  }, [projects, search, statusFilter, picFilter]);

  if (!projects.length) {
    return <div className="text-sm text-inkmute py-8 text-center bg-panel border border-line rounded-lg">Tidak ada data project di tab ini.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* SECTION 1: SEARCH & FILTER CONTROLS */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Cari PO, Project, atau Client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-line rounded-md bg-panel text-ink focus:outline-none focus:border-blueprint transition-colors"
          />
          <svg className="w-4 h-4 absolute left-3 top-3 text-inkmute" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Filter Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-line rounded-md bg-panel text-ink focus:outline-none focus:border-blueprint"
        >
          <option value="">Semua Status</option>
          {uniqueStatuses.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Filter PIC */}
        <select
          value={picFilter}
          onChange={(e) => setPicFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-line rounded-md bg-panel text-ink focus:outline-none focus:border-blueprint"
        >
          <option value="">Semua PIC</option>
          {uniquePICs.map(pic => (
            <option key={pic} value={pic}>{pic}</option>
          ))}
        </select>
      </div>

      {/* Menampilkan jumlah hasil filter */}
      <div className="text-xs text-inkmute font-medium">
        Menampilkan {filteredProjects.length} dari {projects.length} project
      </div>

      {/* SECTION 2: MOBILE VIEW (CARD LAYOUT) */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredProjects.map((p) => (
          <div key={p.id} className="bg-panel border border-line rounded-lg p-4 shadow-sm flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-blueprint mb-1">{p.poNumber || '-'}</p>
                <h3 className="text-base font-bold text-ink">{p.projectName || 'Unnamed Project'}</h3>
                <p className="text-xs text-inkmute mt-0.5">{p.client || '-'}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${p.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {p.status}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm border-t border-line pt-3 mt-1">
              <div>
                <p className="text-xs text-inkmute">PIC</p>
                <p className="font-medium text-ink">{p.pic || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-inkmute">Current Stage</p>
                <p className="font-medium text-ink truncate">{p.currentStage || '-'}</p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1 mt-2">
                <span className="text-inkmute">Progress</span>
                <span className="font-bold text-ink">{p.stageProgress}%</span>
              </div>
              <div className="w-full bg-line rounded-full h-2">
                <div 
                  className="bg-blueprint h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${p.stageProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}
        {filteredProjects.length === 0 && (
          <div className="text-center text-sm text-inkmute py-4">Pencarian tidak ditemukan.</div>
        )}
      </div>

      {/* SECTION 3: DESKTOP VIEW (TABLE LAYOUT WITH STICKY HEADER) */}
      <div className="hidden md:block overflow-x-auto border border-line rounded-lg shadow-sm max-h-[600px] overflow-y-auto relative">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead className="bg-panel sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="py-3 px-4 text-xs font-semibold text-inkmute uppercase tracking-wider border-b border-line">PO Number</th>
              <th className="py-3 px-4 text-xs font-semibold text-inkmute uppercase tracking-wider border-b border-line">Project Name</th>
              <th className="py-3 px-4 text-xs font-semibold text-inkmute uppercase tracking-wider border-b border-line">Client</th>
              <th className="py-3 px-4 text-xs font-semibold text-inkmute uppercase tracking-wider border-b border-line">PIC</th>
              <th className="py-3 px-4 text-xs font-semibold text-inkmute uppercase tracking-wider border-b border-line">Stage</th>
              <th className="py-3 px-4 text-xs font-semibold text-inkmute uppercase tracking-wider border-b border-line">Progress</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-line">
            {filteredProjects.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 text-sm font-medium text-blueprint">{p.poNumber || '-'}</td>
                <td className="py-3 px-4 text-sm font-bold text-ink">
                  {p.projectName || '-'}
                  {p.priority === 'High' && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800">High</span>}
                </td>
                <td className="py-3 px-4 text-sm text-ink">{p.client || '-'}</td>
                <td className="py-3 px-4 text-sm text-ink">{p.pic || '-'}</td>
                <td className="py-3 px-4 text-sm text-ink">
                  <div className="flex flex-col">
                    <span>{p.currentStage || '-'}</span>
                    <span className="text-[10px] text-inkmute">{p.status}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-ink min-w-[150px]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium w-8">{p.stageProgress}%</span>
                    <div className="w-full bg-line rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${p.stageProgress >= 100 ? 'bg-green-500' : 'bg-blueprint'}`} 
                        style={{ width: `${p.stageProgress}%` }}
                      ></div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {filteredProjects.length === 0 && (
              <tr>
                <td colSpan="6" className="py-8 text-center text-sm text-inkmute">
                  Pencarian tidak ditemukan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
