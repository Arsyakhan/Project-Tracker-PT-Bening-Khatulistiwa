import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { api } from '../lib/api';
import StatCard from '../components/StatCard';
import StatusPie from '../components/StatusPie';
import ProgressChart from '../components/ProgressChart';
import Timeline from '../components/Timeline';
import ProjectTable from '../components/ProjectTable';
import { SkeletonStatCards, SkeletonPanel, SkeletonTable } from '../components/Skeleton';

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

  // Membagi project ke dalam 3 kategori
  const preDeliveryProjects = projects.filter((p) => p.stageProgress < 90);
  const deliveredProjects = projects.filter((p) => p.stageProgress >= 90 && p.stageProgress < 100);
  const completedProjects = projects.filter((p) => p.stageProgress >= 100);

  // Project yang sudah lewat deadline atau tinggal ≤7 hari lagi (dan belum selesai)
  const riskyProjects = projects
    .filter((p) => {
      if (p.stageProgress >= 100) return false;
      const d = p.daysRemaining;
      return d !== '' && d !== null && d !== undefined && Number(d) <= 7;
    })
    .sort((a, b) => Number(a.daysRemaining) - Number(b.daysRemaining));

  const tabs = [
    { key: 'preDelivery', label: 'Pre-Delivery', data: preDeliveryProjects },
    { key: 'delivered', label: 'Delivered', data: deliveredProjects },
    { key: 'completed', label: 'Completed', data: completedProjects },
  ];
  const activeData = tabs.find((t) => t.key === activeTab)?.data || [];

  return (
    <div className="flex flex-col gap-6">
      <Head><title>Dashboard — Project Tracker</title></Head>
      <h1 className="font-display text-2xl font-semibold text-ink">Dashboard Progress</h1>

      {riskyProjects.length > 0 && (
        <section className="bg-panel border border-rust/25 rounded-lg p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-rust" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <h2 className="font-display font-semibold text-ink">Perlu Perhatian</h2>
            <span className="text-xs text-inkmute">({riskyProjects.length} project)</span>
          </div>
          <div className="flex flex-col divide-y divide-line">
            {riskyProjects.slice(0, 5).map((p) => (
              <Link
                key={p.poNumber}
                href={`/projects/${encodeURIComponent(p.poNumber)}`}
                className="flex items-center justify-between gap-3 py-2.5 -mx-2 px-2 rounded-md hover:bg-canvas/60 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{p.projectName}</p>
                  <p className="text-xs text-inkmute">{p.poNumber} &middot; {p.currentStage}</p>
                </div>
                <span
                  className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-md ${
                    Number(p.daysRemaining) < 0 ? 'bg-rust/10 text-rust' : 'bg-amber/10 text-amber'
                  }`}
                >
                  {Number(p.daysRemaining) < 0
                    ? `Terlambat ${Math.abs(p.daysRemaining)} hari`
                    : Number(p.daysRemaining) === 0
                    ? 'Jatuh tempo hari ini'
                    : `${p.daysRemaining} hari lagi`}
                </span>
              </Link>
            ))}
          </div>
          {riskyProjects.length > 5 && (
            <Link href="/projects" className="text-xs text-blueprint hover:underline self-start">
              Lihat semua ({riskyProjects.length}) →
            </Link>
          )}
        </section>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Project" value={dashboard.total} accent="#0C2D48" />
        <StatCard label="Pre-Delivery" value={dashboard.preDelivery} accent="#0077B6" />
        <StatCard label="Delivered" value={dashboard.delivered} accent="#009688" />
        <StatCard label="Completed" value={dashboard.completed} accent="#4A7291" />
      </div>

      {/* Layout Widget Chart & Timeline - 1 kolom mobile, 2 kolom tablet, 3 kolom desktop */}
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

      {/* Daftar Project - dikelompokkan lewat tab, bukan ditumpuk semua */}
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
