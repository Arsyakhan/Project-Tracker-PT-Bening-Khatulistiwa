-- Foto barang (1 Nov 2026): katalog bergambar seperti marketplace.
-- - sumber 'gudang'  : foto asli yang diambil W&P dari web (kamera HP atau unggah), disimpan di bucket Storage privat
--                      `foto-barang` dalam dua ukuran (path = besar, path_kecil = untuk daftar). Disajikan lewat route
--                      server Bening Hub yang mengecek sesi, jadi tetap hanya untuk pengguna yang login.
-- - sumber 'internet': foto contoh dari internet sesuai spesifikasi barang. Hanya TAUTAN ke gambar (url) dan halaman
--                      sumbernya; gambarnya tidak disalin. Ditampilkan dengan tanda "Foto contoh".
-- Foto utama satu barang = foto gudang terbaru; kalau belum ada, foto internet terbaru (view foto_utama).

create table public.foto_barang (
  id bigint generated always as identity primary key,
  barang_kode text not null references public.barang (kode) on update cascade on delete restrict,
  sumber text not null check (sumber in ('gudang', 'internet')),
  path text,
  path_kecil text,
  url text check (url is null or (url ~ '^https://' and length(url) <= 1000)),
  halaman_sumber text check (halaman_sumber is null or (halaman_sumber ~ '^https://' and length(halaman_sumber) <= 1000)),
  keterangan text check (keterangan is null or length(keterangan) <= 200),
  opname_id bigint references public.stock_opname (id) on delete set null,
  dibuat_oleh text not null,
  dibuat_pada timestamptz not null default now(),
  check (
    (sumber = 'gudang' and path is not null and path_kecil is not null and url is null)
    or (sumber = 'internet' and url is not null and path is null and path_kecil is null)
  )
);

create index foto_barang_kode_idx on public.foto_barang (barang_kode, dibuat_pada desc);
alter table public.foto_barang enable row level security;

create view public.foto_utama with (security_invoker = on) as
  select distinct on (barang_kode) barang_kode, id, sumber, url
  from public.foto_barang
  order by barang_kode, (sumber = 'gudang') desc, dibuat_pada desc, id desc;

-- Bucket privat untuk foto gudang (JPEG hasil kompres di browser; batas 3 MB per berkas).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto-barang', 'foto-barang', false, 3145728, array['image/jpeg'])
on conflict (id) do nothing;
