import { useEffect, useState } from 'react';
import { api } from '../../lib/api'; 
import ProjectTable from '../../components/ProjectTable';

export default function ProjectsPage() {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    api.getProjects().then(setProjects).catch(e => setError(e.message));
  }, []);

  if (error) return <div className="bg-panel border border-line rounded-lg p-6 text-rust">{error}</div>;
  if (!projects) return <div className="text-inkmute">Memuat data project...</div>;

  // Logika Pencarian
  const filteredProjects = projects.filter(p => {
    const q = searchQuery.toLowerCase();
    return (
      (p.poNumber || '').toLowerCase().includes(q) ||
      (p.projectName || '').toLowerCase().includes(q) ||
      (p.client || '').toLowerCase().includes(q) ||
      (p.pic || '').toLowerCase().includes(q) ||
      (p.status || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <h1 className="font-display text-2xl font-semibold text-ink">Semua Project</h1>
        
        {/* Fitur Search Baru */}
        <div className="relative w-full sm:w-80">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-inkmute" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Cari PO, Project, Client, atau PIC..."
            className="border border-line rounded-md pl-9 pr-4 py-2 text-sm bg-panel outline-none focus:border-blueprint w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-panel border border-line rounded-lg overflow-hidden">
        <ProjectTable projects={filteredProjects} />
      </div>
      
      {filteredProjects.length === 0 && (
        <div className="text-center text-inkmute py-8 bg-panel border border-line rounded-lg">
          Project tidak ditemukan.
        </div>
      )}
    </div>
  );
}
