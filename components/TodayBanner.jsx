import Link from 'next/link';
import { severityCounts } from '../lib/today';

// Ringkasan "yang perlu ditindak" untuk Dashboard. Angkanya dihitung lewat lib/today.js, sumber yang sama
// dengan halaman Hari Ini, jadi dua halaman tidak pernah menampilkan jumlah yang berbeda.
// Daftar lengkap dan siapa yang harus menindak ada di Hari Ini; Dashboard sengaja tidak mengulanginya.
export default function TodayBanner({ items, settled, missing = [] }) {
  if (!settled) return <div className="skeleton-shimmer rounded-xl h-[72px]" aria-hidden="true" />;

  const { late, soon } = severityCounts(items);
  const calm = late === 0 && soon === 0;
  const edge = late > 0 ? 'border-l-rust' : soon > 0 ? 'border-l-amber' : 'border-l-teal';

  return (
    <section
      aria-label="Perlu ditindak"
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-3 bg-panel border border-line border-l-4 ${edge} rounded-xl px-4 py-3.5 shadow-sm`}
    >
      <div className="min-w-0">
        {calm ? (
          <p className="font-display text-base font-semibold text-teal">Tidak ada yang terlambat atau mendesak</p>
        ) : (
          <p className="font-display text-base font-semibold tnum">
            <span className={late > 0 ? 'text-rust' : 'text-inkmute'}>{late} terlambat</span>
            <span className="mx-2 text-inkmute" aria-hidden="true">·</span>
            <span className={soon > 0 ? 'text-amberink' : 'text-inkmute'}>{soon} segera jatuh tempo</span>
          </p>
        )}
        <p className="text-xs text-inkmute mt-0.5">
          {missing.length > 0
            ? `Belum termasuk ${missing.join(' dan ')} (datanya belum bisa dimuat).`
            : 'Semua divisi: project, langkah berikutnya, pengadaan, dan tindak lanjut rapat.'}
        </p>
      </div>
      <Link href="/" className="btn btn-secondary max-md:w-full max-md:min-h-[40px]">Buka Hari Ini</Link>
    </section>
  );
}
