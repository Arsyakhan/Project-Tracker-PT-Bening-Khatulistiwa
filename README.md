# Bening Hub — PT Bening Khatulistiwa

Pusat pelacakan project & dokumen engineering PT Bening Khatulistiwa. Sinkron dua arah dengan
spreadsheet **"Project Tracker_PT Bening Khatulistiwa"** — isi/edit lewat web langsung masuk ke
sheet, dan edit langsung di sheet langsung kebaca web (baca-tulis ke sheet yang sama, bukan
database terpisah).

> **Kenapa masih ada tulisan "Project Tracker" di beberapa tempat?** "Bening Hub" adalah nama
> aplikasi webnya. Spreadsheet sumber datanya dan tab **"Project Tracker"** di dalamnya (lihat
> `SHEET_PROJECTS` di `Code.gs`) sengaja **tidak** diganti namanya — itu nama file/tab asli di
> Google Sheets kamu, bukan bagian dari branding aplikasi.

100% gratis: Google Apps Script (backend) + Next.js di Vercel (frontend).

## Fitur yang sudah berjalan

- Login Google, dibatasi ke daftar email tertentu (`ALLOWED_EMAILS`)
- Dashboard, daftar project (cari/filter), detail project (edit inline, tab checklist & komentar),
  daftar dokumen engineering lintas-project, dan log aktivitas
- Checklist 7 dokumen engineering (BOM, P&ID, EWD, GAD, Commissioning Report, Manual Book,
  Handover Report) dengan progress % otomatis
- Komentar per project, log aktivitas otomatis untuk tiap perubahan
- Mode gelap/terang, command palette (`Ctrl+K` / `Cmd+K`), bisa di-"install" sebagai PWA di HP/laptop
- Token API tersembunyi di server (`/api/gas`) — browser tidak pernah melihatnya

---

## Bagian 1 — Deploy backend (Google Apps Script)

1. Buka spreadsheet **Project Tracker_PT Bening Khatulistiwa** di Google Sheets.
2. Klik menu **Extensions > Apps Script**.
3. Hapus kode default di `Code.gs`, lalu copy-paste seluruh isi file `apps-script/Code.gs`
   dari folder ini ke sana.
4. Klik **Save** (ikon disket).
5. Di dropdown daftar fungsi (sebelah tombol Run), pilih **`setup`**, lalu klik **Run**.
   - Google akan minta izin akses ke spreadsheet — klik **Authorize**, pilih akun kamu, klik
     **Advanced > Go to (nama project) (unsafe)** kalau muncul warning (ini normal untuk script
     buatan sendiri), lalu **Allow**.
   - Buka **View > Execution log** — di situ muncul `API_TOKEN BARU`, copy nilainya (dipakai di
     Bagian 2 sebagai `GAS_API_TOKEN`). Kalau dijalankan lagi nanti, token lama tidak berubah.
6. Klik **Deploy > New deployment**.
   - Klik ikon gear di samping "Select type" → pilih **Web app**.
   - **Execute as**: Me (akun kamu)
   - **Who has access**: Anyone
   - Klik **Deploy**.
7. Copy **Web app URL** yang muncul (bentuknya `https://script.google.com/macros/s/.../exec`).
   Ini dipakai sebagai `GAS_API_URL`.
8. *(Opsional)* Project Settings (ikon gear di sidebar kiri) **> Script Properties >** tambah
   `ADMIN_NOTIFICATION_EMAILS` = email yang mau dikirimi notifikasi tiap ada project dihapus,
   pisahkan dengan koma kalau lebih dari satu.

> Catatan: setiap kali kamu **mengubah isi Code.gs**, kamu harus buat deployment baru lagi
> (Deploy > Manage deployments > edit/New deployment) supaya perubahan ke-apply. Simpan token dari
> langkah 5 baik-baik — kalau bocor atau perlu diganti, tinggal jalankan fungsi `rotateApiToken`
> lalu update `GAS_API_TOKEN` di Vercel.

---

## Bagian 2 — Jalankan frontend di komputer kamu (opsional, untuk coba dulu)

Butuh [Node.js](https://nodejs.org) terinstall.

```bash
cd bening-hub-web
npm install
cp .env.local.example .env.local
```

Buka `.env.local`, isi semua variabel (lihat komentar di dalam file untuk penjelasan tiap baris):

| Variabel | Dari mana |
|---|---|
| `GAS_API_URL` | Bagian 1, langkah 7 |
| `GAS_API_TOKEN` | Bagian 1, langkah 5 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Lihat "Setup login Google" di bawah |
| `ALLOWED_EMAILS` | Email yang boleh login, pisah koma |
| `NEXTAUTH_SECRET` | Generate sendiri: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` untuk lokal (boleh dikosongkan, itu default-nya) |

Jalankan:
```bash
npm run dev
```
Buka `http://localhost:3000` — kamu akan diarahkan ke halaman login dulu.

### Setup login Google

1. Buka [Google Cloud Console](https://console.cloud.google.com) → buat project baru (atau pakai
   yang sudah ada) → **APIs & Services > OAuth consent screen** → isi info dasar (nama app,
   email). Kalau statusnya masih **Testing**, tambahkan semua email di `ALLOWED_EMAILS` sebagai
   **Test users** di halaman yang sama, atau publish app-nya.
2. **APIs & Services > Credentials > Create Credentials > OAuth client ID**, tipe **Web
   application**.
3. Di **Authorized redirect URIs**, tambahkan:
   - `http://localhost:3000/api/auth/callback/google` (untuk coba di komputer sendiri)
   - `https://<domain-vercel-kamu>/api/auth/callback/google` (untuk yang online, isi setelah
     Bagian 3 selesai — bisa diedit lagi belakangan)
4. Copy **Client ID** dan **Client secret** yang muncul → itu `GOOGLE_CLIENT_ID` dan
   `GOOGLE_CLIENT_SECRET`.

---

## Bagian 3 — Deploy gratis ke internet (Vercel)

1. Buat akun gratis di [github.com](https://github.com) kalau belum punya.
2. Buat repository baru (misal `bening-hub-web`), lalu push folder ini:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/USERNAME/bening-hub-web.git
   git push -u origin main
   ```
3. Buat akun gratis di [vercel.com](https://vercel.com) — bisa langsung login pakai akun GitHub.
4. Klik **Add New > Project**, pilih repository yang barusan kamu push.
5. Sebelum klik Deploy, buka bagian **Environment Variables**, tambahkan ketujuh variabel yang
   sama seperti di `.env.local` (`GAS_API_URL`, `GAS_API_TOKEN`, `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` — untuk
   `NEXTAUTH_URL` isi dengan domain Vercel yang akan kamu dapat, misal
   `https://bening-hub-web.vercel.app`).
6. Klik **Deploy**. Tunggu 1-2 menit — Vercel akan kasih kamu URL publik gratis yang bisa diakses
   tim kamu.
7. Kembali ke Google Cloud Console, lengkapi **Authorized redirect URI** dengan domain Vercel yang
   asli (langkah 3 di "Setup login Google").
8. Setiap kali kamu `git push` update kode, Vercel otomatis deploy ulang — gratis, tanpa batas.

> Repo kamu yang sudah ada sekarang masih bernama `Project-Tracker-PT-Bening-Khatulistiwa` di
> GitHub/Vercel — itu tidak masalah dan **tidak wajib** diganti. Nama folder/repo di atas cuma
> contoh; me-rename repo GitHub atau project Vercel (kalau mau) dilakukan lewat dashboard
> masing-masing, bukan lewat perubahan kode.

---

## Struktur & cara kerja

- **`apps-script/Code.gs`** — satu-satunya backend. Baca/tulis langsung ke sheet "Project Tracker"
  dan "Engineering Deliverables Checklist", bikin sheet "Activity Log" & "Comments" sendiri kalau
  belum ada, dan mewajibkan token (`API_TOKEN`) di setiap request. File ini adalah salinan persis
  dari yang aktif di spreadsheet kamu — kalau kamu edit langsung di Apps Script editor, tolong
  copy-tempel balik ke sini juga supaya repo tidak ketinggalan.
- **`pages/api/gas.js`** — satu-satunya bagian yang tahu `GAS_API_URL` & `GAS_API_TOKEN`. Semua
  halaman React memanggil `/api/gas`, bukan Apps Script langsung, dan route ini mewajibkan sesi
  login sebelum meneruskan request.
- Progress stage dihitung otomatis dari "Current Stage" memakai tabel bobot yang sama seperti di
  sheet Reference (PO 5% ... Hand Over 100%). Progress checklist dihitung dari rata-rata status
  tiap dokumen (Not Started=0%, Drafting=30%, Under Review=70%, Completed=100%), lalu otomatis
  ditulis balik ke kolom "Engineering Doc Progress (%)". Kalau perhitungan ini beda dari rumus
  asli kamu, tinggal ubah angka di `CHECKLIST_WEIGHTS` dalam `Code.gs`.
- Menambah project baru lewat web otomatis menambah baris di kedua sheet sekaligus (Project
  Tracker + Engineering Deliverables Checklist) dengan Project ID yang sama, supaya keduanya tetap
  nyambung.
- Halaman: **`/`** dashboard ringkasan, **`/projects`** daftar semua project, **`/projects/new`**
  tambah project, **`/projects/[id]`** detail (ringkasan, jadwal, deskripsi teknis, checklist,
  komentar), **`/engineering-docs`** semua dokumen checklist lintas-project, **`/activity`** log
  aktivitas, **`/login`** halaman masuk.

## Kalau nama sheet kamu berubah
Buka `apps-script/Code.gs`, ubah dua baris di paling atas:
```js
const SHEET_PROJECTS = 'Project Tracker';
const SHEET_CHECKLIST = 'Engineering Deliverables Checklist';
```
supaya sesuai nama tab persis di spreadsheet kamu, lalu buat deployment baru.
