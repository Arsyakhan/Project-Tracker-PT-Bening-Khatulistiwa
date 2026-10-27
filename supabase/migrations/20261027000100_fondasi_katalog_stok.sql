-- Salinan migrasi yang sudah dijalankan di project Supabase "bening-hub" (27 Okt 2026).
-- Fondasi modul gudang Bening Hub: katalog barang, arsip BOM dari Dropbox, stok (buku besar transaksi), pengguna per divisi.
-- Semua tabel memakai RLS tanpa policy: hanya server Bening Hub (kunci rahasia) yang boleh membaca/menulis.

create table public.kategori_barang (
  kode text primary key,
  nama text not null,
  urutan int not null
);

insert into public.kategori_barang (kode, nama, urutan) values
  ('EQP', 'Unit & sistem lengkap', 1),
  ('PMP', 'Pompa & blower', 2),
  ('MBR', 'Membran', 3),
  ('PVS', 'Pressure vessel', 4),
  ('FLT', 'Filter, housing & cartridge', 5),
  ('VLV', 'Valve', 6),
  ('INS', 'Instrumen', 7),
  ('FTG', 'Pipa & fitting', 8),
  ('TNK', 'Tangki', 9),
  ('MDA', 'Media & bahan kimia', 10),
  ('ELK', 'Kelistrikan & panel', 11),
  ('HRD', 'Hardware, struktur & habis pakai', 12),
  ('LAN', 'Lainnya', 13);

create table public.barang (
  id bigint generated always as identity primary key,
  kode text not null unique,
  kategori_kode text not null references public.kategori_barang (kode),
  nama text not null,
  spesifikasi text,
  ukuran text,
  material text,
  merek text,
  model text,
  satuan text not null default 'pcs',
  foto_url text,                       -- tautan foto di Google Drive
  stok_minimum numeric check (stok_minimum is null or stok_minimum >= 0),
  status_cek text check (status_cek in ('OK', 'Gabung', 'Ubah', 'Hapus')),
  gabung_ke text references public.barang (kode) on update cascade,
  catatan text,
  perlu_dicek text[] not null default '{}',
  dipakai_project int not null default 0,   -- jumlah project di BOM lama yang memakai barang ini
  daftar_project text[] not null default '{}',
  sumber jsonb not null default '{}',       -- jumlah kemunculan per jenis sumber
  nama_lain text[] not null default '{}',   -- ejaan lain di BOM
  aktif boolean not null default true,
  dibuat_pada timestamptz not null default now(),
  diubah_pada timestamptz not null default now(),
  diubah_oleh text
);
create index barang_kategori_idx on public.barang (kategori_kode);
create index barang_gabung_ke_idx on public.barang (gabung_ke);

create function public.set_diubah_pada() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.diubah_pada := now();
  return new;
end;
$$;
create trigger barang_diubah_pada before update on public.barang
  for each row execute function public.set_diubah_pada();

create table public.file_bom (
  id text primary key,                  -- F001, F002, ...
  jenis_sumber text not null,
  project_label text,
  project_id text,                      -- prj_xxxx di Bening Hub, bila sudah dicocokkan
  nama_file text not null,
  revisi text,
  tanggal_ubah date,
  revisi_terakhir boolean not null default false,
  lembar_dibaca text,
  jumlah_baris int not null default 0,
  lokasi text not null unique,          -- path di Dropbox
  diimpor_pada timestamptz not null default now()
);

create table public.baris_bom_arsip (
  id text primary key,                  -- L00001, ...
  file_id text not null references public.file_bom (id) on delete cascade,
  project_label text,
  revisi text,
  lembar text,
  baris_excel int,
  bagian text,
  nama text not null,
  lokasi_pasang text,
  spesifikasi text,
  ukuran text,
  material text,
  merek text,
  model text,
  qty numeric,
  satuan text,
  keterangan text,
  barang_kode text references public.barang (kode) on update cascade
);
create index baris_bom_arsip_file_idx on public.baris_bom_arsip (file_id);
create index baris_bom_arsip_barang_idx on public.baris_bom_arsip (barang_kode);

create table public.lokasi_gudang (
  kode text primary key,
  nama text not null,
  keterangan text,
  aktif boolean not null default true
);

-- Stok dihitung dari transaksi (buku besar), tidak disimpan sebagai angka yang bisa basi.
create table public.transaksi_stok (
  id bigint generated always as identity primary key,
  barang_kode text not null references public.barang (kode) on update cascade,
  lokasi_kode text references public.lokasi_gudang (kode) on update cascade,
  jenis text not null check (jenis in ('saldo_awal', 'masuk', 'keluar', 'kembali', 'penyesuaian')),
  qty numeric not null check (qty <> 0),
  project_id text,                      -- prj_xxxx bila terkait project
  referensi text,                       -- no. PO, surat jalan, serah terima, opname
  catatan text,
  tanggal date not null default current_date,
  dicatat_oleh text not null,
  dicatat_pada timestamptz not null default now(),
  constraint transaksi_stok_arah check (
    (jenis in ('saldo_awal', 'masuk', 'kembali') and qty > 0)
    or (jenis = 'keluar' and qty < 0)
    or jenis = 'penyesuaian'
  )
);
create index transaksi_stok_barang_idx on public.transaksi_stok (barang_kode);
create index transaksi_stok_lokasi_idx on public.transaksi_stok (lokasi_kode);
create index transaksi_stok_project_idx on public.transaksi_stok (project_id);

create view public.stok_barang with (security_invoker = on) as
select b.kode, b.kategori_kode, b.nama, b.ukuran, b.material, b.model, b.satuan, b.stok_minimum,
       coalesce(sum(t.qty), 0) as stok,
       max(t.tanggal) as transaksi_terakhir
from public.barang b
left join public.transaksi_stok t on t.barang_kode = b.kode
group by b.kode, b.kategori_kode, b.nama, b.ukuran, b.material, b.model, b.satuan, b.stok_minimum;

-- Pengguna per divisi (dipakai untuk hak akses modul gudang; login tetap lewat Google di Bening Hub).
create table public.pengguna (
  email text primary key,
  nama text,
  divisi text not null check (divisi in ('PM', 'Engineering', 'Direksi', 'Marketing & Direksi', 'Warehouse & Purchasing', 'Technician')),
  aktif boolean not null default true,
  dibuat_pada timestamptz not null default now()
);

alter table public.kategori_barang enable row level security;
alter table public.barang enable row level security;
alter table public.file_bom enable row level security;
alter table public.baris_bom_arsip enable row level security;
alter table public.lokasi_gudang enable row level security;
alter table public.transaksi_stok enable row level security;
alter table public.pengguna enable row level security;
