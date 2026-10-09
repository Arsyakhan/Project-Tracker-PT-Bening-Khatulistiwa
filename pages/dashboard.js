import { useRef, useState } from 'react';
import useProjects from '../lib/useProjects';
import StatCard from '../components/StatCard';
import StatusPie from '../components/StatusPie';
import ProgressChart from '../components/ProgressChart';
import Timeline from '../components/Timeline';
import ProjectTable from '../components/ProjectTable';
import { SkeletonStatCards, SkeletonPanel, SkeletonTable } from '../components/Skeleton';
import PageHead from '../components/PageHead';
import AttentionPanel from '../components/AttentionPanel';
import RefreshStatus from '../components/RefreshStatus';
import MeetingSummary from '../components/MeetingSummary';
import ProcurementSummary from '../components/ProcurementSummary';

export default function Dashboard() {
  // Data terakhir langsung tampil (kalau ada), lalu disegarkan di belakang layar.
  const { projects, error, staleError, refreshing } = useProjects();
  const [activeTab, setActiveTab] = useState('preDelivery');
  const listRef = useRef(null);

  // Klik kartu statistik -> pilih tab yang sesuai lalu gulir ke daftar project.
  function showTab(key) {
    setActiveTab(key);
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    listRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

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

  const dashboard = {
    total: projects.length,
    preDelivery: preDeliveryProjects.length,
    delivered: deliveredProjects.length,
    completed: completedProjects.length,
  };

  const tabs = [
    { key: 'preDelivery', label: 'Pre-Delivery', data: preDeliveryProjects },
    { key: 'delivered', label: 'Delivered', data: deliveredProjects },
    { key: 'completed', label: 'Completed', data: completedProjects },
  ];
  const activeData = tabs.find((t) => t.key === activeTab)?.data || [];

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Dashboard" />
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">Dashboard Progress</h1>
        <RefreshStatus refreshing={refreshing} staleError={staleError} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Project"
          value={dashboard.total}
          accent="rgb(var(--color-ink))"
          href="/projects"
          hint="Buka semua project →"
        />
        <StatCard
          label="Pre-Delivery"
          value={dashboard.preDelivery}
          accent="rgb(var(--color-blueprint))"
          onClick={() => showTab('preDelivery')}
          active={activeTab === 'preDelivery'}
          hint={activeTab === 'preDelivery' ? 'Sedang ditampilkan' : 'Lihat daftar ↓'}
        />
        <StatCard
          label="Delivered"
          value={dashboard.delivered}
          accent="rgb(var(--color-teal))"
          onClick={() => showTab('delivered')}
          active={activeTab === 'delivered'}
          hint={activeTab === 'delivered' ? 'Sedang ditampilkan' : 'Lihat daftar ↓'}
        />
        <StatCard
          label="Completed"
          value={dashboard.completed}
          accent="rgb(var(--color-inkmute))"
          onClick={() => showTab('completed')}
          active={activeTab === 'completed'}
          hint={activeTab === 'completed' ? 'Sedang ditampilkan' : 'Lihat daftar ↓'}
        />
      </div>

      <MeetingSummary />

      <ProcurementSummary />

      <AttentionPanel projects={projects} />

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

      <div ref={listRef} className="flex flex-col gap-3 mt-4 scroll-mt-20 md:scroll-mt-6">
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
