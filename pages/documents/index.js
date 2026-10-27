import { useMemo, useState } from 'react';
import Link from 'next/link';
import useProjects from '../../lib/useProjects';
import { DOC_GENERATOR_ROUTE } from '../../lib/docgen/schema';
import { isNum } from '../../lib/projectHelpers';
import PageHead from '../../components/PageHead';
import DocsTabs from '../../components/DocsTabs';
import RefreshStatus from '../../components/RefreshStatus';
import { SkeletonTable } from '../../components/Skeleton';
import PageHeader from '../../components/ui/PageHeader';
import StatStrip from '../../components/ui/StatStrip';
import Panel from '../../components/ui/Panel';
import Segmented from '../../components/ui/Segmented';
import SearchField from '../../components/ui/SearchField';
import EmptyState from '../../components/ui/EmptyState';

// Urutan dan nama sama dengan CHECKLIST_ITEMS di apps-script/Code.gs. `short` hanya untuk judul kolom.
const DOCS = [
  { key: 'BOM (Bill of Materials)', short: 'BOM' },
  { key: 'P&ID (Drawings)', short: 'P&ID' },
  { key: 'EWD (Electrical Wiring)', short: 'EWD' },
  { key: 'GAD (General Arrangement)', short: 'GAD' },
  { key: 'Commissioning Report', short: 'Commissioning' },
  { key: 'Manual Book', short: 'Manual Book' },
  { key: 'Handover Report', short: 'Hand Over' },
];

// Status tersimpan di Sheet apa adanya (bahasa Inggris); warna hanya untuk arti.
const STATUS = {
  Completed: { tone: 'teal', dot: 'bg-teal', text: 'text-teal' },
  'Under Review': { tone: 'amber', dot: 'bg-amber', text: 'text-amberink' },
  Drafting: { tone: 'blueprint', dot: 'bg-blueprint', text: 'text-blueprint' },
  'Not Started': { tone: 'muted', dot: 'bg-inkmute/50', text: 'text-inkmute' },
};
const COUNTED = ['Completed', 'Under Review', 'Drafting', 'Not Started'];

const SCOPES = [
  { key: 'active', label: 'Aktif', test: (p) => !(p.stageProgress >= 100) },
  { key: 'done', label: 'Selesai', test: (p) => p.stageProgress >= 100 },
  { key: 'all', label: 'Semua', test: () => true },
];

function DocCell({ project, doc, status, link, dim }) {
  if (status === undefined) return <span className="text-sm text-inkmute" aria-label="Belum ada checklist">-</span>;
  if (status === 'N/A') {
    return <span className={`text-xs text-inkmute ${dim ? 'opacity-40' : ''}`} title="Tidak diperlukan untuk project ini">N/A</span>;
  }
  const s = STATUS[status] || STATUS['Not Started'];
  // Completed cukup tanda centang (paling banyak, jadi dibuat tenang); status lain ditulis supaya menonjol.
  const label = status === 'Completed' ? (
    <>
      <svg className="w-4 h-4 text-teal shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
      </svg>
      <span className="sr-only">Completed</span>
    </>
  ) : (
    <>
      <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} aria-hidden="true" />
      <span className={`${s.text} ${status === 'Not Started' ? '' : 'font-medium'}`}>{status}</span>
    </>
  );
  const gen = DOC_GENERATOR_ROUTE[doc.key];
  return (
    <span className={`inline-flex flex-col items-start gap-0.5 ${dim ? 'opacity-40' : ''}`}>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          title={`${status}. Buka ${doc.key}`}
          className="tap inline-flex items-center gap-1.5 text-xs whitespace-nowrap underline decoration-line underline-offset-4 hover:decoration-current"
        >
          {label}
        </a>
      ) : (
        <span title={status} className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">{label}</span>
      )}
      {!link && gen && status !== 'Completed' && (
        <Link
          href={`/documents/${gen}/new?projectId=${encodeURIComponent(project.id)}`}
          className="tap text-xs font-medium text-blueprint hover:underline"
        >
          Buat
        </Link>
      )}
    </span>
  );
}

// Versi ringkas untuk HP: nama dokumen + status dalam satu label kecil, berderet.
function DocChip({ project, doc, status, link, dim }) {
  const s = STATUS[status];
  const done = status === 'Completed';
  const body = (
    <>
      <span className={done ? 'text-ink' : 'text-inkmute'}>{doc.short}</span>
      {done ? (
        <svg className="w-3.5 h-3.5 text-teal" viewBox="0 0 20 20" fill="currentColor" role="img" aria-label="Completed">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
      ) : s ? (
        <span className={`inline-flex items-center gap-1 ${s.text} font-medium`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
          {status}
        </span>
      ) : (
        <span className="text-inkmute">{status === undefined ? '-' : status}</span>
      )}
    </>
  );
  const cls = `inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs ${
    done || status === 'N/A' || status === undefined ? 'border-line bg-canvas/60' : 'border-line bg-panel'
  } ${dim ? 'opacity-40' : ''}`;
  if (link) {
    return <a href={link} target="_blank" rel="noopener noreferrer" className={`${cls} hover:border-blueprint`}>{body}</a>;
  }
  const gen = DOC_GENERATOR_ROUTE[doc.key];
  if (gen && s && !done) {
    return (
      <Link href={`/documents/${gen}/new?projectId=${encodeURIComponent(project.id)}`} className={`${cls} hover:border-blueprint`} title={`Buat ${doc.key}`}>
        {body}
        <span className="text-blueprint font-medium">Buat</span>
      </Link>
    );
  }
  return <span className={cls}>{body}</span>;
}

function Progress({ value }) {
  const v = isNum(value) ? Math.max(0, Math.min(100, value)) : null;
  return (
    <span className="flex items-center gap-2 justify-end">
      <span className="font-data tnum text-sm font-semibold text-ink w-10 text-right">{v === null ? '-' : `${v}%`}</span>
      <span className="w-14 h-1.5 rounded-full bg-line overflow-hidden" aria-hidden="true">
        <span className={`block h-full rounded-full ${v === 100 ? 'bg-teal' : 'bg-blueprint'}`} style={{ width: `${v || 0}%` }} />
      </span>
    </span>
  );
}

// Checklist engineering lintas project: satu baris per project, tujuh dokumen berjajar,
// supaya terlihat sekaligus dokumen mana yang tertinggal. Status diubah di tab Checklist pada detail project.
export default function EngineeringChecklist() {
  const { projects, error, staleError, refreshing } = useProjects();
  const [scope, setScope] = useState('active');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const inScope = useMemo(() => {
    if (!projects) return [];
    const test = SCOPES.find((s) => s.key === scope).test;
    return projects.filter(test);
  }, [projects, scope]);

  // Jumlah dokumen per status, dan berapa project yang punya status itu.
  const counts = useMemo(() => {
    const c = Object.fromEntries(COUNTED.map((k) => [k, { docs: 0, projects: 0 }]));
    inScope.forEach((p) => {
      const seen = new Set();
      DOCS.forEach((d) => {
        const s = p.checklist?.items?.[d.key];
        if (!c[s]) return;
        c[s].docs += 1;
        seen.add(s);
      });
      seen.forEach((s) => { c[s].projects += 1; });
    });
    return c;
  }, [inScope]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inScope
      .filter((p) => !q || [p.projectName, p.poNumber, p.client, p.pic].some((v) => String(v || '').toLowerCase().includes(q)))
      .filter((p) => !statusFilter || DOCS.some((d) => p.checklist?.items?.[d.key] === statusFilter))
      // Yang paling dekat Hand Over di atas: dokumennya paling mendesak dilengkapi.
      .sort((a, b) => (b.stageProgress || 0) - (a.stageProgress || 0) || String(a.projectName).localeCompare(String(b.projectName)));
  }, [inScope, query, statusFilter]);

  const scopeCounts = useMemo(
    () => Object.fromEntries(SCOPES.map((s) => [s.key, (projects || []).filter(s.test).length])),
    [projects]
  );

  const header = (
    <PageHeader
      title="Dokumen"
      meta="Status 7 dokumen engineering tiap project. Klik status untuk membuka dokumennya; ubah status di tab Checklist pada detail project."
      actions={<RefreshStatus refreshing={refreshing && !!projects} staleError={staleError} />}
      nav={<DocsTabs active="checklist" />}
    />
  );

  if (error && !projects) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Checklist dokumen" />
        {header}
        <div className="bg-panel border border-line rounded-xl p-6 text-rust" role="alert">Gagal memuat data: {error}</div>
      </div>
    );
  }

  if (!projects) {
    return (
      <div className="flex flex-col gap-6">
        <PageHead title="Checklist dokumen" />
        {header}
        <div className="skeleton-shimmer rounded-xl h-[84px]" />
        <SkeletonTable rows={6} />
      </div>
    );
  }

  const isDim = (status) => !!statusFilter && status !== statusFilter;

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Checklist dokumen" />
      {header}

      <StatStrip
        label="Jumlah dokumen per status"
        items={COUNTED.map((k) => ({
          key: k,
          label: k,
          value: counts[k].docs,
          tone: STATUS[k].tone,
          hint: statusFilter === k ? 'Klik lagi untuk semua status' : `di ${counts[k].projects} project`,
          active: statusFilter === k,
          dim: !!statusFilter && statusFilter !== k,
          onClick: () => setStatusFilter((v) => (v === k ? '' : k)),
        }))}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SearchField
          className="w-full sm:w-80"
          value={query}
          onChange={setQuery}
          placeholder="Cari project, PO, client, PIC..."
          label="Cari project di checklist"
        />
        <Segmented
          label="Project yang ditampilkan"
          value={scope}
          onChange={setScope}
          options={SCOPES.map((s) => ({ key: s.key, label: s.label, count: scopeCounts[s.key] }))}
        />
        {statusFilter && (
          <button type="button" onClick={() => setStatusFilter('')} className="tap text-sm font-medium text-blueprint hover:underline sm:ml-auto">
            Hapus filter status
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Tidak ada project yang cocok">
          {statusFilter ? `Tidak ada dokumen berstatus ${statusFilter} di project yang ditampilkan.` : 'Ubah pencarian atau pilihan Aktif / Selesai / Semua.'}
        </EmptyState>
      ) : (
        <Panel flush>
          {/* Layar lebar: matriks project x dokumen */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Status dokumen engineering per project</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-inkmute">
                  <th scope="col" className="px-5 py-3 font-medium min-w-[14rem]">Project</th>
                  {DOCS.map((d) => (
                    <th key={d.key} scope="col" title={d.key} className="px-2.5 py-3 font-medium whitespace-nowrap">{d.short}</th>
                  ))}
                  <th scope="col" className="px-5 py-3 font-medium text-right">Progres</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => (
                  <tr key={p.id} className="align-top hover:bg-canvas/50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/projects/${encodeURIComponent(p.id)}?tab=checklist`} className="font-medium text-ink hover:text-blueprint line-clamp-2">
                        {p.projectName || p.poNumber}
                      </Link>
                      <span className="block text-xs text-inkmute mt-0.5 truncate max-w-[18rem]">
                        <span className="font-data">{p.poNumber || 'Tanpa PO'}</span>
                        {p.client ? ` · ${p.client}` : ''}
                      </span>
                    </td>
                    {DOCS.map((d) => {
                      const status = p.checklist?.items?.[d.key];
                      return (
                        <td key={d.key} className="px-2.5 py-3">
                          <DocCell project={p} doc={d} status={status} link={p.checklist?.links?.[d.key]} dim={isDim(status)} />
                        </td>
                      );
                    })}
                    <td className="px-5 py-3"><Progress value={p.checklist?.progress ?? p.engineeringDocProgress} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* HP: satu kartu per project */}
          <ul className="md:hidden divide-y divide-line">
            {rows.map((p) => (
              <li key={p.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/projects/${encodeURIComponent(p.id)}?tab=checklist`} className="font-medium text-ink hover:text-blueprint">
                      {p.projectName || p.poNumber}
                    </Link>
                    <span className="block text-xs text-inkmute mt-0.5 truncate">
                      <span className="font-data">{p.poNumber || 'Tanpa PO'}</span>
                      {p.client ? ` · ${p.client}` : ''}
                    </span>
                  </div>
                  <Progress value={p.checklist?.progress ?? p.engineeringDocProgress} />
                </div>
                <ul className="flex flex-wrap gap-1.5 mt-3" aria-label="Status dokumen">
                  {DOCS.map((d) => {
                    const status = p.checklist?.items?.[d.key];
                    return (
                      <li key={d.key}>
                        <DocChip project={p} doc={d} status={status} link={p.checklist?.links?.[d.key]} dim={isDim(status)} />
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
