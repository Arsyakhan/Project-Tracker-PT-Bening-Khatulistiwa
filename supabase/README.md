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
| `bom` | BOM per project (`project_id` = `prj_xxxx` di Sheet): judul, revisi, `revisi_dari`, status `draf` / `final` / `diganti`, asal isi awal, siapa yang membuat dan menerbitkan |
| `bom_baris` | Baris BOM: kode barang katalog, jumlah (boleh kosong selama draf), satuan, bagian, catatan, urutan |
| `file_bom_lembar` (view) | Lembar per file BOM lama beserta jumlah barisnya (untuk memilih lembar yang disalin) |
| `pengguna` | Email dan divisi (PM, Engineering, Direksi, Warehouse & Purchasing, Technician) untuk hak akses modul gudang. Divisi `Direksi` / `Marketing & Direksi` yang aktif = yang boleh memutuskan usulan pembelian |
| `penyisihan_stok` | Stok yang disisihkan untuk satu BOM final (satu baris per kode barang). Bukan transaksi stok: hanya mengurangi stok yang tersedia untuk BOM lain |
| `stok_tersedia` (view) | Per barang: stok fisik semua lokasi, jumlah yang disisihkan BOM **final**, dan sisanya (`tersedia`). Penyisihan BOM yang sudah `diganti` tidak dihitung |
| `usulan_pembelian` | Usulan pembelian per BOM: status `draf` / `diajukan` / `disetujui` / `ditolak`, siapa dan kapan diajukan dan diputuskan, catatan keputusan. Nomor tampil `UP-0001` = id. Satu BOM hanya punya satu usulan berjalan (unique index parsial) |
| `usulan_pembelian_baris` | Barang yang diusulkan: kebutuhan BOM, jumlah yang sudah disisihkan, jumlah beli, satuan, estimasi harga satuan (Rupiah), catatan |

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
- `buat_bom(p_project_id, p_project_nama, p_judul, p_email, p_jenis, p_file_id, p_lembar, p_bom_id)`: membuat BOM dalam
  satu transaksi. `p_jenis` = `kosong`, `arsip` (salin baris BOM lama; `p_lembar` null = semua lembar; barang berstatus
  Gabung memakai kode tujuannya; jumlah 0 jadi kosong), `bom` (salin BOM lain sebagai Rev. 0 project ini), atau `revisi`
  (salin BOM final `p_bom_id` jadi draf revisi berikutnya; ditolak kalau sudah ada draf revisinya).
- `terbitkan_bom(p_id, p_email)`: draf → `final`; ditolak kalau BOM kosong atau ada jumlah kosong; revisi sebelumnya
  menjadi `diganti`.
- Trigger `bom_baris_kunci` (`cek_bom_draf`): baris hanya bisa diubah selama BOM-nya draf, dan setiap perubahan baris
  memperbarui waktu ubah BOM.
- Diuji 27 Okt 2026 di database asli dalam transaksi yang dibatalkan: salin BOM lama (2 lembar = 91 baris, sama dengan
  arsipnya; semua lembar = 254), terbit ditolak karena jumlah kosong, terbit, kunci sesudah terbit, revisi (ganda
  ditolak, revisi dari draf ditolak), terbit revisi menjadikan Rev. 0 `diganti`, salin BOM lain, BOM kosong ditolak
  saat terbit, hapus draf; tidak ada data uji yang tersisa. Ketiga fungsi hanya bisa dipanggil `service_role`.
- `sisihkan_dan_usulkan(p_bom_id, p_email)` (31 Okt 2026): untuk BOM final, menghapus penyisihan lama BOM itu, menyisihkan
  `min(kebutuhan, stok tersedia)` per kode barang, lalu membuat draf usulan untuk kekurangannya (tanpa kekurangan = hanya
  penyisihan, `usulan_id` null). Ditolak kalau BOM bukan final atau masih ada usulan draf/diajukan/disetujui. Memakai
  `pg_advisory_xact_lock` supaya dua penyisihan tidak berjalan bersamaan. Kebutuhan per kode dari `kebutuhan_bom(p_bom_id)`.
- `ajukan_usulan(p_id, p_email)`: draf → diajukan; ditolak kalau usulan kosong atau BOM-nya sudah diganti revisi baru.
- `putuskan_usulan(p_id, p_email, p_setuju, p_catatan)`: diajukan → disetujui / ditolak; penolakan wajib beralasan,
  persetujuan ditolak kalau BOM-nya sudah diganti. Hak memutuskan dicek di route server, bukan di database.
- Trigger `usulan_pembelian_baris_kunci` (`cek_usulan_draf`): baris usulan hanya bisa diubah selama usulannya draf.
- Diuji 31 Okt 2026 di database asli dalam transaksi yang dibatalkan: penyisihan dan kekurangan benar (stok 10 untuk
  kebutuhan 6 dari dua baris = disisihkan 6; stok 3 untuk kebutuhan 5 = disisihkan 3, beli 2), usulan ganda ditolak, BOM
  kedua hanya mendapat sisa stok, kunci baris sesudah diajukan, tolak tanpa alasan ditolak, usulan ulang sesudah ditolak
  menghitung ulang penyisihan, setujui draf dan putus ulang ditolak, penyisihan BOM yang diganti tidak dihitung lagi,
  ajukan dan sisihkan dari BOM yang diganti ditolak, ajukan usulan kosong ditolak; tidak ada data uji yang tersisa (nomor
  usulan di-restart ke 1). Keempat fungsi hanya bisa dipanggil `service_role`.

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
