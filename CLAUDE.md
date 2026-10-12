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
| `apps-script/Code.gs` (v2.7) | `doGet`/`doPost`, token, cache 30 dtk, proyek (+ kolom `Tahun`), checklist, komentar, activity log, document log, specs, meetings. Tanggal ditulis jam 00:00 menurut zona waktu **spreadsheet** (`sheetTimeZone_`, `dayString_`); sel berisi rumus tidak ditimpa (`isFormulaCell_`) |
| `apps-script/Archive.gs` | tab `[ARSIP] FINISHED PROJECT` dibaca & ditulis dua arah (`getArchive_`, `saveArchiveProject_`, `deleteArchiveProject_`); dibaca **per posisi kolom**: header 2 baris, kolom A-C = No/Tahun/Nama, lalu 21 grup modul (17 × Ada/Kapasitas/Satuan/Detail + 4 pompa dosing hanya Ada). Konflik edit dideteksi lewat `rev` per baris (sidik jari isi baris), karena sheet tidak punya kolom Version. Baris baru ditaruh tepat di bawah project terakhir (`archiveNextRow_`, bukan `getLastRow()`). Baris lama tidak diubah kecuali diedit |
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

- GET: `projects`, `dashboard`, `meta`, `activityLog`, `comments`, `documents`, `specs`, `meetings`, `procurement`, `archive`
- POST: `addProject`, `updateProject`, `updateChecklist`, `deleteProject`, `addComment`, `logDocument`,
  `saveSpecs`, `saveMeeting`, `deleteMeeting`, `setMeetingDoc`, `saveProcurementItem`, `deleteProcurementItem`, `saveArchiveProject`, `deleteArchiveProject`
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
> **Masih tersisa:**
>
> 1. Grid teknologi di tracker belum tersambung ke data teknologi di web (lihat di bawah; TL-0013).
> 2. Keputusan dan tindakan pemilik (izin berbagi sheet, zona waktu, data janggal, rahasia generator Notulensi) ada di
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
- **Kolom A-Z**: No, **Tahun**, Project Name, PO Number, Client, Technology/Capacity, Current Stage, Status,
  Stage Progress (%), Engineering Doc Progress (%), Priority, PIC, Tanggal PO, Tanggal DP, Delivery Date, Target
  Finish Date, Next Action, Next Action Owner, Next Action Due, Blocker, Blocked Since, Remarks, Lokasi Plant,
  Alamat, Kontak Owner, Sistem Terpasang. `Blocker` terisi = project terhambat; `Blocked Since` diisi/dikosongkan
  otomatis oleh `updateProject_`.
- **Grid teknologi AA-CT** (72 kolom, 21 modul, urutan air baku → produk, **sama persis dengan tab arsip**): tiap
  modul punya `Ada` (kotak centang), `Kapasitas`, `Satuan` (MPH/LPH/LITER/MPD/LPD), `Detail Spesifikasi`; empat
  pompa dosing (NaOCl, PAC, Soda Ash, Polimer) hanya `Ada`. Kolom **CU = `Project ID`** (`prj_xxxx`, jangan diedit
  manual). Grid ini **diisi manual di sheet**; website belum membacanya: teknologi project aktif di web tersimpan di
  tab `Project Specs` (kunci `tech_*`). Menyambungkan keduanya = pekerjaan lanjutan.
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

## Kontrak yang harus sinkron (sumber bug paling umum)

| Hal | Di sisi backend | Di sisi frontend |
|---|---|---|
| 12 stage & bobot progress | `STAGE_WEIGHTS` di `Code.gs` (+ tab `Reference`) | `lib/stages.js` (pengelompokan 4 fase ada di `lib/stagePhases.js`, hanya frontend) |
| Kunci sistem terpasang | `SYSTEM_KEYS` di `Code.gs` | `lib/systems.js` |
| Item checklist (7 dokumen) | `CHECKLIST_ITEMS` di `Code.gs` | `lib/docgen/schema.js` (`DOC_GENERATOR_ROUTE`), `pages/api/docgen.js` |
| Status pengadaan | `PROC_STATUSES` di `Procurement.gs` | `lib/procurement.js` |
| Status rapat/agenda/kehadiran | `MEETING_STATUSES`, `ITEM_STATUSES`, `ATTENDANCE_STATUSES` | `lib/meetings.js` |
| Field dokumen (`data.xxx`) | `docgen/*.gs` | `lib/docgen/schema.js` + `pages/documents/*/new.js` |
| Placeholder `{{...}}` | template Google Docs | `docgen/*.gs` |
| Kunci modul arsip & urutan alur teknologi (juga urutan grid AA-CT di Project Tracker) | `ARCHIVE_MODULE_KEYS` di `Archive.gs` + judul modul di baris 1 tab arsip/tracker | `lib/techflow.js` (`FLOW_PHASES`, `FLOW_STEPS`, `ADA_ONLY`) |
| Nama kolom Project Tracker (header baris 1) | `COL_*`, `TEXT_FIELDS`, `DATE_FIELDS` di `Code.gs` | field hasil `getProjects_`; `EDITABLE_FIELDS` di `pages/projects/[id].js`; `COLUMNS` di `lib/exportCsv.js` |
| Bobot status dokumen checklist | `CHECKLIST_WEIGHTS` di `Code.gs` | rumus `Progress (%)` di tab Checklist (ada di sheet, bukan di repo) |
| Allowlist aksi | `doGet`/`doPost` | `pages/api/gas.js` (`GET_ACTIONS`, `POST_ACTIONS`) |
| Normalisasi nomor PO (PO kembar) | `normalizePO_` di `Code.gs` | `normalizePo` di `lib/projectHelpers.js` (hanya untuk peringatan di form Project Baru; yang menolak tetap backend) |

Status terakhir diperiksa (9 Okt 2026): `STAGE_WEIGHTS` dan `SYSTEM_KEYS` cocok; nama field HO
cocok 100% dengan `schema.js`; Commissioning cocok (`checklist_items` dibuat di sisi halaman).
Diperiksa lagi 12 Okt 2026: 21 modul teknologi cocok antara `Archive.gs`, `lib/techflow.js`, dan tab arsip/tracker
baru di salinan uji (termasuk `dosing_polimer`; `product_tank` kini punya kapasitas, satuan, dan detail).

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
  (modul urut dari air baku sampai produk; project aktif dipetakan dari sistem terpasang + spesifikasi).
  `SimilarArchive` menyarankan project arsip yang mirip di tab Teknologi.
- **Teknologi project aktif = model yang sama dengan arsip** (tab "Teknologi" di detail project, komponen
  `ModulePicker` dipakai bersama form arsip). Disimpan di tab `Project Specs` sebagai kunci datar
  `tech_v` dan `tech_<modul>_on|cap|unit|detail` (daftar id di `TECH_SPEC_IDS`, `lib/techflow.js`; ikut
  `SPEC_FIELD_IDS`), jadi tanpa perubahan backend. **Sistem terpasang diturunkan dari modul** lewat
  `deriveSystemKeys` (opsi tambahan: dosing/CIP terpisah, intermediate tank, panel, ro_large, recycle).
  Saat disimpan, kolom kapasitas Spesifikasi (form Hand Over) yang masih kosong diisi dari teknologi
  (`fillSpecCaps`, tidak pernah menimpa). Project yang belum punya teknologi tersimpan dibaca dari data
  lama (`prefillTech`). "Arsipkan teknologi" memakai teknologi tersimpan apa adanya (lossless).
  Grid "Spesifikasi Teknologi" di tab Project Tracker (kolom AA-CT, lihat "Tab Google Sheet") belum tersambung ke
  tab Teknologi ini: yang satu diisi manual di sheet, yang lain tersimpan di `Project Specs`.
- **Langkah berikutnya** (kolom `Next Action*`, `Blocker` dari Code.gs v2.6) tampil di tabel project, kartu
  HP, kartu kanban, dan detail project. `lib/nextAction.js` (fungsi murni: `nextActionInfo`, `dueText`,
  `nextActionSortKey`; ≤7 hari = amber, lewat = rust; `nextAction === undefined` berarti backend belum
  v2.6 jadi kolom disembunyikan), `components/NextActionLine.jsx` (ringkasan satu blok untuk daftar),
  `components/NextActionCard.jsx` (kartu di bawah judul detail; nilainya ikut tombol "Simpan perubahan").
  `components/PicInput.jsx` = isian PIC dengan saran nama/divisi; `showDivision` hanya dipasang pada PIC
  langkah berikutnya, karena halaman Hari Ini menyaring per divisi dari teks itu (`divisionFromPic`).
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
- Grid teknologi di Project Tracker belum tersambung ke web (lihat "Teknologi project aktif" dan "Tab Google Sheet").
