-- Stock opname: W&P menghitung barang di gudang (per sesi dan per lokasi), lalu hasilnya diposting ke buku besar
-- transaksi_stok sebagai saldo awal (barang yang belum pernah punya transaksi di lokasi itu) atau penyesuaian
-- (selisih hitungan dengan stok sistem). Akses hanya lewat route server Bening Hub (RLS tanpa policy).

-- Lokasi gudang awal. Lokasi lain bisa ditambah dari halaman Stock Opname.
insert into public.lokasi_gudang (kode, nama, keterangan)
values ('UTAMA', 'Gudang utama', 'Lokasi bawaan')
on conflict (kode) do nothing;

create table public.stock_opname (
  id bigint generated always as identity primary key,
  judul text not null,
  lokasi_kode text not null references public.lokasi_gudang (kode) on update cascade,
  tanggal date not null default current_date,
  -- draf = sedang dihitung; memposting = sedang ditulis ke transaksi_stok (penanda sementara supaya tidak diposting
  -- dua kali); selesai = sudah diposting, tidak bisa diubah lagi
  status text not null default 'draf' check (status in ('draf', 'memposting', 'selesai')),
  catatan text,
  dibuat_oleh text not null,
  dibuat_pada timestamptz not null default now(),
  diposting_oleh text,
  diposting_pada timestamptz
);
create index stock_opname_status_idx on public.stock_opname (status);

create table public.stock_opname_baris (
  id bigint generated always as identity primary key,
  opname_id bigint not null references public.stock_opname (id) on delete cascade,
  barang_kode text not null references public.barang (kode) on update cascade,
  qty_hitung numeric not null check (qty_hitung >= 0),
  stok_sistem numeric,                  -- stok di lokasi itu saat diposting (untuk melihat selisih sesudahnya)
  catatan text,
  dihitung_oleh text not null,
  dihitung_pada timestamptz not null default now(),
  unique (opname_id, barang_kode)
);
create index stock_opname_baris_barang_idx on public.stock_opname_baris (barang_kode);

-- Transaksi hasil opname menunjuk sesinya.
alter table public.transaksi_stok
  add column opname_id bigint references public.stock_opname (id) on delete restrict;
create index transaksi_stok_opname_idx on public.transaksi_stok (opname_id);

-- Stok per barang per lokasi (dipakai untuk menghitung selisih opname di satu lokasi).
create view public.stok_per_lokasi with (security_invoker = on) as
select t.barang_kode, t.lokasi_kode, sum(t.qty) as stok, count(*) as jumlah_transaksi, max(t.tanggal) as transaksi_terakhir
from public.transaksi_stok t
group by t.barang_kode, t.lokasi_kode;

alter table public.stock_opname enable row level security;
alter table public.stock_opname_baris enable row level security;
