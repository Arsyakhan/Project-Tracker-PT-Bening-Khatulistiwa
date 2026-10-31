import Segmented from '../ui/Segmented';

const TABS = [
  { key: 'opname', href: '/gudang/opname', label: 'Stock opname' },
  { key: 'serah', href: '/gudang/serah-terima', label: 'Serah terima' },
];

// Navigasi bagian Stok Gudang (di bawah judul halaman): hitung stok di gudang, lalu barang keluar ke teknisi.
export default function StokTabs({ active }) {
  return (
    <nav aria-label="Bagian stok gudang">
      <Segmented options={TABS} value={active} />
    </nav>
  );
}
