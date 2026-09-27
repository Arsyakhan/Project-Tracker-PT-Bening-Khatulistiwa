import Link from 'next/link';
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
    </div>
  );
}
