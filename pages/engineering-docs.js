import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import { SkeletonTable } from '../components/Skeleton';

export default function EngineeringDocs() {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);
  
  // State untuk 3 Filter
  const [filterProject, setFilterProject] = useState('All');
  const [filterDoc, setFilterDoc] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  useEffect(() => {
    api.getProjects().then(setProjects).catch(e => setError(e.message));
  }, []);

  if (error) return <div className="bg-panel border border-rust/30 rounded-xl p-6 text-rust font-medium shadow-sm">{error}</div>;
  if (!projects) return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-ink">Engineering Documents</h1>
      <SkeletonTable rows={6} />
    </div>
  );

  // Mengumpulkan opsi filter yang unik & menyatukan data dokumen
  let allDocs = [];
  const projectNames = new Set();
  const docTypes = new Set();

  projects.forEach(p => {
    projectNames.add(p.projectName);
    if (p.checklist && p.checklist.items) {
      Object.keys(p.checklist.items).forEach(docName => {
        docTypes.add(docName);
        allDocs.push({
          poNumber: p.poNumber,
          projectName: p.projectName,
          docName: docName,
          status: p.checklist.items[docName],
          link: p.checklist.links?.[docName] || ''
        });
      });
    }
  });

  // Eksekusi Filter
  if (filterProject !== 'All') allDocs = allDocs.filter(d => d.projectName === filterProject);
  if (filterDoc !== 'All') allDocs = allDocs.filter(d => d.docName === filterDoc);
  if (filterStatus !== 'All') allDocs = allDocs.filter(d => d.status === filterStatus);

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header & Filter Area */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-5 bg-panel p-5 rounded-xl border border-line shadow-sm">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Engineering Documents</h1>
          <p className="text-inkmute text-sm mt-1">Lacak status dan tautan dokumen teknis (P&ID, BOM, EWD, dll).</p>
        </div>
        
        {/* Area 3 Buah Dropdown Filter */}
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <select
            className="border border-line rounded-lg px-4 py-2 text-sm bg-canvas outline-none focus:border-blueprint focus:ring-1 focus:ring-blueprint flex-1 transition-all"
            value={filterProject}
            onChange={e => setFilterProject(e.target.value)}
          >
            <option value="All">Semua Project</option>
            {[...projectNames].map(name => <option key={name} value={name}>{name}</option>)}
          </select>

          <select
            className="border border-line rounded-lg px-4 py-2 text-sm bg-canvas outline-none focus:border-blueprint focus:ring-1 focus:ring-blueprint flex-1 transition-all"
            value={filterDoc}
            onChange={e => setFilterDoc(e.target.value)}
          >
            <option value="All">Semua Dokumen</option>
            {[...docTypes].map(doc => <option key={doc} value={doc}>{doc}</option>)}
          </select>

          <select
            className="border border-line rounded-lg px-4 py-2 text-sm bg-canvas outline-none focus:border-blueprint focus:ring-1 focus:ring-blueprint flex-1 transition-all"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="All">Semua Status</option>
            <option value="Not Started">Not Started</option>
            <option value="Drafting">Drafting</option>
            <option value="Under Review">Under Review</option>
            <option value="Completed">Completed</option>
            <option value="N/A">N/A</option>
          </select>
        </div>
      </div>

      {/* Tabel Utama */}
      <div className="bg-panel border border-line rounded-xl overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-[11px] text-inkmute uppercase bg-canvas/80 border-b border-line tracking-wider">
            <tr>
              <th className="px-5 py-4 font-semibold">PO Number</th>
              <th className="px-5 py-4 font-semibold">Project Name</th>
              <th className="px-5 py-4 font-semibold">Dokumen</th>
              <th className="px-5 py-4 font-semibold">Status</th>
              <th className="px-5 py-4 font-semibold">Tautan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {allDocs.map((doc, idx) => (
              <tr key={idx} className="hover:bg-canvas/40 transition-colors group">
                
                {/* PO Number */}
                <td className="px-5 py-4 font-mono text-xs text-inkmute">
                  {doc.poNumber}
                </td>
                
                {/* Project Name */}
                <td className="px-5 py-4 font-medium min-w-[250px]">
                  <Link href={`/projects/${encodeURIComponent(doc.poNumber)}`} className="text-blueprint group-hover:text-blueprintdark group-hover:underline transition-colors line-clamp-1">
                    {doc.projectName}
                  </Link>
                </td>
                
                {/* Dokumen dengan Ikon File */}
                <td className="px-5 py-4 text-ink font-medium">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-inkmute">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    {doc.docName}
                  </div>
                </td>
                
                {/* Status Badges Premium */}
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase border ${
                    doc.status === 'Completed' ? 'bg-[#4E7B5B]/10 text-[#4E7B5B] border-[#4E7B5B]/20' :
                    doc.status === 'Under Review' ? 'bg-amber/10 text-amber border-amber/20' :
                    doc.status === 'Drafting' ? 'bg-blueprint/10 text-blueprint border-blueprint/20' :
                    doc.status === 'N/A' ? 'bg-transparent text-inkmute border-line border-dashed' :
                    'bg-canvas text-inkmute border-line' // Not Started
                  }`}>
                    {doc.status}
                  </span>
                </td>
                
                {/* Tautan Bergaya Tombol */}
                <td className="px-5 py-4">
                  {doc.link ? (
                    <a 
                      href={doc.link} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-canvas hover:bg-blueprint border border-line hover:border-blueprint text-ink hover:text-white transition-all shadow-sm group/btn"
                    >
                      Buka
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium text-line bg-transparent border border-transparent">
                      -
                    </span>
                  )}
                </td>
              </tr>
            ))}
            
            {/* Tampilan jika filter tidak menemukan data */}
            {allDocs.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto text-line mb-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <p className="text-inkmute font-medium">Tidak ada dokumen yang cocok dengan filter.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
