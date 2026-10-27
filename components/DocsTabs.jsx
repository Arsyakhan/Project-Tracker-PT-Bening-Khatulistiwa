import Segmented from './ui/Segmented';

const TABS = [
  { key: 'checklist', href: '/documents', label: 'Checklist engineering' },
  { key: 'generator', href: '/documents/generator', label: 'Buat dokumen' },
];

// Navigasi bagian Dokumen (di bawah judul halaman): status 7 dokumen engineering lintas project,
// lalu pembuatan Commissioning dan Hand Over beserta riwayatnya.
export default function DocsTabs({ active }) {
  return (
    <nav aria-label="Bagian dokumen">
      <Segmented options={TABS} value={active} />
    </nav>
  );
}
