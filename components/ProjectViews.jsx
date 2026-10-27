import Segmented from './ui/Segmented';

const VIEWS = [
  { key: 'list', href: '/projects', label: 'Daftar' },
  { key: 'kanban', href: '/projects/kanban', label: 'Kanban' },
];

// Pilihan tampilan menu Project: daftar (tabel, filter, ekspor) atau papan Kanban per tahap.
// Datanya sama, hanya cara melihatnya yang berbeda.
export default function ProjectViews({ active }) {
  return (
    <nav aria-label="Tampilan project">
      <Segmented options={VIEWS} value={active} />
    </nav>
  );
}
