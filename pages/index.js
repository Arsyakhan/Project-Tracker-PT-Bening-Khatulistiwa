import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import StatCard from '../components/StatCard';
import StatusPie from '../components/StatusPie';
import ProgressChart from '../components/ProgressChart';
import Timeline from '../components/Timeline';
import ProjectTable from '../components/ProjectTable';

export default function Dashboard() {
  const [projects, setProjects] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const [p, d] = await Promise.all([api.getProjects(), api.getDashboard()]);
      setProjects(p);
      setDashboard(d);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  if (error) {
    return (
      <div className="bg-panel border border-line rounded-lg p-6 text-rust">
        Gagal memuat data: {error}.
      </div>
    );
  }

  if (!projects) {
    return <div className="text-inkmute">Memuat data dari spreadsheet...</div>;
  }

  // Membagi project ke dalam 3 kategori
  const preDeliveryProjects = projects.filter((p) => p.stageProgress < 90);
  const deliveredProjects = projects.filter((p) => p.stageProgress >= 90 && p.stageProgress < 100);
  const completedProjects = projects.filter((p) => p.stageProgress >= 100);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Dashboard Progress</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Project" value={dashboard.total} accent="#0C2D48" />
        <StatCard label="Pre-Delivery" value={dashboard.preDelivery} accent="#0077B6" />
        <StatCard label="Delivered" value={dashboard.delivered} accent="#009688" />
        <StatCard label="Completed" value={dashboard.completed} accent="#4A7291" />
      </div>

      {/* Layout 3 Kolom untuk Widget Chart & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1">
          <StatusPie dashboard={dashboard} />
        </div>
        <div className="col-span-1">
          <ProgressChart projects={projects} />
        </div>
        <div className="col-span-1">
          <Timeline projects={projects} />
        </div>
      </div>

      {/* Daftar Project yang Dibagi 3 Kategori */}
      <div className="flex flex-col gap-8 mt-4">
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold text-ink">A. Pre-Delivery Projects</h2>
          <ProjectTable projects={preDeliveryProjects} />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold text-ink">B. Delivered Projects</h2>
          <ProjectTable projects={deliveredProjects} />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold text-ink">C. Completed Projects</h2>
          <ProjectTable projects={completedProjects} />
        </div>
      </div>
    </div>
  );
}
