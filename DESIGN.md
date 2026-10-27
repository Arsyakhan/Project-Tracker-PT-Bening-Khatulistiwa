# DESIGN.md — Bening Hub

Arah desain Bening Hub, Super App PT Bening Khatulistiwa. Ditetapkan 27 Okt 2026. Semua halaman mengikuti dokumen
ini; nilai-nilainya sudah ada di kode (`styles/globals.css` untuk variabel CSS, `tailwind.config.js` untuk nama kelas),
jadi halaman memakai nama token, bukan nilai mentah.

Catatan sumber: arah ini disusun dari identitas yang sudah ada (logo tetes air, biru logo, foto WTP) dan dari pekerjaan
perusahaan (water treatment, gambar P&ID), bukan dari perbandingan dengan situs lain.

## Prinsip: jernih, presisi, mengalir

1. **Jernih.** Latar putih kebiruan, garis rambut, satu biru merek. Warna lain hanya untuk arti: selesai (teal),
   perlu perhatian (amber), terlambat (rust). Tidak ada gradien hiasan; satu-satunya gradien adalah lapisan gelap di
   atas foto WTP pada halaman masuk, supaya logo dan kartu masuk terbaca.
2. **Presisi.** Bahasa gambar teknik: garis P&ID, angka rata (`tnum`), huruf mono hanya untuk kode (nomor PO, persen
   di tabel). Data dikelompokkan dalam satu panel bergaris pemisah, bukan dipotong menjadi banyak kartu yang sama.
3. **Mengalir.** Gerak hanya lewat air. Logo tampil dengan satu motion graphic (tetes jatuh, memercik, terisi, huruf
   muncul dari garis air). Tetes di logo surut dan bergelombang selama halaman dimuat, lalu penuh lagi.
   Halaman masuk punya satu momen: tetes logo jatuh dan riaknya menyebar ke foto instalasi WTP yang dilihat dari balik
   permukaan air bening; sesudahnya air hanya beriak pelan dan menjawab kursor atau sentuhan.
   Tidak ada yang memantul, berkedip, atau muncul bergiliran di setiap bagian.

Hal yang sengaja dihindari: label huruf kapital semua, gradien ungu-biru, efek kaca, ikon emoji, kartu identik
berbayang sama di mana-mana, tanda panah di belakang setiap tautan, diagram ikon-dan-garis yang "menjelaskan" produk
(diagram pipa ke enam modul pernah dicoba di halaman masuk dan ditolak), dan kalimat yang terdengar seperti buatan mesin.

## Warna

| Token | Terang | Gelap | Peran |
|---|---|---|---|
| `canvas` | `#F3F6F9` | `#071521` | latar aplikasi |
| `panel` | `#FFFFFF` | `#0C1E2D` | kartu, panel, sidebar |
| `line` | `#DCE4EB` | `#1C3346` | garis rambut dan border |
| `ink` | `#0B2741` | `#E4EDF5` | teks utama |
| `inkmute` | `#4F657A` | `#93A8BA` | teks kedua, label |
| `blueprint` | `#0B4F94` | `#5CAAF2` | aksi utama, tautan, fokus |
| `blueprintdark` | `#063E75` | `#84C0F6` | hover aksi utama |
| `brand` | `#063E75` | `#D6E6F5` | biru logo: wordmark, tetes |
| `deep` | `#063E75` | `#052442` | permukaan merek (panel login), teks di atasnya selalu putih |
| `air` | `#20A4D8` | `#3CC3EE` | air: isian logo bergerak, riak intro logo, loading bar (bukan teks) |
| `teal` | `#007066` | `#2BC7B0` | selesai, berhasil |
| `amber` / `amberink` | `#D98A00` / `#8B5900` | `#EBA844` | perlu perhatian (isian / teks) |
| `rust` | `#BC2727` | `#EC6F6F` | terlambat, bahaya |

Semua pasangan teks lolos WCAG AA (>= 4,5:1) di `canvas` dan `panel`, di kedua tema (dicek 27 Okt 2026).

## Tipografi

- **Plus Jakarta Sans** (Tokotype, dibuat untuk kota Jakarta) untuk semua teks dan judul: identitas lokal, rapi di
  ukuran kecil. Berat 400/500/600/700/800. Judul dibedakan dengan ukuran, berat 600, dan spasi huruf -0,015em.
- **IBM Plex Mono** hanya untuk kode dan angka teknis (nomor PO, persentase di tabel).
- Skala: 12 (keterangan) · 13 · 14 (teks UI) · 16 · 20 · 24 (judul halaman, semibold) · 30 · 44.
- Tidak ada label huruf kapital semua; label kecil memakai huruf kalimat, `text-xs font-semibold text-inkmute`.

## Ruang, bentuk, bayangan

- Spasi berbasis 4 px (skala Tailwind). Konten maksimal `max-w-6xl`, sidebar 256 px.
- Radius: kontrol 8 px (`rounded-lg`), panel 12 px (`rounded-xl`), pil `rounded-full`.
- Bayangan bernada navy: `shadow-sm` (`--shadow-soft`) untuk panel, `shadow-md` (`--shadow-lift`) untuk hover dan menu.

## Gerak

Token: `--ease-standard` `cubic-bezier(0.2,0,0,1)`, `--ease-enter`, `--ease-exit`, `--dur-fast` 120 ms,
`--dur-normal` 200 ms, `--dur-slow` 320 ms. Umpan balik tekan tombol: turun 1 px. `prefers-reduced-motion` dihormati
(semua gerak berhenti; latar halaman masuk menjadi foto statis dengan duotone yang sama).

## Tata letak halaman

Semua halaman kerja memakai susunan yang sama, dari atas ke bawah (komponen di `components/ui/`):

1. `PageHeader`: jejak navigasi (halaman detail), judul, satu baris keterangan, tombol aksi di kanan (di HP turun ke
   bawah judul), dan navigasi bagian bila ada (tab Dokumen: Checklist engineering | Buat dokumen; tampilan Project:
   Daftar | Kanban). Satu menu = satu judul halaman; tab hanya mengganti isi di bawahnya.
2. `StatStrip`: angka kunci dalam satu panel bergaris pemisah, seperti layar panel kontrol. Titik berwarna hanya bila
   angkanya berarti (terlambat, segera, selesai). Angka yang bisa diklik menyaring daftar di bawahnya.
3. Baris alat: `SearchField` + filter dalam satu panel. Pilihan pendek memakai `Segmented`.
4. Isi: `Panel` (judul, keterangan, aksi; `flush` untuk daftar bergaris pemisah). Daftar = satu panel dengan baris,
   bukan kartu terpisah per item. Kosong = `EmptyState` (apa yang terjadi + tindakan berikutnya).

Pola per halaman:

- Dashboard: `StageFlowChart` (jumlah project di 12 tahap, digambar sebagai satu jalur proses per fase; klik tahap
  membuka daftar Project dengan filter tahap itu), tenggat kirim terdekat, kelengkapan dokumen engineering, lalu daftar.
- Detail project: satu "title block" (identitas, alur teknologi, jalur tahapan, enam angka kunci), lalu hal yang perlu
  diperhatikan (hambatan, catatan), langkah berikutnya, tab bersegmen yang menempel di atas, dan kolom samping yang
  ikut menempel di layar lebar.
- Kanban: garis tepi kiri kartu = prioritas (merah High, kuning Medium, abu Low).
- Checklist engineering: matriks satu baris per project x tujuh dokumen. `Completed` cukup tanda centang teal (paling
  banyak, jadi dibuat tenang); status lain ditulis supaya yang tertinggal menonjol. Di HP: deretan label kecil per project.
- Pengadaan: titik alur per barang (Perlu dibeli, Sudah order, Dalam pengiriman, Diterima).
- Arsip: filter di kolom kiri yang menempel; detail arsip memakai susunan daftar modul dan panel spesifikasi.

## Komponen merek

- `components/brand/BeningMark.jsx`: tetes air SVG (geometri sama dengan logo), terisi air bergelombang.
  Properti `busy` (sedang memuat), `fillOnMount` (terisi saat tampil). Saat diam animasinya berhenti.
- `components/brand/BeningLogo.jsx`: tetes + wordmark BENING HUB vektor per huruf (`components/brand/wordmarkPaths.js`,
  hasil vectorize Adobe Illustrator dari logo asli) + baris kecil opsional ("Super App"). Prop `intro` = motion graphic
  sekitar 1,4 detik: tetes jatuh dan memercik (dua riak), terisi air, huruf muncul satu per satu dari bawah garis air,
  lalu "Super App". Prop `ambient` = air tetap bergelombang pelan sesudahnya (halaman masuk saja).
- `components/brand/WaterSurface.jsx`: latar halaman masuk. Foto WTP dilihat dari balik permukaan air (WebGL 1,
  satu fragment shader): refraksi, duotone navy `#03182E` ke biru air `#9CD6F0`, kilau tipis. Riak datang dari kursor
  (kecil), klik/sentuh (sedang), tetes kecil tiap 6,5 detik, dan `ref.drop(x, y, kekuatan)` (tetes logo yang mendarat).
  Fallback tanpa WebGL atau dengan gerak dikurangi: foto statis dengan duotone CSS yang sama.
- `lib/useRouteBusy.js`: `true` selama pindah halaman; dipakai logo di sidebar dan header HP.

## Bahasa

Nada: bahasa kerja yang lugas dan sopan, seperti dokumen proyek resmi. Kalimat pendek, langsung ke inti.

- Sapaan **Anda**, bukan "kamu". Syarat memakai **jika**, bukan "kalau". Kata sambung **tetapi**, bukan "tapi".
- Tanpa kiasan dan bahasa santai: bukan "bola ada di siapa", "aman", "menggantung", "tindak dulu", "tinggal tempel".
- Tanpa tanda seru dan tanpa basa-basi. Pesan galat: apa yang gagal, lalu apa yang harus dilakukan.
- Tombol: kata kerja + objek, huruf kalimat ("Simpan perubahan", "Jadwalkan rapat", "Hapus permanen").
- Istilah industri tetap: Project, PO, BOM, P&ID, EWD, GAD, FAT, ETA, PIC, Commissioning, Hand Over.
- Satuan hitungan hal yang perlu ditindak: **item** ("2 item terlambat").

| Hindari | Pakai |
|---|---|
| Bola ada di siapa | Beban kerja per divisi |
| Project berjalan | Project aktif |
| Sudah lewat tenggat, tindak dulu | Melewati tenggat |
| Belum mendesak, tapi masih menggantung | Data atau dokumen belum lengkap |
| Tidak ada yang terlambat atau mendesak. Aman. | Tidak ada item yang terlambat atau mendekati tenggat. |
| Ada 2 hal terlambat | 2 item terlambat |
| Mulai lacak project pertama kamu di sini. | Tambahkan project pertama untuk mulai memantau progresnya. |
| Tinggal tempel di WhatsApp | Disalin dan siap ditempel di WhatsApp |
| di-generate | dibuat |
