import Segmented from './ui/Segmented';

const TABS = [
  { key: 'generator', href: '/documents', label: 'Generator dokumen' },
  { key: 'meetings', href: '/documents/meetings', label: 'Notulensi rapat' },
];

// Navigasi bagian Dokumen (di bawah judul halaman).
export default function DocsTabs({ active }) {
  return (
    <nav aria-label="Bagian dokumen">
      <Segmented options={TABS} value={active} />
    </nav>
  );
}
