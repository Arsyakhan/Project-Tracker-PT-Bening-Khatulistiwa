import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import StatCard from '../components/StatCard';
import StatusPie from '../components/StatusPie';
import ProgressChart from '../components/ProgressChart';
import Timeline from '../components/Timeline';
import ProjectTable from '../components/ProjectTable';
import { SkeletonStatCards, SkeletonPanel, SkeletonTable } from '../components/Skeleton';
import PageHead from '../components/PageHead';

export default function Dashboard() {
  const [projects, setProjects] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('preDelivery');

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
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Dashboard Progress</h1>
        <SkeletonStatCards />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonPanel />
          <SkeletonPanel />
          <SkeletonPanel />
        </div>
        <SkeletonTable rows={4} />
      </div>
    );
  }

  const preDeliveryProjects = projects.filter((p) => p.stageProgress < 90);
  const deliveredProjects = projects.filter((p) => p.stageProgress >= 90 && p.stageProgress < 100);
  const completedProjects = projects.filter((p) => p.stageProgress >= 100);

  const tabs = [
    { key: 'preDelivery', label: 'Pre-Delivery', data: preDeliveryProjects },
    { key: 'delivered', label: 'Delivered', data: deliveredProjects },
    { key: 'completed', label: 'Completed', data: completedProjects },
  ];
  const activeData = tabs.find((t) => t.key === activeTab)?.data || [];

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Dashboard" />
      <h1 className="font-display text-2xl font-semibold text-ink">Dashboard Progress</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Project" value={dashboard.total} accent="#0C2D48" />
        <StatCard label="Pre-Delivery" value={dashboard.preDelivery} accent="#0077B6" />
        <StatCard label="Delivered" value={dashboard.delivered} accent="#009688" />
        <StatCard label="Completed" value={dashboard.completed} accent="#4A7291" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="col-span-1">
          <StatusPie dashboard={dashboard} />
        </div>
        <div className="col-span-1">
          <ProgressChart projects={projects} />
        </div>
        <div className="col-span-1 md:col-span-2 lg:col-span-1">
          <Timeline projects={projects} />
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-4">
        <div className="flex flex-wrap gap-1.5 border-b border-line">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-blueprint text-blueprint'
                  : 'border-transparent text-inkmute hover:text-ink'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-70">({tab.data.length})</span>
            </button>
          ))}
        </div>

        <ProjectTable projects={activeData} />
      </div>
    </div>
  );
}
