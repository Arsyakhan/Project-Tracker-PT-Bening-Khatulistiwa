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
| `jenis_barang` | Daftar jenis per kategori menurut bentuk fisik (mis. Tangki PE / PP / FRP / SS; Pompa vertikal multistage / horizontal multistage / dosing; Ball valve / Check valve; ...), dengan urutan tampil. `barang.jenis` menunjuk ke sini (kunci asing gabungan kategori + jenis) |
| `barang_cadangan_20261031` | Salinan tabel `barang` sesaat sebelum penataan kategori/jenis 31 Okt 2026 (untuk mengembalikan kalau perlu) |
| `pengguna` | Email dan divisi (PM, Engineering, Direksi, Warehouse & Purchasing, Technician) untuk hak akses modul gudang. Divisi `Direksi` / `Marketing & Direksi` yang aktif = yang boleh memutuskan usulan pembelian |
| `penyisihan_stok` | Stok yang disisihkan untuk satu BOM final (satu baris per kode barang). Bukan transaksi stok: hanya mengurangi stok yang tersedia untuk BOM lain |
| `stok_tersedia` (view) | Per barang: stok fisik semua lokasi, jumlah yang disisihkan BOM **final**, dan sisanya (`tersedia`). Penyisihan BOM yang sudah `diganti` tidak dihitung |
| `usulan_pembelian` | Usulan pembelian per BOM: status `draf` / `diajukan` / `disetujui` / `ditolak`, siapa dan kapan diajukan dan diputuskan, catatan keputusan. Nomor tampil `UP-0001` = id. Satu BOM hanya punya satu usulan berjalan (unique index parsial) |
| `usulan_pembelian_baris` | Barang yang diusulkan: kebutuhan BOM, jumlah yang sudah disisihkan, jumlah beli, satuan, estimasi harga satuan (Rupiah), catatan, `qty_diterima` (jumlah yang sudah datang di gudang) |
| `serah_terima` | Dokumen serah terima barang ke teknisi (1 Nov 2026): project, penerima, tanggal, lokasi asal, catatan, siapa yang mencatat. Nomor tampil `ST-0001` = id. Barisnya adalah transaksi `keluar` di `transaksi_stok` yang menunjuk dokumen ini |

| `foto_barang` | Foto barang (1 Nov 2026): `sumber` `gudang` (foto asli dari W&P; `path` dan `path_kecil` di bucket Storage privat `foto-barang`) atau `internet` (hanya `url` gambar + `halaman_sumber`, tidak disalin). `opname_id` kalau diambil saat stock opname |
| `foto_utama` (view) | Satu foto per barang: foto gudang terbaru, kalau belum ada foto internet terbaru |

Bucket Storage `foto-barang` (migrasi `20261101000400`): privat, JPEG saja, maks 3 MB per berkas; tanpa policy, jadi
hanya kunci rahasia server yang bisa membaca/menulis (diuji 1 Nov 2026: unggah dengan kunci publik ditolak RLS).

Kolom tambahan 1 Nov 2026: `usulan_pembelian.no_po`, `tanggal_pesan`, `eta`, `dipesan_oleh`, `dipesan_pada` (pemesanan
oleh W&P); `transaksi_stok.usulan_baris_id` (barang masuk dari usulan), `serah_terima_id` dan `bom_id` (barang keluar ke
teknisi untuk BOM tertentu).

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
- Revisi BOM (migrasi `20261031000200`): `disetujui_revisi_lama(p_bom_id)` menjumlahkan jumlah beli usulan `disetujui` di
  semua revisi sebelumnya. `sisihkan_dan_usulkan` menganggap jumlah itu akan datang: sisihkan = min(kebutuhan - sudah
  disetujui, stok tersedia), beli = sisanya (kolom `qty_disetujui_sebelumnya`), jadi revisi tidak memicu pembelian ganda.
- `kembalikan_usulan(p_id, p_email, p_catatan)` (migrasi `20261031000300`): diajukan → draf dengan catatan apa yang perlu
  dilengkapi (wajib); disimpan di `dikembalikan_oleh`, `dikembalikan_pada`, `catatan_dikembalikan`. Kolom baru
  `usulan_pembelian.vendor` dan `tautan_penawaran` (harus `https://`, dicek database) untuk dilihat Direksi.
- **Pemesanan, penerimaan, dan serah terima** (migrasi `20261101000100`, 1 Nov 2026):
  - Pemesanan hanya mengisi kolom usulan yang sudah `disetujui` (nomor PO, tanggal pesan, ETA), lewat route server.
  - `terima_barang(p_usulan_id, p_email, p_lokasi, p_tanggal, p_referensi, p_items)`: `p_items` = `[{baris_id, qty}]`.
    Usulan harus `disetujui`, jumlah tidak boleh melebihi sisa (`qty_beli - qty_diterima`). Per baris: transaksi `masuk`
    (dengan `usulan_baris_id`), `qty_diterima` bertambah, dan **penyisihan BOM pemesan bertambah** sebanyak yang diterima,
    jadi barangnya langsung tercatat milik project itu.
  - `serahkan_barang(p_project_id, p_project_nama, p_email, p_penerima, p_tanggal, p_lokasi, p_catatan, p_items)`:
    `p_items` = `[{bom_id, barang_kode, qty}]`, hasilnya id dokumen. Tiap barang harus disisihkan untuk BOM final project
    itu, jumlahnya tidak boleh melebihi penyisihan maupun stok di lokasi asal. Membuat dokumen `serah_terima`, transaksi
    `keluar` (referensi `ST-0001`), dan mengurangi penyisihan (baris yang habis dihapus). Memakai advisory lock yang sama
    dengan `sisihkan_dan_usulkan`. Serah terima tanpa barang ditolak.
  - `diserahkan_bom(p_bom_id)`: jumlah yang sudah diserahkan per kode barang untuk BOM ini dan semua revisi sebelumnya.
    `sisihkan_dan_usulkan` kini menghitung kebutuhan = kebutuhan BOM dikurangi yang sudah diserahkan, jadi revisi BOM
    sesudah sebagian barang diserahkan tidak menyisihkan atau membeli barang itu lagi.
  - Trigger `cek_usulan_draf` kini membolehkan satu perubahan pada usulan `disetujui`: kolom `qty_diterima` (oleh
    `terima_barang`); kolom lain tetap terkunci.
  - Migrasi `20261101000200`: `disetujui_revisi_lama` kini hanya menghitung pembelian yang **belum datang**
    (`qty_beli - qty_diterima`); yang sudah datang sudah tercatat sebagai stok dan penyisihan.
  - Ketiga fungsi baru hanya bisa dipanggil `service_role`.
- `status_material(p_project_id)` (migrasi `20261101000300`, hanya baca, hanya `service_role`): per BOM final project dan
  kode barang: butuh, diserahkan, disisihkan, dipesan (disetujui, belum datang, termasuk revisi sebelumnya) + ETA
  terdekat, diusulkan (draf/diajukan), dan kurang. Uji: `tests/status_material.sql` (6 skenario, lulus 1 Nov 2026).
- **Uji otomatis**: `tests/usulan_pembelian.sql` (10 skenario termasuk revisi dan pengembalian) dan
  `tests/penerimaan_serah_terima.sql` (8 skenario: terima sebelum disetujui, terima berlebih, kunci baris, serah terima
  barang yang tidak disisihkan / berlebih / tanpa stok, serah terima kosong, serah bertahap, penyisihan habis, revisi BOM
  sesudah sebagian diserahkan). Diuji 1 Nov 2026 di database asli: keduanya lulus. Blok `do` yang selalu diakhiri galat:
  "LULUS: ..." berarti semua lulus, galat lain menyebut skenario yang gagal. Tidak ada data yang tersisa, tetapi nomor
  urut BOM/usulan yang terpakai tidak kembali.

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

## Penataan katalog menurut jenis (migrasi `20261031000400`, 31 Okt 2026)

Permintaan PM: untuk stok yang penting barangnya apa dan jenisnya apa; fungsinya ditentukan nanti di BOM. Dulu tangki
dan pompa dinamai menurut fungsinya, sehingga satu barang fisik (mis. tangki PE 1000 L) tercatat dengan banyak kode
("CIP Tank", "Chemical Tank", "RO CIP Tank", "UF Permeate Tank", ...). Migrasi ini:

1. menyalin tabel `barang` ke `barang_cadangan_20261031`;
2. menambah `jenis_barang` dan `barang.jenis`, lalu mengisi jenis dari nama, spesifikasi, material, dan model;
3. memindah barang yang salah kategori (mis. overload/CB di Pompa → Kelistrikan, conductivity meter di Kelistrikan →
   Instrumen, "FRP Tank" di Filter → Tangki); **kode barang tidak diubah**;
4. menamai tangki dan pompa menurut bentuk fisiknya ("Tangki PE", "Pompa vertikal multistage"), memindah kapasitas
   tangki dari spesifikasi ke ukuran, mengisi material/merek yang kosong; nama lama disimpan di `nama_lain`;
5. menandai tangki/pompa yang identik (jenis, ukuran, material, merek, model sama) **Gabung** ke kode yang paling sering
   dipakai (bisa dibatalkan per barang di halaman Katalog Barang);
6. memberi penanda `jenis perlu dicek` (jenis cadangan seperti "Valve lain") dan `kapasitas belum diisi` (tangki).

Pratinjau sebelum dijalankan: 58 barang pindah kategori, 230 tangki/pompa ganti nama, 47 barang digabung ke 14 kode
(mis. Tangki PE 1000 L: 12 kode menjadi 1). Mengembalikan seluruhnya: salin kolom dari `barang_cadangan_20261031` ke
`barang` per `kode`, lalu kosongkan `jenis`.
