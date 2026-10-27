import { useRef, useState } from 'react';
import Link from 'next/link';
import useActionItems from '../lib/useActionItems';
import ProjectTable from '../components/ProjectTable';
import { SkeletonPanel, SkeletonTable } from '../components/Skeleton';
import PageHead from '../components/PageHead';
import RefreshStatus from '../components/RefreshStatus';
import TodayBanner from '../components/TodayBanner';
import PageHeader from '../components/ui/PageHeader';
import StatStrip from '../components/ui/StatStrip';
import Panel from '../components/ui/Panel';
import Segmented from '../components/ui/Segmented';
import StageFlowChart from '../components/StageFlowChart';
import DeliveryList from '../components/DeliveryList';
import DocCoverage from '../components/DocCoverage';
import { phaseOf } from '../lib/projectHelpers';

// Urutan dokumen sama dengan CHECKLIST_ITEMS di apps-script/Code.gs (dipakai kalau project belum punya checklist).
const CHECKLIST_ORDER = [
  'BOM (Bill of Materials)', 'P&ID (Drawings)', 'EWD (Electrical Wiring)', 'GAD (General Arrangement)',
  'Commissioning Report', 'Manual Book', 'Handover Report',
];

const TABS = [
  { key: 'Pre-Delivery', label: 'Sebelum kirim', hint: 'Progres di bawah 90%' },
  { key: 'Delivered', label: 'Terkirim', hint: 'Delivery sampai Manual Book' },
  { key: 'Completed', label: 'Selesai', hint: 'Hand Over' },
];

function pct(n, total) {
  return total ? `${Math.round((n / total) * 100)}% dari total` : '';
}

// Dashboard = analitik (gambaran besar). Daftar yang perlu ditindak ada di Hari Ini.
export default function Dashboard() {
  // Data terakhir langsung tampil (kalau ada), lalu disegarkan di belakang layar.
  const { projects, items, settled, missing, error, staleError, refreshing } = useActionItems();
  const [activeTab, setActiveTab] = useState('Pre-Delivery');
  const listRef = useRef(null);

  // Klik angka fase -> pilih tab yang sesuai lalu gulir ke daftar project.
  function showTab(key) {
    setActiveTab(key);
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    listRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  const header = (
    <PageHeader
      title="Dashboard"
      meta="Gambaran seluruh project: posisi di alur kerja, tenggat kirim, dan kelengkapan dokumen engineering."
      actions={
        <>
          <RefreshStatus refreshing={refreshing} staleError={staleError} />
          <Link href="/projects" className="btn btn-secondary">Semua project</Link>
        </>
      }
    />
  );

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Dashboard" />
        {header}
        <div className="bg-panel border border-line rounded-xl p-6 text-rust" role="alert">Gagal memuat data: {error}.</div>
      </div>
    );
  }

  if (!projects) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Dashboard" />
        {header}
        <div className="skeleton-shimmer rounded-xl h-[96px]" />
        <SkeletonPanel className="h-64" />
        <SkeletonTable rows={4} />
      </div>
    );
  }

  const byPhase = { 'Pre-Delivery': [], Delivered: [], Completed: [] };
  projects.forEach((p) => byPhase[phaseOf(p)].push(p));
  const total = projects.length;
  const blocked = projects.filter((p) => p.blocker).length;
  const checklistItems = CHECKLIST_ORDER.filter((it) => projects.some((p) => p.checklist?.items?.[it] !== undefined));
  const activeProjects = projects.filter((p) => p.stageProgress < 100);

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Dashboard" />
      {header}

      <TodayBanner items={items} settled={settled} missing={missing} />

      <StatStrip
        label="Jumlah project per fase"
        items={[
          { key: 'total', label: 'Total project', value: total, tone: 'ink', href: '/projects', hint: blocked > 0 ? `${blocked} terhambat` : 'Buka semua project' },
          ...TABS.map((t) => ({
            key: t.key,
            label: t.label,
            value: byPhase[t.key].length,
            tone: t.key === 'Completed' ? 'teal' : t.key === 'Delivered' ? 'blueprint' : 'muted',
            hint: pct(byPhase[t.key].length, total),
            active: activeTab === t.key,
            onClick: () => showTab(t.key),
          })),
        ]}
      />

      <Panel
        title="Posisi project di alur kerja"
        hint="Jumlah project di tiap tahap, dari PO sampai Hand Over. Klik sebuah tahap untuk melihat daftarnya."
      >
        <StageFlowChart projects={projects} />
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-6 items-start">
        <Panel title="Tenggat kirim terdekat" hint="Project yang belum dikirim, urut dari yang paling mendesak." flush>
          <DeliveryList projects={projects} />
        </Panel>
        <Panel
          title="Kelengkapan dokumen engineering"
          hint={`Dokumen Completed dari project yang memerlukannya (${activeProjects.length} project aktif dan ${total - activeProjects.length} selesai).`}
          aside={<Link href="/engineering-docs" className="tap text-sm font-medium text-blueprint hover:underline">Kelola</Link>}
        >
          <DocCoverage projects={projects} items={checklistItems} />
          <p className="flex items-center gap-4 text-xs text-inkmute mt-4">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-1.5 rounded-full bg-teal" aria-hidden="true" />Completed</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-1.5 rounded-full bg-amber/70" aria-hidden="true" />Under Review</span>
          </p>
        </Panel>
      </div>

      <section ref={listRef} aria-labelledby="dash-list" className="flex flex-col gap-3 scroll-mt-20 md:scroll-mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="dash-list" className="font-display text-lg font-semibold text-ink">Daftar project</h2>
          <Segmented
            label="Fase project"
            value={activeTab}
            onChange={setActiveTab}
            options={TABS.map((t) => ({ key: t.key, label: t.label, count: byPhase[t.key].length }))}
          />
        </div>
        {byPhase[activeTab].length === 0 ? (
          <p className="bg-panel border border-dashed border-line rounded-xl px-5 py-8 text-center text-sm text-inkmute">Tidak ada project di fase ini.</p>
        ) : (
          <ProjectTable projects={byPhase[activeTab]} />
        )}
      </section>
    </div>
  );
}
