# Database Supabase modul gudang

Project Supabase **bening-hub** (organisasi "Arsyakhan's Org", paket gratis, region `ap-southeast-1` Singapura,
ref `hqzxrcdbzfvtonounoau`). Dibuat 27 Okt 2026 untuk modul gudang: katalog barang, BOM, stok, pengadaan, serah terima.
Data project tetap di Google Sheet; penghubungnya Project ID `prj_xxxx`.

## Tabel (lihat `migrations/`)

| Tabel | Isi |
|---|---|
| `kategori_barang` | 13 kategori dan kode prefiksnya (PMP, MBR, PVS, FLT, VLV, INS, FTG, TNK, MDA, ELK, HRD, EQP, LAN) |
| `barang` | Katalog: kode (mis. `FTG-0079`), nama, spesifikasi, ukuran, material, merek, model, satuan, foto (tautan Drive), stok minimum, status cek |
| `file_bom` | Semua file BOM/BOQ yang pernah diimpor dari Dropbox: project, revisi, tanggal ubah, revisi terakhir, lokasi |
| `baris_bom_arsip` | Baris BOM apa adanya dari file lama, masing-masing dengan `barang_kode` |
| `lokasi_gudang` | Lokasi gudang. `UTAMA` (Gudang utama) dibuat 27 Okt 2026; lokasi lain ditambah dari halaman Stock Opname |
| `transaksi_stok` | Buku besar stok: saldo awal, masuk, keluar, kembali, penyesuaian. Stok = jumlah transaksi, tidak disimpan sebagai angka. `opname_id` menunjuk sesi opname asalnya |
| `stok_barang` (view) | Stok per barang hasil penjumlahan `transaksi_stok` (semua lokasi) |
| `stok_per_lokasi` (view) | Stok per barang per lokasi, plus jumlah transaksinya (0 transaksi = belum punya saldo awal di lokasi itu) |
| `stock_opname` | Sesi stock opname: judul, lokasi, tanggal, status `draf` / `selesai`, siapa yang membuat dan memposting |
| `stock_opname_baris` | Hitungan per barang di satu sesi (satu baris per barang per sesi), siapa yang menghitung dan kapan |
| `pengguna` | Email dan divisi (PM, Engineering, Direksi, Warehouse & Purchasing, Technician) untuk hak akses modul gudang |

## Fungsi dan trigger

- `posting_opname(p_id, p_email)`: memposting satu sesi opname dalam satu transaksi database. Barang yang belum pernah
  punya transaksi di lokasi sesi menjadi `saldo_awal` (hitungan 0 dilewati); barang yang sudah punya menjadi
  `penyesuaian` sebesar selisih hitungan dengan stok di lokasi itu; yang sama tidak dicatat. Barang yang tidak dihitung
  tidak berubah. Sesi dikunci `FOR UPDATE`, jadi tidak bisa diposting dua kali. Hanya `service_role` yang boleh
  memanggilnya (dicabut dari `public`, `anon`, `authenticated`).
- Trigger `stock_opname_baris_kunci` (`cek_opname_draf`): hitungan hanya bisa ditambah, diubah, atau dihapus selama
  sesinya `draf`. Sesi yang sudah diposting juga tidak bisa dihapus karena transaksinya menunjuk sesi itu.
- Diuji 27 Okt 2026 di database asli dalam transaksi yang dibatalkan: posting pertama (saldo awal), kunci sesudah
  posting, tolak posting ulang, posting kedua (penyesuaian), hapus draf; tidak ada data uji yang tersisa.

## Keamanan

- Semua tabel memakai RLS **tanpa policy**: kunci publik (publishable/anon) tidak bisa membaca atau menulis apa pun
  (diuji 27 Okt 2026: `GET /rest/v1/barang` dengan kunci publik membalas `[]`). Peringatan "RLS Enabled No Policy" di
  Advisors memang disengaja.
- Web mengakses lewat route server Bening Hub (setelah sesi NextAuth dicek) memakai **kunci rahasia** (`sb_secret_...`)
  yang disimpan di env Vercel. Kunci rahasia tidak pernah dikirim ke browser dan tidak ditulis di repo.

## Data awal (27 Okt 2026)

Diimpor dari Dropbox `BK Eng drop box` (116 file: 51 BOM project semua revisi, 47 BOM/BOQ penawaran, 13 daftar
Material Ordered, 3 daftar pressure vessel, 1 template elektrikal): 2.220 barang, 116 file, 16.998 baris BOM.
Salinan Excel yang sama ada di Dropbox `BK Eng drop box/DATABASE GUDANG/Database BOM dan Katalog Barang (draf).xlsx`
untuk diperiksa W&P dan Engineering (kolom "Status cek"). Harga di BOQ penawaran tidak disalin.
Impor memakai fungsi RPC sementara berkunci token sekali pakai, yang langsung dihapus sesudahnya (tidak ada di repo).

## Dipakai di web

Halaman Katalog Barang (`/gudang/katalog`) membaca dan mengubah tabel `barang` lewat `pages/api/gudang.js`
(lihat CLAUDE.md, "Database Supabase modul gudang"). Pemeriksaan katalog (kolom `status_cek`, `gabung_ke`, `catatan`)
dilakukan di halaman itu; berkas Excel draf hanya salinan awal. Setiap simpan mengisi `diubah_oleh` (email) dan
`diubah_pada` (trigger), yang sekaligus dipakai untuk mendeteksi edit bersamaan.
