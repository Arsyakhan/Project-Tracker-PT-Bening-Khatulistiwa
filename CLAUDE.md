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
| `apps-script/Code.gs` (v2.6) | `doGet`/`doPost`, token, cache 30 dtk, proyek, checklist, komentar, activity log, document log, specs, meetings |
| `apps-script/Archive.gs` | tab `[ARSIP] FINISHED PROJECT` dibaca & ditulis dua arah (`getArchive_`, `saveArchiveProject_`, `deleteArchiveProject_`); header 2 baris, 20 grup modul (Ada/Kapasitas/Satuan/Detail). Konflik edit dideteksi lewat `rev` per baris (sidik jari isi baris), karena sheet tidak punya kolom Version. Baris lama tidak diubah kecuali diedit |
| `apps-script/Procurement.gs` | tab Procurement (`getProcurement_`, `saveProcurementItem_`, `deleteProcurementItem_`); `doGet`/`doPost` di Code.gs yang memanggilnya |
| `apps-script/WeeklyDigest.gs` | email ringkasan mingguan, trigger Senin ~07.00 |
| `apps-script/Backup.gs` | salinan spreadsheet mingguan, trigger Senin ~02.00, simpan 8 terakhir |
| `apps-script/Seed-Meetings.gs` | impor sekali jalan 2 rapat awal; **jangan dijalankan ulang tanpa perlu** |

**Script Properties** (Project Settings): `API_TOKEN` (dibuat `setup()`, = `GAS_API_TOKEN` di Vercel),
`ADMIN_NOTIFICATION_EMAILS`, `DIGEST_EMAILS`, `APP_URL`, `BACKUP_FOLDER_ID` (otomatis), `LAST_BACKUP_AT` (otomatis).

**Aksi API** (lewat `/api/gas`, allowlist di `pages/api/gas.js`):

- GET: `projects`, `dashboard`, `meta`, `activityLog`, `comments`, `documents`, `specs`, `meetings`, `procurement`, `archive`
- POST: `addProject`, `updateProject`, `updateChecklist`, `deleteProject`, `addComment`, `logDocument`,
  `saveSpecs`, `saveMeeting`, `deleteMeeting`, `setMeetingDoc`, `saveProcurementItem`, `deleteProcurementItem`, `saveArchiveProject`, `deleteArchiveProject`
- `deleteProject` dan `deleteArchiveProject` hanya boleh admin; `deleteMeeting` dan `deleteProcurementItem` boleh editor (dicek di `/api/gas`).
- Penyimpanan data berversi (`Version` + `baseVersion`) untuk Specs, Meetings, Procurement agar edit
  bersamaan tidak saling menimpa. Respons selalu `{ ok, data }` atau `{ ok:false, error }`.

### Tab Google Sheet

`Project Tracker` (kolom kunci `Project ID` = `prj_xxxx`, jangan diedit manual; kolom tambahan dibuat otomatis: Lokasi Plant, Alamat, Kontak Owner, Sistem Terpasang, **Next Action, Next Action Owner, Next Action Due, Blocker, Blocked Since**; `Blocker` terisi = project terhambat, `Blocked Since` diisi/dikosongkan otomatis oleh `updateProject_`), `Engineering Deliverables
Checklist`, `Activity Log`, `Comments`, `Document Log`, `Project Specs`, `Meetings`, `Procurement`
(tab-tab ini dibuat otomatis), plus tab manual pemilik: `Dashboard`, `Reference`,
`[ARSIP] FINISHED PROJECT`, `[ARSIP] Data HO and Commisioning- Dokumen Fisik`. Tab `[ARSIP]` dan
`Dashboard` bukan bagian API.

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
| Kunci modul arsip & urutan alur teknologi | `ARCHIVE_MODULE_KEYS` di `Archive.gs` | `lib/techflow.js` (`FLOW_PHASES`, `FLOW_STEPS`) |
| Allowlist aksi | `doGet`/`doPost` | `pages/api/gas.js` (`GET_ACTIONS`, `POST_ACTIONS`) |

Status terakhir diperiksa (9 Okt 2026): `STAGE_WEIGHTS` dan `SYSTEM_KEYS` cocok; nama field HO
cocok 100% dengan `schema.js`; Commissioning cocok (`checklist_items` dibuat di sisi halaman).

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

> Status 9 Okt 2026: `ADMIN_EMAILS` dan `VIEWER_EMAILS` **belum diisi** di Vercel, artinya saat ini
> semua pengguna yang boleh login adalah admin (engineer pun bisa menghapus). Variabel baru berlaku
> setelah redeploy. `DOCGEN_MEETING_SECRET` juga belum ada di Vercel.

## Environment variable (Vercel + `.env.local`)

`GAS_API_URL`, `GAS_API_TOKEN`, `DOCGEN_COMMISSIONING_URL`, `DOCGEN_HANDOVER_URL`, `DOCGEN_MEETING_URL`,
`DOCGEN_MEETING_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS`, `ADMIN_EMAILS`,
`VIEWER_EMAILS`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`. Jangan pernah menaruh nilai rahasia di repo atau
mencetaknya di log/PR.

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
  perlu ditindak ada di Hari Ini. `AttentionPanel`, `MeetingSummary`, dan `ProcurementSummary` tidak dipakai
  lagi (filenya belum dihapus).
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

## Hal yang belum diketahui / perlu ditanyakan

- `docgen/meeting.gs`: versi live belum memeriksa `GENERATOR_SECRET` (hanya disebut di komentar).
  Salinan di repo sudah ditambah pengecekannya; baru berlaku setelah ditempel & di-deploy ulang, dan
  `GENERATOR_SECRET` (Script Properties) harus sama dengan `DOCGEN_MEETING_SECRET` (Vercel).
- Tampilan aplikasi asli belum bisa diperiksa dari sandbox (butuh login Google + data Sheet live);
  cek lewat Vercel Preview.
