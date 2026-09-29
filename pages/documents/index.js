import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import PageHead from '../../components/PageHead';

// Class Tailwind ditulis penuh per kartu (bukan digabung lewat template string)
// supaya kedeteksi compiler JIT-nya Tailwind saat build.
const DOC_TYPES = [
  {
    href: '/documents/commissioning/new',
    title: 'Commissioning Report',
    desc: 'Berita acara commissioning: checklist instalasi, setting P&ID, dan hasil pengujian sistem.',
    cardClass: 'hover:border-blueprint',
    iconClass: 'bg-blueprint/10 text-blueprint',
    linkClass: 'text-blueprint',
  },
  {
    href: '/documents/handover/new',
    title: 'Handover Report',
    desc: 'Serah terima unit ke klien: daftar lengkap equipment yang terpasang per modul (RO, UF, Softener, dll).',
    cardClass: 'hover:border-teal',
    iconClass: 'bg-teal/10 text-teal',
    linkClass: 'text-teal',
  },
];

const TYPE_LABEL = {
  commissioning: { text: 'Commissioning', cls: 'bg-blueprint/10 text-blueprint border border-blueprint/20' },
  handover: { text: 'Handover', cls: 'bg-teal/10 text-teal border border-teal/20' },
};

const HISTORY_PREVIEW = 10;

function formatWhen(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts || '-');
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

// Riwayat semua dokumen yang pernah dibuat lewat halaman ini (dari tab "Document Log").
function DocumentHistory() {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    api.getDocuments().then(setDocs).catch((e) => setError(e.message));
  }, []);

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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Riwayat Dokumen</h2>
          <p className="text-xs text-inkmute mt-0.5">
            Semua dokumen yang dibuat lewat Generator Dokumen, tercatat di tab "Document Log" pada spreadsheet.
          </p>
        </div>
        {docs && docs.length > 0 && (
          <input
            type="search"
            placeholder="Cari project, PO, atau nama file..."
            className="border border-line rounded-md px-3 py-2 text-sm bg-panel outline-none focus:border-blueprint w-full sm:w-72"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </div>

      {error ? (
        <div className="bg-panel border border-line rounded-lg p-4 text-sm text-rust">
          Gagal memuat riwayat dokumen: {error}
        </div>
      ) : !docs ? (
        <div className="bg-panel border border-line rounded-lg p-5">
          <div className="skeleton-shimmer rounded-md h-4 w-2/3 mb-3" />
          <div className="skeleton-shimmer rounded-md h-4 w-1/2" />
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-panel border border-dashed border-line rounded-lg p-8 text-center">
          <p className="text-sm font-medium text-ink">Belum ada dokumen tercatat</p>
          <p className="text-xs text-inkmute mt-1">
            Dokumen yang dibuat mulai sekarang akan muncul di sini. Dokumen lama belum masuk otomatis.
          </p>
        </div>
      ) : (
        <div className="bg-panel border border-line rounded-lg overflow-hidden">
          {visible.length === 0 ? (
            <p className="text-sm text-inkmute text-center py-8">Tidak ada dokumen yang cocok.</p>
          ) : (
            <ul className="divide-y divide-line">
              {visible.map((d, i) => {
                const t = TYPE_LABEL[d.type] || { text: d.type || '-', cls: 'bg-canvas text-inkmute border border-line' };
                return (
                  <li key={`${d.timestamp}-${i}`} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-semibold rounded px-2 py-0.5 ${t.cls}`}>{t.text}</span>
                        <p className="text-sm font-medium text-ink truncate">
                          {d.projectName || d.fileName || 'Tanpa nama project'}
                        </p>
                      </div>
                      <p className="text-xs text-inkmute mt-1 truncate">
                        {[d.poNumber, formatWhen(d.timestamp), d.user].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <a
                      href={d.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-sm font-medium text-blueprint hover:underline"
                    >
                      Buka
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {docs && !query && filtered.length > HISTORY_PREVIEW && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-xs font-medium text-blueprint hover:underline self-start"
        >
          {showAll ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${filtered.length})`}
        </button>
      )}
    </div>
  );
}

export default function DocumentsHome() {
  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Generator Dokumen" />
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Generator Dokumen</h1>
        <p className="text-inkmute text-sm mt-1">
          Buat Commissioning Report atau Handover Report. Pilih project dulu di halaman berikutnya supaya PO
          Number, Nama Project, dan Client terisi otomatis -- atau lewati kalau dokumennya tidak terkait project
          yang tercatat di sini.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {DOC_TYPES.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className={`group bg-panel border border-line rounded-xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 ${d.cardClass}`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${d.iconClass}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h2 className="font-display font-semibold text-lg text-ink">{d.title}</h2>
            <p className="text-sm text-inkmute leading-relaxed">{d.desc}</p>
            <span className={`text-sm font-medium mt-auto pt-2 inline-flex items-center gap-1 group-hover:gap-2 transition-all ${d.linkClass}`}>
              Buat dokumen
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </span>
          </Link>
        ))}
      </div>

      <DocumentHistory />
    </div>
  );
}import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import PageHead from '../../components/PageHead';

// Class Tailwind ditulis penuh per kartu (bukan digabung lewat template string)
// supaya kedeteksi compiler JIT-nya Tailwind saat build.
const DOC_TYPES = [
  {
    href: '/documents/commissioning/new',
    title: 'Commissioning Report',
    desc: 'Berita acara commissioning: checklist instalasi, setting P&ID, dan hasil pengujian sistem.',
    cardClass: 'hover:border-blueprint',
    iconClass: 'bg-blueprint/10 text-blueprint',
    linkClass: 'text-blueprint',
  },
  {
    href: '/documents/handover/new',
    title: 'Handover Report',
    desc: 'Serah terima unit ke klien: daftar lengkap equipment yang terpasang per modul (RO, UF, Softener, dll).',
    cardClass: 'hover:border-teal',
    iconClass: 'bg-teal/10 text-teal',
    linkClass: 'text-teal',
  },
];

const TYPE_LABEL = {
  commissioning: { text: 'Commissioning', cls: 'bg-blueprint/10 text-blueprint border border-blueprint/20' },
  handover: { text: 'Handover', cls: 'bg-teal/10 text-teal border border-teal/20' },
};

const HISTORY_PREVIEW = 10;

function formatWhen(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts || '-');
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

// Riwayat semua dokumen yang pernah dibuat lewat halaman ini (dari tab "Document Log").
function DocumentHistory() {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    api.getDocuments().then(setDocs).catch((e) => setError(e.message));
  }, []);

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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Riwayat Dokumen</h2>
          <p className="text-xs text-inkmute mt-0.5">
            Semua dokumen yang dibuat lewat Generator Dokumen, tercatat di tab "Document Log" pada spreadsheet.
          </p>
        </div>
        {docs && docs.length > 0 && (
          <input
            type="search"
            placeholder="Cari project, PO, atau nama file..."
            className="border border-line rounded-md px-3 py-2 text-sm bg-panel outline-none focus:border-blueprint w-full sm:w-72"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </div>

      {error ? (
        <div className="bg-panel border border-line rounded-lg p-4 text-sm text-rust">
          Gagal memuat riwayat dokumen: {error}
        </div>
      ) : !docs ? (
        <div className="bg-panel border border-line rounded-lg p-5">
          <div className="skeleton-shimmer rounded-md h-4 w-2/3 mb-3" />
          <div className="skeleton-shimmer rounded-md h-4 w-1/2" />
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-panel border border-dashed border-line rounded-lg p-8 text-center">
          <p className="text-sm font-medium text-ink">Belum ada dokumen tercatat</p>
          <p className="text-xs text-inkmute mt-1">
            Dokumen yang dibuat mulai sekarang akan muncul di sini. Dokumen lama belum masuk otomatis.
          </p>
        </div>
      ) : (
        <div className="bg-panel border border-line rounded-lg overflow-hidden">
          {visible.length === 0 ? (
            <p className="text-sm text-inkmute text-center py-8">Tidak ada dokumen yang cocok.</p>
          ) : (
            <ul className="divide-y divide-line">
              {visible.map((d, i) => {
                const t = TYPE_LABEL[d.type] || { text: d.type || '-', cls: 'bg-canvas text-inkmute border border-line' };
                return (
                  <li key={`${d.timestamp}-${i}`} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-semibold rounded px-2 py-0.5 ${t.cls}`}>{t.text}</span>
                        <p className="text-sm font-medium text-ink truncate">
                          {d.projectName || d.fileName || 'Tanpa nama project'}
                        </p>
                      </div>
                      <p className="text-xs text-inkmute mt-1 truncate">
                        {[d.poNumber, formatWhen(d.timestamp), d.user].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <a
                      href={d.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-sm font-medium text-blueprint hover:underline"
                    >
                      Buka
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {docs && !query && filtered.length > HISTORY_PREVIEW && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-xs font-medium text-blueprint hover:underline self-start"
        >
          {showAll ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${filtered.length})`}
        </button>
      )}
    </div>
  );
}

export default function DocumentsHome() {
  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Generator Dokumen" />
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Generator Dokumen</h1>
        <p className="text-inkmute text-sm mt-1">
          Buat Commissioning Report atau Handover Report. Pilih project dulu di halaman berikutnya supaya PO
          Number, Nama Project, dan Client terisi otomatis -- atau lewati kalau dokumennya tidak terkait project
          yang tercatat di sini.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {DOC_TYPES.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className={`group bg-panel border border-line rounded-xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 ${d.cardClass}`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${d.iconClass}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h2 className="font-display font-semibold text-lg text-ink">{d.title}</h2>
            <p className="text-sm text-inkmute leading-relaxed">{d.desc}</p>
            <span className={`text-sm font-medium mt-auto pt-2 inline-flex items-center gap-1 group-hover:gap-2 transition-all ${d.linkClass}`}>
              Buat dokumen
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </span>
          </Link>
        ))}
      </div>

      <DocumentHistory />
    </div>
  );
}
