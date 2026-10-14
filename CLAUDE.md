# CLAUDE.md — Bening Hub (PT Bening Khatulistiwa)

Panduan untuk Claude di repo ini. Pemilik repo bekerja dalam **Bahasa Indonesia**: selalu balas dan
tulis teks UI, komentar, serta dokumentasi dalam Bahasa Indonesia.

## Siapa pemakainya

Pemilik repo adalah **Project Manager** PT Bening Khatulistiwa. Bening Hub dibuat untuk memudahkan
pekerjaannya dan semua divisi di bawahnya: Marketing & Direksi, Engineering, Warehouse & Purchasing,
dan Technician. Jadi setiap fitur dinilai dari satu pertanyaan: apakah PM dan tiap divisi bisa
melihat posisi project di alur (inquiry → PO → engineering → pengadaan → fabrikasi → delivery →
instalasi → commissioning → Hand Over) dan tahu apa yang harus dikerjakan berikutnya. Utamakan
kejelasan status, tenggat, dan siapa yang bertanggung jawab (PIC) daripada tampilan yang rumit.

## Gambaran besar

Bening Hub = pelacak project & dokumen engineering (water treatment: RO, UF, softener, dst.).

```
Browser ──► Next.js (Vercel) ──► /api/gas        ──► Apps Script "Code.gs" ──► Google Sheet
                              ├─► /api/docgen     ──► Apps Script docgen (Commissioning / Hand Over) ──► Google Docs
                              └─► /api/meeting-doc ─► Apps Script generator Notulensi ──► Google Docs
```

- **Frontend:** Next.js 14 (pages router), Tailwind 3 (`darkMode: 'class'`), NextAuth (login Google,
  dibatasi `ALLOWED_EMAILS`), next-pwa. Tidak ada database lain: **Google Sheet adalah database**.
- **Backend:** Google Apps Script yang terikat ke spreadsheet. Kode salinannya ada di `apps-script/`.
- Browser tidak pernah melihat URL/token Apps Script; semua lewat route `/api/*` yang mengecek sesi.

## Backend (Apps Script) — penting

**Claude tidak punya akses ke editor Apps Script.** Yang ada di repo hanyalah salinan. Artinya:

1. Perubahan di `apps-script/*.gs` **tidak otomatis live**. Pemilik harus menempel ke editor lalu
   **Deploy > Manage deployments > ikon pensil > Version: New version > Deploy** (URL tetap sama).
   Selalu tulis langkah ini di akhir PR yang menyentuh `.gs`.
2. Kalau pemilik mengubah kode langsung di editor, repo bisa ketinggalan. Saat ragu, minta dia
   menempelkan isi file live sebelum mengedit.
3. Jangan mengubah `.gs` kecuali diminta. Setelah mengubahnya, jaga sinkron dengan frontend (lihat
   "Kontrak yang harus sinkron").

### Project Apps Script utama (satu project, banyak file)

Terikat ke spreadsheet `Project Tracker_PT Bening Khatulistiwa`
(ID `1PAyBmvBydNF3cYH54iu2gcSC0vPBTjTmHMy_GNm65K4`). Satu project, file-file ini berbagi fungsi
helper dari `Code.gs`:

| File | Isi |
|---|---|
| `apps-script/Code.gs` (v2.8) | `doGet`/`doPost`, token, cache 30 dtk, proyek (+ kolom `Tahun`), checklist, komentar, activity log, document log, specs, meetings, dan rute teknologi project aktif (`tech`, `saveProjectTech`; isinya di Archive.gs). Tanggal ditulis jam 00:00 menurut zona waktu **spreadsheet** (`sheetTimeZone_`, `dayString_`); sel berisi rumus tidak ditimpa (`isFormulaCell_`) |
| `apps-script/Archive.gs` | tab `[ARSIP] FINISHED PROJECT` dibaca & ditulis dua arah (`getArchive_`, `saveArchiveProject_`, `deleteArchiveProject_`); dibaca **per posisi kolom**: header 2 baris, kolom A-C = No/Tahun/Nama, lalu 40 grup modul (33 × Ada/Kapasitas/Satuan/Detail + 7 pompa dosing hanya Ada; 139 kolom, D-EL). Konflik edit dideteksi lewat `rev` per baris (sidik jari isi baris), karena sheet tidak punya kolom Version. Baris baru ditaruh tepat di bawah project terakhir (`archiveNextRow_`, bukan `getLastRow()`). Baris lama tidak diubah kecuali diedit. **Sejak v2.8** file ini juga membaca dan menulis **grid teknologi project aktif** di tab `Project Tracker` kolom AA-FI (sejak 13 Okt 2026; dulu AA-CT) dengan pembaca modul yang sama (`getProjectTech_`, `saveProjectTech_`, `trackerGridFromHeaders_`): lokasi grid dicari lewat judul (dari kolom `Ada` pertama sampai kolom `Project ID`), konflik lewat `rev` baris, hanya sel yang berubah yang ditulis, sel berumus dan modul yang belum dikenal web dibiarkan, dan perubahan dicatat di Activity Log sebagai `Update Teknologi` |
| `apps-script/Procurement.gs` | tab Procurement (`getProcurement_`, `saveProcurementItem_`, `deleteProcurementItem_`); `doGet`/`doPost` di Code.gs yang memanggilnya |
| `apps-script/WeeklyDigest.gs` | email ringkasan mingguan, trigger Senin ~07.00 |
| `apps-script/Backup.gs` | salinan spreadsheet mingguan, trigger Senin ~02.00, simpan 8 terakhir |
| `apps-script/Seed-Meetings.gs` | impor sekali jalan 2 rapat awal; **jangan dijalankan ulang tanpa perlu** |

**Script Properties** (Project Settings): `API_TOKEN` (dibuat `setup()`, = `GAS_API_TOKEN` di Vercel),
`ADMIN_NOTIFICATION_EMAILS`, `DIGEST_EMAILS`, `APP_URL`, `BACKUP_FOLDER_ID` (otomatis), `LAST_BACKUP_AT` (otomatis).

**Nama file di editor.** Antarmuka bahasa Indonesia menamai `Code.gs` menjadi `Kode.gs`, dan di editor pemilik
`Archive.gs` bernama `Archive.gs.gs` (editor otomatis menambah `.gs`). Itu tidak berpengaruh: semua file berbagi satu
lingkup global, dan urutan file juga tidak berpengaruh (diuji 12 Okt 2026: keenam file dimuat dengan tiga urutan
berbeda dan semuanya lolos; tidak ada kode tingkat-atas yang saling merujuk antarfile).

**Aksi API** (lewat `/api/gas`, allowlist di `pages/api/gas.js`):

- GET: `projects`, `dashboard`, `meta`, `activityLog`, `comments`, `documents`, `specs`, `meetings`, `procurement`, `archive`, `tech`
- POST: `addProject`, `updateProject`, `updateChecklist`, `deleteProject`, `addComment`, `logDocument`,
  `saveSpecs`, `saveMeeting`, `deleteMeeting`, `setMeetingDoc`, `saveProcurementItem`, `deleteProcurementItem`, `saveArchiveProject`, `deleteArchiveProject`, `saveProjectTech`
- `deleteProject` dan `deleteArchiveProject` hanya boleh admin; `deleteMeeting` dan `deleteProcurementItem` boleh editor (dicek di `/api/gas`).
- Penyimpanan data berversi (`Version` + `baseVersion`) untuk Specs, Meetings, Procurement agar edit
  bersamaan tidak saling menimpa. Respons selalu `{ ok, data }` atau `{ ok:false, error }`.

### Tab Google Sheet

> **Status penerapan (12 Okt 2026):** struktur baru di bawah ini **sudah diterapkan ke sheet asli** (setelah diuji
> penuh di salinan "UJI COBA"). Yang berubah di sheet asli: tab `Project Tracker` diganti yang baru (dua baris judul,
> kolom Tahun, grid teknologi format arsip; tab lamanya diganti nama `Project Tracker (lama)`), Checklist menjadi
> berumus, tab arsip dan semua tab pendukung diseragamkan formatnya, urutan tab dirapikan. Salinan sebelum perubahan:
> file Drive "BACKUP 12 Okt 2026 (sebelum dirapikan) - Project Tracker_PT Bening Khatulistiwa" (jangan dihapus).
> Uji tiruan Apps Script dijalankan ulang terhadap ekspor sheet asli sesudah penukaran: v2.7 lolos, dan kode v2.6
> yang masih live juga tetap jalan di struktur baru.
>
> **Sudah selesai sesudahnya (dicek 12 Okt 2026):** pemilik menghapus tab `Project Tracker (lama)` dan `Dashboard`
> (sheet kini 11 tab, tanpa sel error di Project Tracker, Checklist, Arsip, dan Reference), lalu menempel dan
> men-deploy `Code.gs` v2.7 dan `Archive.gs`. Claude tidak bisa melihat editor Apps Script, jadi bukti deploy-nya tidak
> langsung: sesudah itu, edit stage lewat web tidak lagi menimpa rumus `Stage Progress` (v2.6 menimpanya), semua rumus
> tracker dan Checklist masih utuh, dan log Vercel tanpa error. Yang belum teruji di sheet asli: tambah project baru
> lewat web (kolom `Tahun` terisi) dan tambah arsip baru (nomor terbesar + 1); lihat TL-0018.
>
> **Fase 2, grid teknologi tersambung ke web (Code.gs v2.8, 12 Okt 2026):** tab Teknologi di detail project dan
> "Arsipkan teknologi" kini membaca dan menulis grid AA-CT (lihat di bawah), bukan lagi tab `Project Specs`. Tidak perlu
> memindahkan data: isi grid asli sudah memuat semua yang pernah disimpan web. Kodenya baru berlaku di sheet setelah
> pemilik menempel dan men-deploy `Code.gs` dan `Archive.gs` v2.8; sebelum itu web otomatis memakai mode lama (kunci
> `tech_*` di `Project Specs`), jadi urutan deploy Vercel dan Apps Script tidak masalah. Jalur tulis v2.8 baru diuji di
> tiruan Node (data sheet asli), belum di sheet asli; lihat TL-0013 dan TL-0018.
>
> **Modul teknologi dilengkapi, 21 menjadi 40 (13 Okt 2026):** grid teknologi di tab `Project Tracker` dan tab
> `[ARSIP] FINISHED PROJECT` **sudah diubah di sheet asli** (setelah dilatih dua kali di salinan uji): urutan end-to-end
> air baku sampai distribusi, 17 modul baru ditambahkan, dan modul pembersihan milik pemilik (`CLEANING/FLUSHING PUMP`,
> `T-01 CLEANING/FLUSHING TANK`) menjadi modul resmi. Tata letak sekarang: tracker grid **AA-FI** (139 kolom) dan
> `Project ID` di **FJ**; arsip modul **D-EL**. Di arsip, kolom flushing pump dipindah ke depan RO (sebelum RO) dan
> kolom flushing tank baru ditambah; semua 63 baris arsip dan seluruh isi tracker bergeser mengikuti judulnya tanpa
> data hilang (dibandingkan dengan cadangan), rumus Checklist dan `Stage Progress` utuh, aturan warna per modul dipasang
> ulang (80 aturan per tab). Salinan sebelum perubahan: dua file Drive "BACKUP ... - Project Tracker_PT Bening
> Khatulistiwa" (jangan dihapus). Kode baru (`Archive.gs` dengan 40 kunci modul) baru berlaku setelah pemilik menempel
> dan men-deploy ulang; sebelum itu Archive.gs lama masih membaca modul yang dikenalnya lewat judul, dan modul baru
> terbaca sebagai `x_<slug>` (hanya terbaca, tidak ditulis). Sisi web hanya menampilkan modul yang kolomnya ada di
> sheet (`schema` dari GET `tech`), jadi urutan deploy tidak berbahaya.
>
> **Masih tersisa:**
>
> 1. Keputusan dan tindakan pemilik (izin berbagi sheet, zona waktu, data janggal, rahasia generator Notulensi) ada di
>    tab `Tindak Lanjut` di Drive `_Claude`.

Tab yang dipakai API: `Project Tracker`, `Engineering Deliverables Checklist`, `Activity Log`, `Comments`,
`Document Log`, `Project Specs`, `Meetings`, `Procurement` (tab-tab ini dibuat otomatis) dan
`[ARSIP] FINISHED PROJECT` (dibaca & ditulis `Archive.gs`). Tab manual pemilik: `Reference` (bobot stage + daftar
pilihan, dibaca rumus sheet, bukan API) dan `[ARSIP] Data HO and Commisioning- Dokumen Fisik` (catatan manual, tidak
dibaca web). Tab `Dashboard` lama (ringkasan buatan tangan, kembar dengan halaman Dashboard di web) dan
`Project Tracker (lama)` sudah dihapus pemilik (12 Okt 2026).

**`Project Tracker` (struktur baru):**

- **Dua baris judul**: baris 1 = nama kolom (kunci ke Code.gs, dicari lewat NAMA) dan judul modul teknologi (digabung
  mendatar); baris 2 = sub-judul `Ada / Kapasitas / Satuan / Detail Spesifikasi` yang sekaligus baris filter. Data
  mulai **baris 3**. `readSheet_` melewati baris 2 karena tidak punya PO Number, Project Name, maupun Project ID.
- **Kolom A-Z**: No, **Tahun**, Project Name, PO Number, Client, Technology/Capacity (di web bernama **Bentuk Project**, mis. Skid/Plant/Retrofit; nama kolom di sheet jangan diganti karena Code.gs mencarinya lewat nama), Current Stage, Status,
  Stage Progress (%), Engineering Doc Progress (%), Priority, PIC, Tanggal PO, Tanggal DP, Delivery Date, Target
  Finish Date, Next Action, Next Action Owner, Next Action Due, Blocker, Blocked Since, Remarks, Lokasi Plant,
  Alamat, Kontak Owner, Sistem Terpasang (**tidak lagi diisi dari web**, lihat bagian Teknologi: hanya menyimpan opsi dokumen). `Blocker` terisi = project terhambat; `Blocked Since` diisi/dikosongkan
  otomatis oleh `updateProject_`.
- **Grid teknologi AA-FI** (139 kolom, **40 modul**, urutan end-to-end dari air baku → produk → distribusi, **sama
  persis dengan tab arsip**): 33 modul punya `Ada` (kotak centang), `Kapasitas`, `Satuan` (MPH/LPH/LITER/MPD/LPD),
  `Detail Spesifikasi`; tujuh pompa dosing (NaOCl, PAC, Soda Ash, Polimer, SMBS, Antiscalant, Asam/NaOH pH) hanya
  `Ada`. Kolom **FJ = `Project ID`** (`prj_xxxx`, jangan diedit manual). Urutan modul: Strainer, Feed Pump, Raw Tank,
  Aerator, dosing NaOCl/PAC/Soda Ash/Polimer, Flokulator, Clarifier, Filter Pump, MMF, Birm, Greensand, Chlorination,
  ACF, Softener, Soft Water Tank, UF Feed Pump, UF, dosing SMBS/Antiscalant/pH, Cartridge, Booster, Cleaning/Flushing
  Pump, RO, ERD, RO Pass 2, Cleaning/Flushing Tank, Degasifier, Ion Exchange, EDI, Mixed Bed, Remineralisasi, Product
  Tank, UV, Ozon, Filter 0,2 µm, Pompa Distribusi (kunci resminya di `ARCHIVE_MODULE_KEYS`). **Sejak Code.gs v2.8 grid
  ini adalah satu-satunya sumber teknologi project aktif**: bisa diisi dari tab Teknologi di web (GET `tech`, POST
  `saveProjectTech`) maupun langsung di sheet, dan keduanya saling melihat. Lokasi grid dicari lewat judul (dari kolom
  `Ada` pertama sampai kolom `Project ID`), jadi menambah modul di tengah tidak merusak apa pun asalkan judulnya dikenal
  (`ARCHIVE_MODULE_KEYS`); judul yang tidak dikenal terbaca sebagai `x_<slug>` (hanya dibaca, tidak ditulis). Kunci
  `tech_*` di tab `Project Specs` tidak lagi ditulis; hanya dibaca sebagai cadangan kalau grid project masih kosong
  atau backend belum v2.8.
- **Rumus**: `Stage Progress (%)` = VLOOKUP stage ke `Reference`; `Engineering Doc Progress (%)` = `Progress (%)` dari
  tab Checklist lewat Project ID. Code.gs tidak menimpa sel berisi rumus; project yang ditambah lewat web tetap
  berisi nilai biasa.
- **`Tahun`** = tahun Tanggal PO (otomatis saat project ditambah atau Tanggal PO diganti, selama isinya masih tahun PO
  yang lama; isian manual yang berbeda dibiarkan). Di tab arsip, `Tahun` berarti tahun project **selesai**. Web
  membacanya sebagai `tahun` (filter "Tahun" di Semua Project, `yearOf` di `lib/projectHelpers.js`).
- Sudah **dihapus**: Deskripsi Pesanan dan Spesifikasi Teknologi (teks bebas, diganti grid), Days Remaining (web
  menghitungnya sendiri saat membaca), Helper Active Index.

**`Engineering Deliverables Checklist`**: A-C (PO Number, Project Name, Client) = rumus dari Project Tracker lewat
Project ID di kolom T; D `Overall Status` dan L `Progress (%)` = rumus dari 7 status dokumen (bobot sama dengan
`CHECKLIST_WEIGHTS`: Not Started 0, Drafting 30, Under Review 70, Completed 100; N/A tidak dihitung); E-K = status 7
dokumen; M-S = tautan dokumen; T = Project ID.

Tab lain (`Activity Log`, `Comments`, `Document Log`, `Meetings`, `Procurement`, `Project Specs`, `Reference`, Dokumen
Fisik) hanya dirapikan tampilannya (judul navy, baris judul dibekukan); isi dan urutan kolomnya tidak berubah. Jangan
ubah format angka `Meetings!B:D` dan `Procurement!H:J` (disimpan sebagai teks).

**Pelajaran saat mengubah sheet lewat API** (semuanya pernah jadi bug nyata):

- Locale sheet `id_ID`: rumus dan aturan warna memakai pemisah `;` dan desimal koma; hindari angka desimal di aturan
  warna (tulis `90%`). Mengganti nama tab otomatis memperbarui rumus yang merujuknya, tetapi Apps Script memakai NAMA
  tab: `Project Tracker` dan `Engineering Deliverables Checklist` jangan diganti nama.
- Validasi kotak centang membuat sel kosong terisi `FALSE`, sehingga `getLastRow()` / `appendRow()` menaruh baris baru
  jauh di bawah. Setelah memasang validasi, kosongkan nilai di baris yang belum terpakai (validasinya tetap ada).
- Nomor urut kolom A tab arsip kini angka statis (dulu rumus `ROW()-2` sampai baris 70, yang membuat `getLastRow()`
  keliru). `saveArchiveProject_` menulis nomor terbesar + 1 untuk baris baru. Kapasitas yang dulu tersimpan sebagai
  tanggal (tampil "3.5") sudah diperbaiki menjadi angka desimal.
- `batchUpdate` bersifat atomik: satu permintaan tidak valid (mis. menghapus aturan warna dengan indeks yang tidak ada)
  menggagalkan seluruh paket. Hitung dulu jumlah aturan warna di sheet asli sebelum menghapusnya.
- Menimpa `userEnteredFormat.textFormat` utuh menghapus hiperlink sel (kolom tautan Checklist, Doc URL Meetings,
  Document URL Document Log). Pakai mask sub-bidang (`textFormat.fontFamily`, `.fontSize`, dst.) agar tautan selamat.
- Filter dasar tidak boleh memuat sel gabungan: judul modul digabung mendatar di baris 1 saja, baris 2 yang jadi baris filter.
- Zona waktu: spreadsheet di `America/Los_Angeles`, script Apps Script di WIB. Dulu tanggal yang ditulis web tampil
  mundur sehari di sheet (di web benar). v2.7 menulis tanggal jam 00:00 menurut zona spreadsheet dan tetap membaca
  nilai lama yang berjam-jam dengan benar (`dayString_`). Menyamakan zona spreadsheet ke `Asia/Jakarta` dianjurkan,
  tetapi putusan pemilik (mengubah tampilan jam di tab Activity Log).
- **Menambah/memindah modul di grid (13 Okt 2026, semuanya pernah jadi masalah nyata saat latihan di salinan):**
  `copyPaste` dengan `PASTE_FORMAT` ikut menyalin nilai (kosongkan lagi nilainya) dan menggabung aturan warna sumber;
  `insertDimension` dengan `inheritFromBefore` memperluas aturan warna ke kolom sisipan, jadi setelah struktur jadi
  **hapus semua aturan warna di zona grid lalu pasang ulang 80 aturan eksplisit** (hijau `=$L3=TRUE` pada kolom `Ada`,
  abu `=AND($C3<>"";$L3<>TRUE)` pada seluruh blok; baris 3-300 tracker / 3-500 arsip; pemisah `;` karena locale
  `id_ID`). Menyisip di tepi kanan arsip tidak melebarkan filter dasar: lebarkan manual. Hasil `get_spreadsheet` besar
  tersimpan otomatis ke berkas; yang sedang-sedang tampil langsung dan menghabiskan konteks, jadi pilih bidang yang
  jelas besar atau persempit rentangnya. Selalu buat cadangan segar sesaat sebelum mengubah struktur.
- Ekspor xlsx dari Drive membuang rumus berisi rentang terbuka (`$L$2:$L`): jangan dipakai untuk memeriksa rumus; baca
  lewat Sheets API (`userEnteredValue`).

### Generator dokumen (Apps Script terpisah, masing-masing Web App sendiri)

| Script | Template Google Docs | Folder output | Env var |
|---|---|---|---|
| `apps-script/docgen/commissioning.gs` | `17YubntTUx2Blrm-z9SljsqLAGdkxl6Z8-yBYP4KkbSg` | `1tidqVbWwC7LPUoctyDcMb5K_Zo1PH2kM` | `DOCGEN_COMMISSIONING_URL` |
| `apps-script/docgen/handover.gs` | `1EkVlnf3xQZT4vvXc8SF_W9hWz8QXfwWqgYETn4rcwf0` | `1jdQ0D_SJ7FvOLzhUGdNh0U3DzrA1DSrv` | `DOCGEN_HANDOVER_URL` |
| `apps-script/docgen/meeting.gs` (Notulensi) | tidak pakai template: dokumen dibuat dari kode (lanskap, 4 bagian) | `1IaQoI3Swl9LNvLu7PJoZW46DY2KSztDT` | `DOCGEN_MEETING_URL` + `DOCGEN_MEETING_SECRET` |

Cara kerja: `makeCopy` template, lalu `replaceText` untuk `{{PLACEHOLDER}}`. Blok
`{{BEGIN_SECTION_X}} … {{END_SECTION_X}}` dihapus kalau flag `has_*` salah. Isi kosong jadi `.......`
(HO) atau `........` (Commissioning). Baris `{{*_ADDITIONAL_ITEMS}}` yang kosong dihapus seluruh barisnya.

**Hand Over punya dua cara menyusun daftar "Items Handed Over" (sejak 13 Okt 2026, KEP-0010).**
`handover.gs` memeriksa payload: kalau memuat `equipment` (array butir `{ key, title, head, rows }`, dikirim form Hand Over
terbaru) daftar dibangun **dinamis** (`generateDynamic_`): seluruh blok seksi template (dari `{{BEGIN_SECTION_RAW_WATER}}`
sampai `{{END_SECTION_PANEL}}`) dibuang dan diganti satu butir bernomor + baris bullet untuk tiap modul yang dicentang di
Teknologi, gaya nomor/bullet disalin dari baris contoh di template itu sendiri (`{{CLARIFIER_CAP}}` = judul bernomor,
`{{RW_TANK_MAT}}` = bullet; **jangan menghapus kedua baris itu dari template**). Kalau cara dinamis gagal (contoh tidak
ketemu, penanda hilang, galat Docs), salinan setengah jadi dibuang (`setTrashed`) dan dokumen dibuat ulang dengan **cara
lama** (`generateLegacy_`, isi tidak berubah dari versi sebelumnya); jawabannya memuat `generator: 'dynamic' | 'legacy'`
(+ `itemCount`, `fallbackReason`) yang diteruskan `pages/api/docgen.js` ke form, yang menampilkan peringatan kalau
bukan `dynamic`. Payload tanpa `equipment` (form lama) tetap lewat cara lama. Teks butir disusun di frontend
(`lib/docgen/handoverItems.js`), script hanya menuliskannya, jadi aturan teks bisa diuji di Node. Perilaku Google Docs
sungguhan (nomor berlanjut, gaya bullet) tidak bisa diuji dari sandbox; yang teruji adalah tiruan DocumentApp di Node.

## Kontrak yang harus sinkron (sumber bug paling umum)

| Hal | Di sisi backend | Di sisi frontend |
|---|---|---|
| 12 stage & bobot progress | `STAGE_WEIGHTS` di `Code.gs` (+ tab `Reference`) | `lib/stages.js` (pengelompokan 4 fase ada di `lib/stagePhases.js`, hanya frontend) |
| Kunci sistem (opsi dokumen di kolom Sistem Terpasang) | `SYSTEM_KEYS` di `Code.gs` | `lib/systems.js` |
| Item checklist (7 dokumen) | `CHECKLIST_ITEMS` di `Code.gs` | `lib/docgen/schema.js` (`DOC_GENERATOR_ROUTE`), `pages/api/docgen.js` |
| Status pengadaan | `PROC_STATUSES` di `Procurement.gs` | `lib/procurement.js` |
| Status rapat/agenda/kehadiran | `MEETING_STATUSES`, `ITEM_STATUSES`, `ATTENDANCE_STATUSES` | `lib/meetings.js` |
| Field dokumen (`data.xxx`) | `docgen/*.gs` | `lib/docgen/schema.js` + `pages/documents/*/new.js` |
| Kolom Spesifikasi Peralatan modul tanpa seksi di template (id `x_*`, pembaca Detail, kerangka, teks Item Tambahan) | `*_additional_items` di `docgen/handover.gs` (hanya cara lama: baris dicetak sebagai Item Tambahan) | `lib/docgen/specExtra.js` (`DEFS`, `HOSTS`), `lib/docgen/specModules.js` (seksi tab Spesifikasi: 1 modul = 1 seksi; `OWN`, `SHARED_NOTES`, `SYSTEM_MODULES`), `lib/specParser.js` (`readExtra`), `lib/docgen/specs.js`, `pages/documents/handover/new.js` |
| Daftar peralatan dokumen Hand Over (`equipment`: 1 seksi Spesifikasi = 1 butir) | `generateDynamic_` di `docgen/handover.gs` (menuliskan `head` + `rows` apa adanya; baris contoh `{{CLARIFIER_CAP}}` dan `{{RW_TANK_MAT}}` di template) | `lib/docgen/handoverItems.js` (`DOC_TITLE`, `buildEquipmentItem(s)`: aturan teks bahasa Inggris), `lib/docgen/handoverPayload.js` (`buildHandoverPayload`, `buildDocItems`, `DOC_OPTIONS`; juga membangun bentuk lama `has_*` untuk script lama), `lib/docgen/techDetail.js` (baris Detail Teknologi yang tidak punya kolom), `components/docgen/EquipmentSections.jsx`, `pages/documents/handover/new.js`; `generator` diteruskan `pages/api/docgen.js` |
| Placeholder `{{...}}` | template Google Docs | `docgen/*.gs` |
| Kunci modul arsip & urutan alur teknologi (juga urutan grid AA-FI di Project Tracker) | `ARCHIVE_MODULE_KEYS` di `Archive.gs` + judul modul di baris 1 tab arsip/tracker | `lib/techflow.js` (`FLOW_PHASES`, `FLOW_STEPS`, `ADA_ONLY`) |
| Selisih Spesifikasi vs Teknologi dan tombol "+ Tambah peralatan" | tidak ada (frontend saja) | `specDiffs`, `fieldKey`, `sameValue` di `lib/docgen/specs.js`; `groupSchemaByPhase` di `lib/techflow.js`; `components/AddEquipment.jsx`, `components/SpecsEditor.jsx`; `addTechModule`, `resetSpecDiff` di `pages/projects/[id].js` |
| Teknologi project aktif (grid AA-FI di Project Tracker) | `getProjectTech_`, `saveProjectTech_`, `trackerGridFromHeaders_` di `Archive.gs`; rute `tech` dan `saveProjectTech` di `Code.gs` | `gridModules`, `sameTech`, `gridCurrentTech` di `lib/techflow.js` (GET `tech` membawa `schema` = modul yang ada di sheet, dipakai `pickerSchema` di halaman project); `projectSystems`, `deriveSystemKeys`, `MODULE_TO_SYSTEM` di `lib/systems.js`; `getProjects_` membawa `tech` ringkas per project; `getTech` dan `saveProjectTech` di `lib/api.js`; `pages/projects/[id].js` (tab Teknologi) dan `pages/arsip/new.js` |
| Nama kolom Project Tracker (header baris 1) | `COL_*`, `TEXT_FIELDS`, `DATE_FIELDS` di `Code.gs` | field hasil `getProjects_`; `EDITABLE_FIELDS` di `pages/projects/[id].js`; `COLUMNS` di `lib/exportCsv.js` |
| Bobot status dokumen checklist | `CHECKLIST_WEIGHTS` di `Code.gs` | rumus `Progress (%)` di tab Checklist (ada di sheet, bukan di repo) |
| Allowlist aksi | `doGet`/`doPost` | `pages/api/gas.js` (`GET_ACTIONS`, `POST_ACTIONS`) |
| Aturan otomatis Status / Prioritas / Stage di detail project (nilai tetap disimpan apa adanya di Sheet) | `STATUSES`, `PRIORITIES`, `STAGE_WEIGHTS`, `CHECKLIST_ITEMS` di `Code.gs` (tidak ada logika aturan di backend) | `lib/projectRules.js` (`FINAL_STAGE`, `DRAWING_ITEMS` = 4 nama item gambar persis seperti `CHECKLIST_ITEMS`, ambang hari dan teks `RULE_SUMMARY`), memakai `STAGES`/`STAGE_WEIGHTS` di `lib/stages.js`; dipakai `pages/projects/[id].js` dan `pages/board.js` |
| Pilihan PIC project (dropdown) | tidak ada (kolom `PIC` teks bebas di Sheet) | `lib/pics.js` (`picOptions`, `roleDivision`), `components/PicSelect.jsx`; dipakai `pages/projects/[id].js` dan `pages/projects/new.js` |
| Normalisasi nomor PO (PO kembar) | `normalizePO_` di `Code.gs` | `normalizePo` di `lib/projectHelpers.js` (hanya untuk peringatan di form Project Baru; yang menolak tetap backend) |

Status terakhir diperiksa (9 Okt 2026): `STAGE_WEIGHTS` dan `SYSTEM_KEYS` cocok; nama field HO
cocok 100% dengan `schema.js`; Commissioning cocok (`checklist_items` dibuat di sisi halaman).
Diperiksa lagi 12 Okt 2026: 21 modul teknologi cocok antara `Archive.gs`, `lib/techflow.js`, dan tab arsip/tracker
baru di salinan uji (termasuk `dosing_polimer`; `product_tank` kini punya kapasitas, satuan, dan detail).
Diperiksa lagi 13 Okt 2026: 40 modul cocok antara `Archive.gs`, `lib/techflow.js` (42 langkah alur termasuk Chemical
Dosing dan Intermediate Tank yang hanya opsi dokumen), dan judul kolom sheet asli. Modul yang tidak punya seksi di
template dokumen (strainer, aerator, flokulator, greensand, ERD, degasifier, ion exchange, EDI, remineralisasi, UV,
ozon, filter 0,2 µm, pompa distribusi, cleaning/flushing pump & tank) **tidak** dipetakan ke kunci sistem dokumen
(`MODULE_TO_SYSTEM`); datanya tetap tercatat di Teknologi. Pompa dosing SMBS/antiscalant/pH dipetakan ke `dosing`,
dan RO Pass 2 ke `ro`.

12 stage (urut): PO 5 → SOS 10 → BOM, PID, EWD, GAD 25 → Review & Approval 30 → Procurement of
Material 45 → Collecting Material / Inspection 55 → Fabrication 70 → Delivery 90 → Installation 95 →
Commissioning 97 → Preparation Manual Book 98 → Hand Over and Finished 100. Alur bisnisnya
(swimlane Client / Marketing & Direksi / Engineering / Warehouse & Purchasing / Technician) dari
inquiry sampai SAT, Commissioning Report, dan Hand Over.

## Peran pengguna

`lib/roles.js`: `ADMIN_EMAILS` (boleh semua, termasuk hapus), `VIEWER_EMAILS` (hanya lihat), sisanya di
`ALLOWED_EMAILS` = editor. `ADMIN_EMAILS` kosong → semua dianggap admin. Pengecekan sebenarnya di
server (API route), bukan di browser.

**Kebijakan yang diminta pemilik:** PM = **admin**. Engineering (posisi *project engineer*) = **editor**:
akses sama seperti PM (lihat, tambah, ubah, buat dokumen, komentar, notulensi, pengadaan) **kecuali
menghapus project**. Jadi email PM masuk `ADMIN_EMAILS`; email engineer cukup di `ALLOWED_EMAILS`.
Hapus **rapat** dan **barang pengadaan** boleh untuk editor (sudah dikonfirmasi pemilik); hanya
**hapus project** (`deleteProject`) dan **hapus data arsip** (`deleteArchiveProject`) yang khusus admin. Allowlist-nya `DELETE_ACTIONS` di `pages/api/gas.js`.

> Status 12 Okt 2026 (dicek lewat Vercel; hanya nama variabel yang terlihat, nilainya disembunyikan): `ADMIN_EMAILS`
> **sudah ada** di Production, Preview, dan Development (dibuat 9 Okt 2026), jadi pengguna yang tidak terdaftar di
> dalamnya kini berperan editor (tidak bisa menghapus project). Isinya tidak bisa diperiksa dari sini: pemilik perlu
> memastikan email PM ada di dalamnya. `VIEWER_EMAILS` belum ada (opsional). `DOCGEN_MEETING_SECRET` belum ada di
> Vercel. Variabel baru berlaku setelah redeploy.

## Environment variable (Vercel + `.env.local`)

`GAS_API_URL`, `GAS_API_TOKEN`, `DOCGEN_COMMISSIONING_URL`, `DOCGEN_HANDOVER_URL`, `DOCGEN_MEETING_URL`,
`DOCGEN_MEETING_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS`, `ADMIN_EMAILS`,
`VIEWER_EMAILS`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`. Jangan pernah menaruh nilai rahasia di repo atau
mencetaknya di log/PR.

Catatan (dicek 12 Okt 2026): `GAS_API_URL` hanya ada di Production, jadi Preview Deployment tidak bisa membaca data
Sheet (`/api/gas` membalas "Server belum dikonfigurasi"). Itu aman karena Preview tidak menulis ke data asli, tetapi
tampilan dengan data hanya bisa diperiksa di produksi, atau lewat salinan sheet uji dengan Apps Script terpisah.
`NEXT_PUBLIC_API_URL` masih ada di Vercel tetapi tidak dipakai kode mana pun (aman dihapus).

## Peta frontend

- Halaman: `/` **Hari Ini** (beranda: hal yang perlu ditindak lintas project, pengadaan, tindak lanjut rapat, dokumen; filter per divisi; logika di `lib/today.js`, pemetaan stage → divisi pemegang di `STAGE_OWNER`, ubah di sana kalau pembagian kerja berbeda), `/dashboard` grafik & tabel project, `/board` kanban, `/projects` (+ `/new`, `/[id]`), `/engineering-docs`,
  `/procurement`, `/documents` (+ `commissioning/new`, `handover/new`, `meetings` + `new`/`[id]`),
  `/arsip` (+ `/new`, `/[id]`; arsip project selesai, bisa ditambah/diubah dari web dan dari spreadsheet), `/activity`, `/login`.
- Shell: `pages/_app.js` + `components/Sidebar.jsx` (menu `NAV_GROUPS` dikelompokkan Harian / Project / Dokumen & Arsip; tambah halaman baru di sana). `pages/login.js` memakai panel merek dua kolom.
- Papan Kanban (`pages/board.js` + `components/KanbanBoard.jsx`): dikelompokkan per **fase** (`STAGE_PHASES` di
  `lib/stagePhases.js`, juga dipakai `StagePipeline`): 4 kolom di layar ≥1340px, 2 kolom di tablet, daftar bertingkat
  yang bisa dilipat di HP. Tahap kosong hanya setipis satu baris tapi tetap bisa jadi tujuan seret. Saat kartu
  diseret muncul papan tujuan di bawah layar (`DropTray`), dipasang **sesudah** seretan mulai: kalau dipasang
  seketika dan menutupi titik yang dipegang, Chrome membatalkan seretan. Di HP tidak ada seret-lepas; pindah tahap
  lewat menu di kartu.
- Alur teknologi: `lib/techflow.js` + `components/TechFlow.jsx` dipakai bersama oleh arsip dan detail project
  (modul urut dari air baku sampai produk; project aktif dibaca dari grid teknologi, dan kalau grid project kosong
  dipetakan dari data lama: kolom lama Sistem Terpasang + spesifikasi).
  `SimilarArchive` menyarankan project arsip yang mirip di tab Teknologi.
- **Teknologi project aktif = model yang sama dengan arsip, disimpan di grid AA-FI tab Project Tracker** (tab
  "Teknologi" di detail project, komponen `ModulePicker` dipakai bersama form arsip). Halaman memuat lewat
  `api.getTech` dan menyimpan lewat `api.saveProjectTech` bersama tombol "Simpan perubahan" (teknologi disimpan lebih
  dulu; `baseRev` dari pembacaan terakhir mendeteksi baris yang diubah orang lain atau di sheet). Mode lama sebagai
  cadangan: kalau backend membalas `Unknown action` (Code.gs belum v2.8), halaman memakai kunci `tech_v` dan
  `tech_<modul>_on|cap|unit|detail` di tab `Project Specs` (`TECH_SPEC_IDS`, ikut `SPEC_FIELD_IDS`, jadi tetap
  terjaga); kunci itu juga dibaca sebagai isi awal kalau grid project masih kosong.
  **Sistem untuk dokumen diturunkan langsung dari Teknologi** (tidak ada lagi data kedua yang bisa basi):
  `getProjects_` (Code.gs v2.8) membawa `tech` ringkas `[{key, cap, unit}]` per project (tanpa detail; `getTrackerTechIndex_`
  di Archive.gs, `undefined` kalau grid/Archive.gs belum ada), dan `projectSystems(project, techModules?)` di
  `lib/systems.js` mengubahnya jadi kunci sistem (`deriveSystemKeys`) dipakai prefill Commissioning/Hand Over, seksi
  Spesifikasi, `docReadiness` ("teknologi" kurang kalau kosong). Menyimpan teknologi membersihkan cache server dan
  `api` (`mutateAndInvalidate`). Kolom lama `Sistem Terpasang` kini hanya menyimpan **opsi dokumen** yang tidak ada di
  alur (`TECH_EXTRA_KEYS`: dosing/CIP terpisah, tangki antara, panel, ro_large, recycle; kartu "Opsi dokumen" di tab
  Teknologi) dan, sebagai cadangan, isi lama untuk project yang teknologinya belum dicatat (`effectiveSystems`, deteksi
  dari nama). Begitu teknologi disimpan, sisa isi lama di kolom itu dibersihkan menjadi opsi dokumen saja. Mode lama
  (backend belum v2.8, `project.tech` tidak ada) masih menulis kolom itu seperti dulu.
- **Spesifikasi Peralatan (Hand Over) diambil dari Teknologi**: `lib/specParser.js`. `specsFromTech(modules)` =
  kapasitas + satuan grid (`toSpecCap`) dan teks **Detail Spesifikasi** yang dibaca aturan tetap (bukan AI saat
  dipakai). Format yang dibaca disusun dari 23 Detail arsip yang ada (judul peralatan, lalu baris `Label : isi`:
  Model, Brand/Model, Capacity, Power (kW), Qty, Material, Size, Media, Volume, Valve, Controller, ...; satu sel boleh
  berisi beberapa peralatan, tiap peralatan dengan judulnya, mis. RO: RO UNIT, MEMBRANE, PRESSURE VESSEL, flowmeter,
  conductivity; Detail RO lama masih boleh memuat blok booster/cartridge/antiscalant/CIP, lihat aturan kepemilikan di bawah). `DETAIL_TEMPLATES` = kerangka kosong per modul
  (tombol "Isi dari template" di `ModulePicker`, `specHelp`), `DETAIL_EXAMPLES` = contoh placeholder. Nilai yang
  terbaca hanya **nilai otomatis**: di `lib/docgen/specs.js` `withDerived` menaruhnya di kolom yang kosong, isian
  manual (tersimpan di Project Specs) menang, `packSpecs(values, derived)` tidak menyimpan yang sama dengan otomatis
  (angka+satuan satu paket), dan mengosongkan kolom = kembali otomatis. Penanda "otomatis dari Teknologi" ada di
  `SpecsEditor`. Form Hand Over memakai logika yang sama. Kalau menambah peralatan/label baru: ubah `LABEL_KEYS`/`SUBS`
  dan template di `specParser.js`, dan jaga id field tetap sama dengan `HANDOVER_SECTIONS`. Template Google Docs tidak
  berubah (placeholder `{{...}}` sama).
  "Arsipkan teknologi" memakai teknologi dari grid apa adanya (lossless).
- **Spesifikasi Peralatan: satu modul Teknologi = satu seksi** (13 Okt 2026, KEP-0009; menggantikan susunan yang
  mengikuti template Hand Over): modul apa pun yang dicentang di Teknologi muncul sebagai **satu seksi** di tab
  Spesifikasi Peralatan, urut mengikuti alur Teknologi (40 modul dicentang = tepat 40 seksi). Seksi **tidak** mengikuti
  pengelompokan template dokumen Hand Over: RO hanya berisi RO (unit, membran, pressure vessel, flowmeter,
  conductivity, "Instrumen RO Tambahan"), sedangkan Booster, Cartridge Filter, Dosing Antiscalant, Pompa dan Tangki
  Cleaning/Flushing, Pompa Feed UF, Pompa Feed Air Baku, dan Tangki Air Baku masing-masing punya seksi sendiri; pompa dosing
  satu seksi per bahan kimia. Logikanya di **`lib/docgen/specModules.js`** (`moduleSpecContext`, `specSectionsFor`;
  `visibleSections` di `lib/docgen/specs.js` memanggilnya). **Id kolom tidak berubah** (sama dengan `HANDOVER_SECTIONS` dan
  `specExtra.js`), jadi data tersimpan, pembaca Detail, dan prefill form Hand Over tetap jalan; file itu hanya mengatur
  kolom mana tampil di seksi mana (diuji: tiap id kolom Hand Over punya tepat satu seksi, tanpa id ganda). Tiga sumber kolom:
  1. **Kolom bawaan `HANDOVER_SECTIONS`** yang dipecah per modul (`OWN` di `specModules.js`: Feed Pump dan Raw Tank dari
     Raw Water, Clarifier, Softener, UF tanpa pompa feed, RO tanpa paketnya; Filter slot 1/2 berjudul modul yang
     menempati slot). "Item Tambahan" yang di template dipakai bersama (`rw_additional_items`, `as_additional_items`,
     `ro_cip_additional_items`) dipasang di seksi pertama yang tampil (`SHARED_NOTES`).
  2. **Seksi tambahan `specExtra.js`** (`DEFS`: kolom `main`, sub-peralatan `subs`, `hosts` untuk dokumen); id
     `x_<modul>_<nama>`. Booster, Cartridge, pompa/tangki cleaning-flushing, pompa feed UF, dan antiscalant **memakai id
     seksi bawaan template yang sama** (`ro_bp_*`, `ro_cfh_*`/`ro_cf_*`, `ro_cip_*`, `uf_fwp_*`, `as_*`). Di tab Spesifikasi
     `unlessSection` **tidak dipakai lagi** (selalu tampil kalau modulnya dicentang); hanya jalur dokumen
     (`visibleExtras`/`planExtras`) yang masih memakainya supaya baris itu tidak tercetak ganda di Item Tambahan.
  3. **Opsi dokumen** (tab Teknologi > Opsi dokumen: tangki antara, dosing/CIP terpisah, panel) tetap punya seksi sendiri
     bertanda "Dari Opsi dokumen" karena bukan modul Teknologi; "Dosing/CIP terpisah" tidak tampil kalau sudah ada pompa
     dosing (tiap pompa dosing punya seksi sendiri).
  Project lama yang teknologinya belum dicatat: sistem lama atau hasil deteksi nama dipetakan ke modulnya
  (`SYSTEM_MODULES`). Data di Detail RO yang memuat blok booster/cartridge/antiscalant/CIP tetap terbaca ke id-nya, tetapi
  baru tampil setelah modulnya dicentang (mis. lewat "+ Tambah peralatan"). Keterbatasan lama yang tetap: id kolom Filter
  mengikuti **slot** (Birm → MMF → Carbon, `f1_*`/`f2_*`), jadi menambah filter yang mengubah urutan slot menggeser isian
  manual ke filter lain (nilai otomatis dari Teknologi tidak terpengaruh).
  **Aturan kepemilikan peralatan (14 Okt 2026, KEP-0012): satu peralatan hanya boleh muncul di satu tempat.** Peralatan yang
  punya modul sendiri di Teknologi (booster, cartridge, dosing antiscalant, pompa dan tangki cleaning/flushing, pompa feed UF,
  pompa dan tangki air baku, soft water tank, product tank, pompa filter, pompa dosing, pompa distribusi) hanya muncul di
  seksi modulnya, di template/contoh Detail modulnya, dan di butir dokumennya, **tidak diulang di modul lain**. Contoh yang
  sudah dibereskan: pompa feed RO sama dengan pompa booster (modul Booster Feed Pump), jadi seksi RO dan template/contoh
  Detail RO tidak lagi memuat pompa feed, booster, cartridge, antiscalant, dan CIP (hanya RO unit, membran, pressure vessel,
  flowmeter, conductivity); template UF tidak memuat pompa feed UF (modul UF Feed Pump); RO Pass 2 hanya punya satu pompa
  (`Pass 2 Booster Pump`). Kolom yang dipensiunkan **tetap terdaftar** (id di `HANDOVER_SECTIONS`/`DEFS`, jadi isian lama
  dan placeholder template Google Docs tidak rusak) tetapi tidak tampil: `RETIRED_FIELD_KEYS` dan `isRetiredField` di
  `specModules.js` (kolom bawaan template, mis. `ro_fwp_*`) serta `retired: true` di `DEFS` `specExtra.js` (mis. `x_ro2_fwp_*`).
  Detail lama yang masih memuat blok pompa feed RO tidak salah dibaca sebagai unit RO (blok dikenali dengan `[/feed/i, null,
  'skip']` di `SUBS.ro`) dan isinya tercetak sebagai baris tambahan (`lib/docgen/techDetail.js`), jadi tidak ada data hilang.
  Kalau menambah modul/kolom baru, periksa dulu apakah peralatan itu sudah dimiliki modul lain. Tumpang-tindih yang sengaja
  dibiarkan dan menunggu keputusan pemilik: tangki CIP milik UF vs modul Cleaning/Flushing Tank, pompa dosing + tangki bahan
  kimia milik Chlorination vs pompa dosing NaOCl.
  Pembaca teks **Detail Spesifikasi** untuk seksi tambahan ada di `readExtra` (`lib/specParser.js`) dan memakai
  definisi yang sama: isi di belakang titik dua (`Label : isi`) dipindah ke kolom yang sesuai; blok ber-judul yang
  cocok dengan sub-peralatan (`match`) mengisi kolom pompa/tangki/membran; satu blok saja = peralatan utama.
  `EXTRA_TEMPLATES`/`EXTRA_EXAMPLES` dibangkitkan dari definisi yang sama, jadi kerangka "Isi dari template" selalu terbaca
  (diuji round-trip). **Menambah/mengubah kolom seksi tambahan = ubah `DEFS` di `specExtra.js` saja** (template, contoh,
  pembaca, daftar id simpan `SPEC_FIELD_IDS`, dan teks dokumen ikut). Judul blok utama jangan memuat kata penanda
  sub-peralatan (mis. "MIXER" di Flokulator, karena sub "Mixer / Agitator" mengenalinya lewat kata itu).
  **Template Google Docs Hand Over tidak diubah isinya** (isi Google Doc tidak bisa diedit dari sini: konektor Drive hanya
  mengubah nama dan lokasi). Karena itu daftar peralatan di dokumen tidak lagi diisi lewat `{{PLACEHOLDER}}` per seksi,
  tetapi dibangun `handover.gs` dari kode (lihat "Dokumen Hand Over mengikuti Teknologi" di bawah). Jalur lama
  (`planExtras`/`applyExtraPlan` di `specExtra.js`: seksi tambahan dicetak sebagai baris **Item Tambahan** di seksi induk)
  tetap dikirim di payload untuk script lama yang belum diperbarui, tetapi tidak lagi tampil di form.
  Form Hand Over membaca Teknologi dari grid (GET `tech`); kalau backend belum v2.8 atau grid kosong dipakai Teknologi
  di Spesifikasi (`readTech`, kunci `tech_*`), sama seperti tab Spesifikasi di detail project. Batas backend: Code.gs
  `SPECS_MAX_KEYS = 400` kunci per project (hanya koreksi manual yang tersimpan, jadi aman; mode lama menambah
  4 kunci `tech_*` per modul). Soft Water Tank kini seksi sendiri (dulu kapasitasnya salah dipetakan ke Brine Tank
  softener; Brine Tank hanya dibaca dari Detail softener).
- **Dokumen Hand Over mengikuti Teknologi (13 Okt 2026, KEP-0010): Teknologi (centang) → Spesifikasi (isi) → Dokumen.**
  Daftar "Items Handed Over" di dokumen sama persis dengan modul yang dicentang di Teknologi, satu modul = satu butir,
  urut alur pengolahan (40 modul dicentang = 40 butir), dengan spesifikasi dari tab Spesifikasi Peralatan. Bagian
  "Modul Equipment" (centang seksi template) di form `/documents/handover/new` diganti:
  - **Project terkait**: seksi = `moduleSpecContext` + `specSectionsFor` (sama dengan tab Spesifikasi), diedit di
    `EquipmentSections` (kotak "Cetak" per seksi untuk tidak mencetak satu butir; kolom `f1_type`/`f2_type` disembunyikan,
    nama filter diambil dari modulnya). "+ Tambah peralatan" dan "Opsi dokumen" (tangki antara, dosing/CIP terpisah, panel)
    hanya berlaku untuk dokumen itu; **Teknologi project tidak berubah**. Penyesuaian ini ikut draft localStorage
    (`{ __v: 2, form, localMods, localOpts, excluded }`; draft lama berupa isian form saja tetap terbaca).
  - **Tanpa project**: daftar kosong, daftar pilihan peralatan terbuka sendiri.
  - **Pratinjau isi dokumen** (`ho-preview`) menampilkan butir persis seperti yang dikirim; generate ditolak kalau tidak ada butir.
  - **Aturan teks** (`handoverItems.js`): kolom teks/ukuran di depan masuk judul butir ("Clarifier System : Capacity 10 m3/hr,
    Material ..."), kolom sebaris (pompa, membran, tangki) jadi baris bullet, Item Tambahan satu baris per barisnya; kolom
    kosong dicetak `.......` supaya bisa dilengkapi di Google Docs; blower/mixer pendamping dilewati kalau kosong; satu pompa
    saja jadi satu kalimat. Nama butir ada di `DOC_TITLE` (diuji: ke-40 modul punya nama, tanpa kata Indonesia).
  - **Isi Teknologi tampil penuh dan ikut tercetak** (13 Okt 2026): data Teknologi project asli umumnya baru mencatat 1-3
    modul dan jarang punya Detail, dan tulisan bebas di Detail (ukuran, bahan tambahan, tekanan, pompa kedua, catatan)
    tidak punya kolom Spesifikasi sehingga dulu hilang di dokumen. Sekarang (a) tiap seksi di form memuat panel
    **"Isi di Teknologi"** (kapasitas + satuan dan teks Detail apa adanya, tautan "Lengkapi di Teknologi"; `TechSource` di
    `EquipmentSections`), ringkasan "Teknologi project mencatat N modul: M berkapasitas, K punya Detail" di bawah judul
    bagian peralatan; dan (b) **baris Detail yang belum tercetak ikut jadi baris tambahan di butir modulnya**
    (`lib/docgen/techDetail.js`, dipanggil `buildDocItems`; pratinjau dan muatan memakai fungsi yang sama). Aturannya dua
    pemeriksaan: baris yang **dipakai pembaca** (kalau baris itu dibuang, nilai otomatis modul berubah) dilewati, dan
    baris yang semua kata/angkanya **sudah ada di teks butir** dilewati (dinormalkan: "m3/h" = "m3/hr", "units" = "unit",
    "3phase" = "3 phase"). Peralatan kedua di satu Detail yang seluruhnya tidak dipakai pembaca (mis. pompa kedua)
    dicetak utuh dengan judulnya; teks bebas tanpa titik dua dicetak apa adanya. Nilai otomatis dihitung dari Teknologi
    (bukan dari isian form), jadi koreksi manual di Spesifikasi tidak memunculkan nilai lama sebagai baris tambahan.
    Butir yang tadinya satu kalimat (satu pompa) jadi "Judul, consist of:" + baris. Tanpa perubahan `.gs` (baris tambahan
    hanyalah string di `rows`). Diuji dengan 23 Detail arsip asli (21 butir dapat tambahan, ~55 baris, semuanya info baru).
  - **Kompatibilitas urutan deploy**: payload tetap memuat bentuk lama (`has_*` diturunkan dari modul yang dicetak, isian,
    Item Tambahan) di samping `equipment`, jadi script lama yang masih live tetap membuat dokumen susunan lama, dan form
    memberi tahu ("script Generator Hand Over belum diperbarui") karena jawabannya tanpa `generator`. Kalau mengubah
    kolom/butir, ubah `handoverItems.js`; kalau mengubah template Docs, jaga dua baris contoh di atas.

- **Arah data Teknologi ↔ Spesifikasi (13 Okt 2026): satu arah, Teknologi → Spesifikasi.** Isian di Spesifikasi hanya
  tersimpan sebagai koreksi manual di `Project Specs` dan **tidak** menulis ke Teknologi (keputusan KEP-0008: grid
  Teknologi hanya punya Ada/Kapasitas/Satuan/Detail, sedangkan Spesifikasi punya ratusan kolom rinci tanpa tempat di grid;
  menulis balik ke teks Detail bisa menimpa teks bebas tim). Dua tambahan di tab Spesifikasi (frontend saja, tanpa `.gs`):
  1. **Penanda selisih**: kolom yang dikoreksi dan isinya lain dari nilai otomatis Teknologi diberi keterangan "Beda dari
     Teknologi: ..." + tombol "Pakai nilai Teknologi" (mengosongkan koreksi, kolom kembali otomatis). Logikanya
     `specDiffs` + `fieldKey` + `sameValue` di `lib/docgen/specs.js` (fungsi murni; membandingkan isian MANUAL, bukan nilai
     yang sudah digabung otomatis; angka dibandingkan sebagai angka, teks tanpa beda huruf besar/kecil). Tombol reset
     hanya untuk peran yang boleh menulis (`canEdit`); penanda tetap tampil untuk viewer.
  2. **"+ Tambah peralatan"** (`components/AddEquipment.jsx`): daftar modul yang belum dicentang (dikelompokkan per fase
     lewat `groupSchemaByPhase` di `lib/techflow.js`, juga dipakai `ModulePicker`). Memilih modul memanggil `addTechModule`
     di `pages/projects/[id].js` = `setTech(...)` yang sama dengan tab Teknologi, jadi ikut "Simpan perubahan" (grid maupun
     mode lama `tech_*`); yang masuk ke Teknologi hanya **centang modulnya** (kapasitas/Detail tetap kosong). Seksi
     barunya muncul seketika karena Spesifikasi membaca Teknologi yang belum disimpan, lalu dibuka dan digulir ke layar
     (`SpecsEditor`, id `spec-sec-<kunci>`). Tombol disembunyikan selama Teknologi belum selesai dimuat.
- **Langkah berikutnya** (kolom `Next Action*`, `Blocker` dari Code.gs v2.6) tampil di tabel project, kartu
  HP, kartu kanban, dan detail project. `lib/nextAction.js` (fungsi murni: `nextActionInfo`, `dueText`,
  `nextActionSortKey`; ≤7 hari = amber, lewat = rust; `nextAction === undefined` berarti backend belum
  v2.6 jadi kolom disembunyikan), `components/NextActionLine.jsx` (ringkasan satu blok untuk daftar),
  `components/NextActionCard.jsx` (kartu di bawah judul detail; nilainya ikut tombol "Simpan perubahan").
  `components/PicInput.jsx` = isian PIC dengan saran nama/divisi; `showDivision` hanya dipasang pada PIC
  langkah berikutnya, karena halaman Hari Ini menyaring per divisi dari teks itu (`divisionFromPic`).
- **PIC dropdown dan aturan otomatis Status / Prioritas / Stage** (14 Okt 2026, KEP-0013; frontend saja, tanpa `.gs`):
  kartu "Info umum" di detail project memakai `components/PicSelect.jsx` (pilihan dari `lib/pics.js`: tulisan PIC yang sudah
  dipakai di project lebih dulu, lalu divisi baku, lalu nama peserta tetap, plus "Lainnya (ketik sendiri)" dan nilai lama yang
  tidak ada di daftar tetap tampil). Isi sheet memakai kosakata PM ("Engineer", "Technician"); itu dipertahankan dan **tidak
  ditulis ulang** supaya filter PIC di Semua Project tidak terbelah. Aturan ada di **`lib/projectRules.js`** (fungsi murni,
  diuji dengan data sheet asli): **Stage** adalah pemicu utama. Status: stage `Hand Over and Finished` = `Completed`; Hambatan
  (kolom `Blocker`) terisi = `On Hold`; selain itu `In Progress` (`Not Started` hanya manual, karena project baru memang
  mulai `In Progress` di tahap PO). Prioritas: selesai = `Low`; ada hambatan = `High`; selain itu menurut sisa waktu ke tenggat
  (Tanggal kirim; sesudah terkirim Target selesai): terlewat atau ≤14 hari = `High`, ≤45 hari = `Medium`, lebih jauh =
  `Low`; tanpa tanggal = `Medium` (standar, dengan keterangan "isi tanggalnya"). **Status dan Prioritas "mengikuti aturan"
  kalau isinya sama dengan hasil aturan** (diturunkan saat halaman dimuat, tidak disimpan sebagai penanda): kotak "Otomatis"
  per kolom tercentang dan nilainya ikut berubah; kalau PM mengubahnya sendiri kotak mati dan nilai manual **tidak pernah
  ditimpa diam-diam**, hanya muncul "Aturan menyarankan ... / Pakai saran". Status `Completed` manual memindahkan stage ke
  `Hand Over and Finished`; membuka lagi project selesai (stage akhir diganti) memundurkan stage ke `Preparation Manual Book`.
  Checklist: BOM, P&ID, EWD, dan GAD sama-sama `Completed` = stage minimal `Review & Approval` (maju otomatis **hanya setelah
  simpan checklist berhasil**, tidak pernah mundur, dan kalau PM menurunkan stage sendiri hanya muncul saran dengan tombol
  "Pindahkan"). Papan Kanban memakai `stageChangePatch`: memindah kartu ikut menyesuaikan status/prioritas yang mengikuti
  aturan (yang manual tidak disentuh) dan toast menyebut yang ikut berubah. **Sengaja tidak dibuat**: aturan stage dari
  Commissioning Report / Handover Report `Completed` (di data asli 15 dari 17 project aktif sudah berisi itu padahal
  stage-nya masih jauh, jadi bukan bukti stage) dan stage otomatis dari Pengadaan. Batasan data: 12 dari 17 project aktif
  belum punya tenggat (Target selesai kosong di semua project), jadi prioritasnya `Medium` standar sampai tanggalnya diisi.
  Kalau mengubah aturan: ubah `projectRules.js` (satu tempat) dan `RULE_SUMMARY` (teks "Lihat aturan otomatis" di kartu).
- **Terlambat / segera** dihitung di satu tempat: `buildActionItems` + `severityCounts` di `lib/today.js`
  (aturan project-nya `isOverdue`/`isDueSoon` di `lib/projectHelpers.js`; ≤14 hari untuk tenggat kirim project,
  ≤7 hari untuk langkah berikutnya, pengadaan, dan rapat). Halaman Hari Ini dan banner `TodayBanner` di
  Dashboard memakai hook yang sama (`lib/useActionItems.js`), jadi angkanya selalu sama. Jangan menghitung ulang
  terlambat/segera di halaman lain. Dashboard sengaja hanya berisi analitik (kartu, grafik, tabel); daftar yang
  perlu ditindak ada di Hari Ini. (Panel lama `AttentionPanel`, `MeetingSummary`, dan `ProcurementSummary`
  sudah dihapus; kalau perlu, ada di riwayat git.)
- **Istilah UI**: teks yang tampil ke pengguna berbahasa Indonesia (Tanggal kirim, Tenggat, Prioritas, Pengguna).
  Nilai yang tersimpan di Sheet tetap apa adanya (status `In Progress`/`Completed`, prioritas `High`/`Medium`/`Low`,
  nama 12 stage, kolom `Delivery Date`), dan nama fase Dashboard (Pre-Delivery/Delivered/Completed) belum diganti.
- API: `pages/api/gas.js` (proxy utama), `docgen.js` (Commissioning/Hand Over + catat ke Document Log
  + update checklist), `meeting-doc.js` (Notulensi), `auth/[...nextauth].js`.
- Pustaka: `lib/` (`api.js`, `useProjects.js`, `useCachedResource.js`, `persistedCache.js`, `stages.js`,
  `systems.js`, `meetings.js`, `procurement.js`, `roles.js`, `docgen/*`).

## Desain UI

- Token warna di `styles/globals.css` sebagai triplet RGB (`--color-*`), dipetakan di `tailwind.config.js`.
  Mode gelap = kelas `dark` di `<html>`. Pakai kelas token (`bg-panel`, `text-ink`, `text-inkmute`,
  `text-onaccent` di atas isian aksen, `text-amberink` untuk teks amber), **bukan** hex atau `text-white`.
- Tombol: `.btn` + `.btn-primary|secondary|ghost|danger`. Font: Inter (teks), Space Grotesk (judul),
  IBM Plex Mono (data), dimuat lewat `<link>` di `pages/_document.js`.
- Target kontras minimal 4,5:1 di kedua tema; hormati `prefers-reduced-motion`.
- Di HP (lebar < 768px): teks informasi minimal 12px (`text-xs`; jangan `text-[10px]`/`text-[11px]`, kecuali
  glyph dekoratif, petunjuk `kbd`, dan lencana angka), tombol minimal 40px (`h-9 max-md:h-10`), kolom isian
  16px (`.input` sudah otomatis, supaya iOS tidak memperbesar halaman). Tautan/tombol teks kecil diberi
  kelas `.tap` agar area sentuhnya 44px tanpa mengubah tata letak (jangan dipakai pada elemen
  `overflow:hidden`/`line-clamp`). Kolom pencarian dan filter wajib punya `aria-label`.
- Design system di Claude (artifact "Bening Hub") berisi token & 21 komponen; token-nya masih versi
  lama sebelum PR #1 (kontras) dan perlu disinkronkan ulang.

## Cara kerja yang disepakati

- Perubahan lewat **branch + Pull Request** ke `main`; jangan push langsung ke `main`.
- Sebelum PR: `npm install` lalu `npm run build` harus lolos. Tidak ada test otomatis.
  (`package-lock.json` sengaja tidak di-commit.) Peringatan font saat build offline itu normal.
- Repo ini privat. Deploy otomatis oleh Vercel dari `main`; PR mendapat Preview Deployment.
- GitHub GraphQL tidak tersedia di sandbox Claude: pakai `gh api` (REST), bukan `gh pr create`.

## Catatan kerja PM di Google Drive (ingatan antar-sesi)

Claude tidak mengingat antar-percakapan. Catatan, keputusan, dan tindak lanjut PM disimpan di Drive,
lewat konektor Google Drive dan Google Sheets (bukan lewat API Bening Hub; frontend tidak menyentuhnya).

- Folder `_Claude` (ID `1RKhlopBAsrsOVE7M4JG153Gv9MVynEm1`) di dalam folder induk "Project Engineer - PT Bening
  Khatulistiwa" (ID `1KK8zk3jMyElvd-qYn69Lceza-P-GiLas`). Isinya sheet **Basis Data Catatan**
  (ID `1E-MlFc-6jSmeBzlV8z9HwLfkr-VtDIICE1J60Nx3FK4`) dan subfolder `Dokumen` (ID `1fW2vAamUiJ_9w8BqLL8lyNN6bpy415kU`).
- Tab sheet: `Panduan` (aturan), `Catatan` (CAT-), `Keputusan` (KEP-), `Tindak Lanjut` (TL-), `Peta Drive`
  (daftar folder/berkas penting beserta ID).
- Kalau tugas menyangkut catatan, keputusan, atau tindak lanjut PM: baca tab `Panduan` dulu, lalu tab yang
  relevan. Tambah baris lewat append, ubah baris lewat ID-nya, **jangan hapus baris** (ubah kolom Status).
- Konektor Drive hanya bisa mengubah **nama dan lokasi** file, bukan isi Google Doc atau file teks yang sudah
  ada. Dokumen panjang dibuat sebagai Doc baru di `Dokumen`; yang bisa diubah di tempat hanya Google Sheets.
- **Jangan menyimpan rahasia** (kata sandi, token, API key, data pribadi): folder induk dan `_Claude` dibagikan
  "siapa saja dengan tautan bisa melihat", dan spreadsheet `Project Tracker_PT Bening Khatulistiwa` bahkan "siapa saja
  dengan tautan bisa mengedit" (status 12 Okt 2026; TL-0001 di tab Tindak Lanjut, pemilik yang memutuskan). Jangan
  mengubah izin berbagi tanpa diminta.
- Sheet `Project Tracker_PT Bening Khatulistiwa` (di folder Project Management) adalah database aplikasi,
  bukan tempat catatan. Jangan mengeditnya lewat konektor kecuali diminta.

## Hal yang belum diketahui / perlu ditanyakan

- `docgen/meeting.gs`: versi live belum memeriksa `GENERATOR_SECRET` (hanya disebut di komentar).
  Salinan di repo sudah ditambah pengecekannya; baru berlaku setelah ditempel & di-deploy ulang, dan
  `GENERATOR_SECRET` (Script Properties) harus sama dengan `DOCGEN_MEETING_SECRET` (Vercel).
- Tampilan aplikasi asli belum bisa diperiksa dari sandbox (butuh login Google + data Sheet live); Preview Deployment
  juga tanpa data (lihat catatan `GAS_API_URL` di bagian Environment variable). Hasil nyata terlihat di produksi
  dan di tab `Activity Log` (aksi yang dilakukan pemilik lewat web tercatat di sana).
- Zona waktu: spreadsheet `America/Los_Angeles`, script WIB (disimpulkan dari jam ringkasan mingguan; pemilik belum
  mengonfirmasi). v2.7 sudah tahan terhadap perbedaan ini, tetapi jam di tab Activity Log tampil dalam waktu Los Angeles.
- Data tanggal lama yang janggal (bukan akibat penataan, hanya terlihat saat dirapikan): project 2015-2018 masih
  `In Progress`; tanggal kirim sebelum tanggal PO pada TKE-ISK; Tanggal DP sebelum Tanggal PO pada TKE MUS, TKE BMM, dan
  TKE CAP; No 18 Unilever Skin RO1 & RO2 Auto berada di tahap Hand Over and Finished tetapi Status masih `In Progress`.
  Perlu dikonfirmasi pemilik sebelum diubah.
- Kolom Langkah berikutnya (`Next Action*`) dan `Blocker` masih kosong di semua project (dicek 12 Okt 2026), jadi
  halaman Hari Ini baru berguna penuh setelah pemilik mengisinya (lewat kartu Langkah berikutnya di detail project).
- Simpan teknologi dari web ke sheet asli belum pernah dicoba (Code.gs v2.8 baru diuji di tiruan Node dengan data sheet
  asli, lihat "Teknologi project aktif"). Setelah pemilik men-deploy v2.8, cek satu project: ubah kapasitas di tab
  Teknologi lalu lihat barisnya di Project Tracker dan baris `Update Teknologi` di Activity Log (TL-0013, TL-0018).
- Dokumen Hand Over dinamis (`docgen/handover.gs` baru, 13 Okt 2026) baru diuji di tiruan DocumentApp di Node; perilaku
  Google Docs sungguhan belum pernah dilihat. Setelah pemilik menempel dan men-deploy ulang (Deploy > Manage deployments >
  ikon pensil > Version: New version > Deploy, URL tetap sama), buat satu dokumen Hand Over dari project yang teknologinya
  terisi lalu periksa: jumlah dan urutan butir, penomoran berlanjut (1, 2, 3, ...), bullet rinci menjorok di bawah
  judulnya, dan BUYER/SELLER tetap di bawah (TL-0025). Kalau form menampilkan peringatan "susunan template lama", berarti
  script belum diperbarui atau cara dinamis jatuh ke cadangan (alasannya ikut ditampilkan).
