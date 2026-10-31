-- Penyisihan stok per BOM dan usulan pembelian dengan persetujuan Direksi (31 Okt 2026).
--
-- Alur:
--   1. BOM diterbitkan (final).
--   2. "Sisihkan stok & usulkan pembelian" (sisihkan_dan_usulkan): stok yang tersedia disisihkan untuk BOM itu, dan
--      kekurangannya menjadi draf usulan pembelian. Stok tersedia = stok fisik semua lokasi dikurangi penyisihan BOM
--      final lain.
--   3. Engineering / W&P menyesuaikan jumlah beli, estimasi harga, dan catatan, lalu mengajukan (ajukan_usulan).
--   4. Direksi menyetujui atau menolak (putuskan_usulan). Siapa yang boleh memutuskan dicek di route server.
-- Penyisihan bukan transaksi stok: stok fisik tetap dihitung dari transaksi_stok. Penyisihan BOM yang sudah 'diganti'
-- revisi baru otomatis tidak dihitung lagi (view stok_tersedia hanya menghitung BOM final).
-- Akses hanya lewat route server Bening Hub (RLS tanpa policy, fungsi hanya service_role).

create table public.penyisihan_stok (
  id bigint generated always as identity primary key,
  bom_id bigint not null references public.bom (id) on delete cascade,
  project_id text not null,                 -- prj_xxxx, salinan dari BOM supaya mudah disaring
  barang_kode text not null references public.barang (kode) on update cascade,
  qty numeric not null check (qty > 0),
  dibuat_oleh text not null,
  dibuat_pada timestamptz not null default now(),
  unique (bom_id, barang_kode)
);
create index penyisihan_stok_barang_idx on public.penyisihan_stok (barang_kode);
create index penyisihan_stok_project_idx on public.penyisihan_stok (project_id);

-- Stok tersedia per barang = stok fisik (semua lokasi) - penyisihan BOM yang masih berlaku (final).
create view public.stok_tersedia with (security_invoker = on) as
select s.kode,
       s.stok,
       coalesce(p.disisihkan, 0) as disisihkan,
       s.stok - coalesce(p.disisihkan, 0) as tersedia
from public.stok_barang s
left join (
  select ps.barang_kode, sum(ps.qty) as disisihkan
  from public.penyisihan_stok ps
  join public.bom b on b.id = ps.bom_id and b.status = 'final'
  group by ps.barang_kode
) p on p.barang_kode = s.kode;

create table public.usulan_pembelian (
  id bigint generated always as identity primary key,   -- nomor tampil: UP-0001
  bom_id bigint not null references public.bom (id),
  project_id text not null,
  project_nama text not null,
  status text not null default 'draf' check (status in ('draf', 'diajukan', 'disetujui', 'ditolak')),
  catatan text,
  dibuat_oleh text not null,
  dibuat_pada timestamptz not null default now(),
  diubah_oleh text,
  diubah_pada timestamptz not null default now(),
  diajukan_oleh text,
  diajukan_pada timestamptz,
  diputuskan_oleh text,
  diputuskan_pada timestamptz,
  catatan_keputusan text                     -- alasan penolakan (wajib) atau catatan persetujuan
);
create index usulan_pembelian_bom_idx on public.usulan_pembelian (bom_id);
create index usulan_pembelian_project_idx on public.usulan_pembelian (project_id);
-- Satu BOM hanya punya satu usulan yang berjalan; usulan yang ditolak boleh dibuat ulang.
create unique index usulan_pembelian_satu_berjalan on public.usulan_pembelian (bom_id)
  where status in ('draf', 'diajukan', 'disetujui');
create trigger usulan_pembelian_diubah_pada before update on public.usulan_pembelian
  for each row execute function public.set_diubah_pada();

create table public.usulan_pembelian_baris (
  id bigint generated always as identity primary key,
  usulan_id bigint not null references public.usulan_pembelian (id) on delete cascade,
  barang_kode text not null references public.barang (kode) on update cascade,
  qty_butuh numeric not null check (qty_butuh > 0),                     -- kebutuhan BOM untuk kode ini
  qty_disisihkan numeric not null default 0 check (qty_disisihkan >= 0), -- stok yang disisihkan saat usulan dibuat
  qty_beli numeric not null check (qty_beli > 0),                       -- jumlah yang diusulkan untuk dibeli
  satuan text not null,
  harga_satuan numeric check (harga_satuan is null or harga_satuan >= 0), -- estimasi, Rupiah
  catatan text,
  diubah_oleh text,
  diubah_pada timestamptz not null default now(),
  unique (usulan_id, barang_kode)
);
create index usulan_pembelian_baris_barang_idx on public.usulan_pembelian_baris (barang_kode);

-- Baris usulan hanya bisa diubah selama usulannya draf. Setiap perubahan baris ikut memperbarui waktu ubah usulan.
create function public.cek_usulan_draf() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  st text;
  uid bigint := coalesce(new.usulan_id, old.usulan_id);
begin
  select status into st from public.usulan_pembelian where id = uid for share;
  if st is null then
    return coalesce(new, old);  -- usulan sedang dihapus (cascade)
  end if;
  if st <> 'draf' then
    raise exception 'Usulan ini sudah diajukan, jadi barisnya tidak bisa diubah lagi.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    update public.usulan_pembelian set diubah_pada = now() where id = uid;
    return old;
  end if;
  new.diubah_pada := now();
  update public.usulan_pembelian set diubah_oleh = coalesce(new.diubah_oleh, diubah_oleh) where id = uid;
  return new;
end;
$$;

create trigger usulan_pembelian_baris_kunci
  before insert or update or delete on public.usulan_pembelian_baris
  for each row execute function public.cek_usulan_draf();

-- Kebutuhan satu BOM per kode barang (semua baris dengan kode yang sama dijumlahkan). Satuan: satuan baris BOM kalau
-- semuanya sama, selain itu satuan katalog.
create function public.kebutuhan_bom(p_bom_id bigint)
returns table (kode text, butuh numeric, satuan text)
language sql
stable
set search_path = ''
as $$
  select bb.barang_kode,
         sum(bb.qty),
         case when count(distinct bb.satuan) = 1 then min(bb.satuan) else min(g.satuan) end
  from public.bom_baris bb
  join public.barang g on g.kode = bb.barang_kode
  where bb.bom_id = p_bom_id and bb.qty > 0
  group by bb.barang_kode;
$$;

-- Sisihkan stok tersedia untuk BOM final, lalu buat draf usulan pembelian untuk kekurangannya (dalam satu transaksi).
-- Dijalankan ulang (mis. sesudah usulan sebelumnya ditolak): penyisihan BOM ini dihitung ulang dari stok saat itu.
-- Kalau tidak ada yang kurang, hanya penyisihan yang dicatat dan usulan_id = null.
create function public.sisihkan_dan_usulkan(p_bom_id bigint, p_email text) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  b public.bom;
  berjalan bigint;
  new_id bigint;
  n_kode int;
  n_sisih int;
  n_kurang int;
begin
  if coalesce(trim(p_email), '') = '' then
    raise exception 'Email pengusul wajib diisi.' using errcode = 'P0001';
  end if;
  select * into b from public.bom where id = p_bom_id for update;
  if not found then
    raise exception 'BOM tidak ditemukan.' using errcode = 'P0001';
  end if;
  if b.status <> 'final' then
    raise exception 'Stok hanya bisa disisihkan untuk BOM yang sudah diterbitkan dan masih berlaku.' using errcode = 'P0001';
  end if;
  select id into berjalan from public.usulan_pembelian
   where bom_id = p_bom_id and status in ('draf', 'diajukan', 'disetujui') limit 1;
  if berjalan is not null then
    raise exception 'BOM ini sudah punya usulan pembelian UP-%. Buka usulan itu.', lpad(berjalan::text, 4, '0') using errcode = 'P0001';
  end if;

  -- Satu penyisihan pada satu waktu, supaya dua BOM tidak menyisihkan stok yang sama.
  perform pg_advisory_xact_lock(hashtext('bening_penyisihan_stok'));

  delete from public.penyisihan_stok where bom_id = p_bom_id;

  with hitung as (
    select k.kode, k.butuh, least(k.butuh, greatest(0, coalesce(t.tersedia, 0))) as sisih
    from public.kebutuhan_bom(p_bom_id) k
    left join public.stok_tersedia t on t.kode = k.kode
  ), ins as (
    insert into public.penyisihan_stok (bom_id, project_id, barang_kode, qty, dibuat_oleh)
    select p_bom_id, b.project_id, h.kode, h.sisih, p_email from hitung h where h.sisih > 0
    returning 1
  )
  select count(*), (select count(*) from ins), count(*) filter (where h.butuh > h.sisih)
    into n_kode, n_sisih, n_kurang
  from hitung h;

  if n_kurang > 0 then
    insert into public.usulan_pembelian (bom_id, project_id, project_nama, dibuat_oleh, diubah_oleh)
    values (p_bom_id, b.project_id, b.project_nama, p_email, p_email)
    returning id into new_id;
    insert into public.usulan_pembelian_baris (usulan_id, barang_kode, qty_butuh, qty_disisihkan, qty_beli, satuan, diubah_oleh)
    select new_id, k.kode, k.butuh, coalesce(ps.qty, 0), k.butuh - coalesce(ps.qty, 0), k.satuan, p_email
    from public.kebutuhan_bom(p_bom_id) k
    left join public.penyisihan_stok ps on ps.bom_id = p_bom_id and ps.barang_kode = k.kode
    where k.butuh > coalesce(ps.qty, 0);
  end if;

  return jsonb_build_object('usulan_id', new_id, 'kode', n_kode, 'disisihkan', n_sisih, 'kurang', n_kurang);
end;
$$;

-- Draf -> diajukan. Ditolak kalau usulan kosong atau BOM-nya sudah diganti revisi baru.
create function public.ajukan_usulan(p_id bigint, p_email text) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  u public.usulan_pembelian;
  n int;
  st text;
begin
  select * into u from public.usulan_pembelian where id = p_id for update;
  if not found then
    raise exception 'Usulan tidak ditemukan.' using errcode = 'P0001';
  end if;
  if u.status <> 'draf' then
    raise exception 'Usulan ini sudah diajukan.' using errcode = 'P0001';
  end if;
  select count(*) into n from public.usulan_pembelian_baris where usulan_id = p_id;
  if n = 0 then
    raise exception 'Usulan masih kosong. Tidak ada barang yang diajukan.' using errcode = 'P0001';
  end if;
  select status into st from public.bom where id = u.bom_id;
  if st is distinct from 'final' then
    raise exception 'BOM usulan ini sudah diganti revisi baru. Hapus draf ini, lalu buat usulan dari revisi terbaru.' using errcode = 'P0001';
  end if;
  update public.usulan_pembelian
     set status = 'diajukan', diajukan_oleh = p_email, diajukan_pada = now(), diubah_oleh = p_email
   where id = p_id;
  return jsonb_build_object('id', p_id, 'baris', n);
end;
$$;

-- Diajukan -> disetujui / ditolak. Penolakan wajib beralasan. Persetujuan ditolak kalau BOM-nya sudah diganti.
create function public.putuskan_usulan(p_id bigint, p_email text, p_setuju boolean, p_catatan text) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  u public.usulan_pembelian;
  st text;
  v_catatan text := nullif(trim(coalesce(p_catatan, '')), '');
begin
  select * into u from public.usulan_pembelian where id = p_id for update;
  if not found then
    raise exception 'Usulan tidak ditemukan.' using errcode = 'P0001';
  end if;
  if u.status in ('disetujui', 'ditolak') then
    raise exception 'Usulan ini sudah diputuskan.' using errcode = 'P0001';
  end if;
  if u.status <> 'diajukan' then
    raise exception 'Usulan ini belum diajukan.' using errcode = 'P0001';
  end if;
  if not p_setuju and v_catatan is null then
    raise exception 'Tulis alasan penolakan.' using errcode = 'P0001';
  end if;
  if p_setuju then
    select status into st from public.bom where id = u.bom_id;
    if st is distinct from 'final' then
      raise exception 'BOM usulan ini sudah diganti revisi baru, jadi usulan tidak bisa disetujui. Tolak usulan ini dan minta usulan dari revisi terbaru.' using errcode = 'P0001';
    end if;
  end if;
  update public.usulan_pembelian
     set status = case when p_setuju then 'disetujui' else 'ditolak' end,
         diputuskan_oleh = p_email, diputuskan_pada = now(), catatan_keputusan = v_catatan, diubah_oleh = p_email
   where id = p_id;
  return jsonb_build_object('id', p_id, 'status', case when p_setuju then 'disetujui' else 'ditolak' end);
end;
$$;

alter table public.penyisihan_stok enable row level security;
alter table public.usulan_pembelian enable row level security;
alter table public.usulan_pembelian_baris enable row level security;

revoke all on function public.kebutuhan_bom(bigint) from public, anon, authenticated;
grant execute on function public.kebutuhan_bom(bigint) to service_role;
revoke all on function public.sisihkan_dan_usulkan(bigint, text) from public, anon, authenticated;
grant execute on function public.sisihkan_dan_usulkan(bigint, text) to service_role;
revoke all on function public.ajukan_usulan(bigint, text) from public, anon, authenticated;
grant execute on function public.ajukan_usulan(bigint, text) to service_role;
revoke all on function public.putuskan_usulan(bigint, text, boolean, text) from public, anon, authenticated;
grant execute on function public.putuskan_usulan(bigint, text, boolean, text) to service_role;
revoke all on function public.cek_usulan_draf() from public, anon, authenticated;
