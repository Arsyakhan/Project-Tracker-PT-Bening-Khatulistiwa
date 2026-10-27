import { useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import PageHead from '../../components/PageHead';
import DocsTabs from '../../components/DocsTabs';
import RefreshStatus from '../../components/RefreshStatus';
import useCachedResource from '../../lib/useCachedResource';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import SearchField from '../../components/ui/SearchField';
import { nameFromEmail } from '../../lib/projectHelpers';

// Class Tailwind ditulis penuh per kartu (bukan digabung lewat template string)
// supaya kedeteksi compiler JIT-nya Tailwind saat build.
const DOC_TYPES = [
  {
    key: 'commissioning',
    href: '/documents/commissioning/new',
    title: 'Commissioning Report',
    desc: 'Berita acara commissioning: checklist instalasi, setting P&ID, dan hasil pengujian sistem.',
    uses: 'PO, client, lokasi plant, kontak owner, dan sistem dari Teknologi',
    iconClass: 'bg-blueprint/10 text-blueprint',
  },
  {
    key: 'handover',
    href: '/documents/handover/new',
    title: 'Handover Report',
    desc: 'Serah terima unit ke klien: daftar peralatan terpasang per modul, seperti RO, UF, dan softener.',
    uses: 'Modul yang dicentang di Teknologi dan isi Spesifikasi Peralatan',
    iconClass: 'bg-teal/10 text-teal',
  },
];

const TYPE_LABEL = {
  commissioning: { text: 'Commissioning', cls: 'bg-blueprint/10 text-blueprint border border-blueprint/20' },
  handover: { text: 'Handover', cls: 'bg-teal/10 text-teal border border-teal/20' },
};

function fmtDay(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const HISTORY_PREVIEW = 10;

function formatWhen(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts || '-');
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

// Riwayat semua dokumen yang pernah dibuat lewat halaman ini (dari tab "Document Log").
function DocumentHistory({ docs, error }) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    if (!docs) return [];
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        String(d.projectName || '').toLowerCase().includes(q) ||
        String(d.poNumber || '').toLowerCase().includes(q) ||
        String(d.fileName || '').toLowerCase().includes(q) ||
        String(d.user || '').toLowerCase().includes(q)
    );
  }, [docs, query]);

  const visible = showAll || query ? filtered : filtered.slice(0, HISTORY_PREVIEW);

  return (
    <Panel
      title="Riwayat dokumen"
      hint='Semua dokumen yang dibuat melalui generator, tercatat di tab "Document Log" pada spreadsheet.'
      aside={docs && docs.length > 0 && (
        <SearchField className="hidden sm:block w-64" value={query} onChange={setQuery} placeholder="Cari project, PO, atau file..." label="Cari riwayat dokumen" />
      )}
      flush
    >
      {docs && docs.length > 0 && (
        <div className="sm:hidden px-5 pt-3">
          <SearchField value={query} onChange={setQuery} placeholder="Cari project, PO, atau file..." label="Cari riwayat dokumen" />
        </div>
      )}
      {error ? (
        <p className="px-5 py-6 text-sm text-rust">Gagal memuat riwayat dokumen: {error}</p>
      ) : !docs ? (
        <div className="p-5 flex flex-col gap-3">
          <div className="skeleton-shimmer rounded-md h-4 w-2/3" />
          <div className="skeleton-shimmer rounded-md h-4 w-1/2" />
        </div>
      ) : docs.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-semibold text-ink">Belum ada dokumen tercatat</p>
          <p className="text-sm text-inkmute mt-1">Dokumen yang dibuat mulai sekarang akan muncul di sini. Dokumen lama belum masuk otomatis.</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-inkmute text-center py-8">Tidak ada dokumen yang cocok.</p>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((d, i) => {
            const t = TYPE_LABEL[d.type] || { text: d.type || '-', cls: 'bg-canvas text-inkmute border border-line' };
            return (
              <li key={`${d.timestamp}-${i}`} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[7.5rem_minmax(0,1fr)_10rem_auto] items-center gap-x-4 gap-y-1 px-5 py-3">
                <span className={`hidden sm:inline-flex w-fit text-xs font-medium rounded-md px-2 leading-5 ${t.cls}`}>{t.text}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink truncate">{d.projectName || d.fileName || 'Tanpa nama project'}</span>
                  <span className="block text-xs text-inkmute truncate mt-0.5">
                    <span className="sm:hidden">{t.text} · </span>
                    <span className="font-data">{d.poNumber || 'Tanpa PO'}</span>
                  </span>
                </span>
                <span className="hidden sm:block min-w-0 text-xs text-inkmute" title={formatWhen(d.timestamp)}>
                  <span className="block text-ink tnum">{fmtDay(d.timestamp)}</span>
                  <span className="block truncate">{nameFromEmail(d.user)}</span>
                </span>
                <a href={d.documentUrl} target="_blank" rel="noopener noreferrer" className="tap text-sm font-medium text-blueprint hover:underline justify-self-end">
                  Buka
                </a>
              </li>
            );
          })}
        </ul>
      )}
      {docs && !query && filtered.length > HISTORY_PREVIEW && (
        <div className="px-5 py-3 border-t border-line">
          <button onClick={() => setShowAll((v) => !v)} className="tap text-sm font-medium text-blueprint hover:underline">
            {showAll ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${filtered.length})`}
          </button>
        </div>
      )}
    </Panel>
  );
}

export default function DocumentsHome() {
  // Riwayat terakhir langsung tampil (kalau ada), lalu disegarkan di belakang layar.
  const { data: docs, error, staleError, refreshing } = useCachedResource('documents', () => api.getDocuments());
  const stats = useMemo(() => {
    const out = {};
    (docs || []).forEach((d) => {
      const s = out[d.type] || (out[d.type] = { count: 0, last: '' });
      s.count += 1;
      if (!s.last || String(d.timestamp) > String(s.last)) s.last = d.timestamp;
    });
    return out;
  }, [docs]);

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Generator Dokumen" />
      <PageHeader
        title="Generator Dokumen"
        meta="Buat Commissioning Report atau Handover Report dari data project. Pilih project di halaman berikutnya agar isiannya terisi otomatis."
        actions={<RefreshStatus refreshing={refreshing && !!docs} staleError={staleError} />}
        nav={<DocsTabs active="generator" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {DOC_TYPES.map((d) => {
          const st = stats[d.key];
          return (
            <section key={d.href} className="bg-panel border border-line rounded-xl shadow-sm flex flex-col">
              <div className="p-5 sm:p-6 flex flex-col gap-3 flex-1">
                <div className="flex items-start gap-3.5">
                  <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${d.iconClass}`} aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display font-semibold text-lg text-ink leading-tight">{d.title}</h2>
                    <p className="text-sm text-inkmute leading-relaxed mt-1">{d.desc}</p>
                  </div>
                </div>
                <p className="text-xs text-inkmute border-t border-line pt-3 mt-auto">
                  <span className="font-medium text-ink">Diisi otomatis dari project:</span> {d.uses}.
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3.5 border-t border-line bg-canvas/50 rounded-b-xl">
                <span className="text-xs text-inkmute tnum">
                  {st ? `${st.count} dibuat, terakhir ${fmtDay(st.last)}` : docs ? 'Belum pernah dibuat' : ''}
                </span>
                <Link href={d.href} className="btn btn-primary">Buat dokumen</Link>
              </div>
            </section>
          );
        })}
      </div>

      <DocumentHistory docs={docs} error={error} />
    </div>
  );
}
