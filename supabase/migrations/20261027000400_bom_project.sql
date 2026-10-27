-- BOM per project: daftar material yang disusun Engineering untuk satu project (Project ID prj_xxxx dari Google Sheet).
-- Setiap baris menunjuk kode barang di katalog, jadi stok bisa dicek otomatis. Alur status:
--   draf     = sedang disusun, baris bisa diubah
--   final    = sudah diterbitkan; dasar cek stok dan (tahap berikutnya) usulan pembelian; baris terkunci
--   diganti  = sudah ada revisi yang lebih baru yang diterbitkan
-- Revisi dibuat dengan menyalin BOM final menjadi draf baru (revisi + 1); revisi lama baru menjadi 'diganti' saat
-- revisi baru diterbitkan. Akses hanya lewat route server Bening Hub (RLS tanpa policy, fungsi hanya service_role).

create table public.bom (
  id bigint generated always as identity primary key,
  project_id text not null,                 -- prj_xxxx di Bening Hub
  project_nama text not null,               -- nama project saat BOM dibuat (untuk daftar tanpa membaca Sheet)
  judul text not null,
  revisi int not null default 0 check (revisi >= 0),
  revisi_dari bigint references public.bom (id) on delete set null,
  status text not null default 'draf' check (status in ('draf', 'final', 'diganti')),
  sumber text,                              -- asal isi awal, mis. "Salinan BOM lama: CAP, RO 30 MPH, BOM Rev.2.xls"
  catatan text,
  dibuat_oleh text not null,
  dibuat_pada timestamptz not null default now(),
  diubah_oleh text,
  diubah_pada timestamptz not null default now(),
  diterbitkan_oleh text,
  diterbitkan_pada timestamptz
);
create index bom_project_idx on public.bom (project_id);
create index bom_revisi_dari_idx on public.bom (revisi_dari);
create trigger bom_diubah_pada before update on public.bom
  for each row execute function public.set_diubah_pada();

create table public.bom_baris (
  id bigint generated always as identity primary key,
  bom_id bigint not null references public.bom (id) on delete cascade,
  urutan int not null default 0,
  bagian text,                              -- kelompok di BOM, mis. "BOM", "Electrical · Booster Pump", "Fitting list"
  barang_kode text not null references public.barang (kode) on update cascade,
  qty numeric check (qty is null or qty > 0),  -- kosong = belum diisi (BOM belum bisa diterbitkan)
  satuan text not null,
  catatan text,
  diubah_oleh text,
  diubah_pada timestamptz not null default now()
);
create index bom_baris_bom_idx on public.bom_baris (bom_id, urutan);
create index bom_baris_barang_idx on public.bom_baris (barang_kode);

-- Daftar lembar per file BOM lama (untuk memilih lembar yang disalin).
create view public.file_bom_lembar with (security_invoker = on) as
select b.file_id, b.lembar, count(*) as jumlah_baris
from public.baris_bom_arsip b
group by b.file_id, b.lembar;

-- Baris BOM hanya bisa diubah selama BOM-nya draf. Setiap perubahan baris ikut memperbarui waktu ubah BOM-nya.
create function public.cek_bom_draf() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  st text;
  bid bigint := coalesce(new.bom_id, old.bom_id);
begin
  select status into st from public.bom where id = bid for share;
  if st is null then
    return coalesce(new, old);  -- BOM sedang dihapus (cascade)
  end if;
  if st <> 'draf' then
    raise exception 'BOM ini sudah diterbitkan, jadi barisnya tidak bisa diubah. Buat revisi untuk mengubahnya.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    update public.bom set diubah_pada = now() where id = bid;
    return old;
  end if;
  new.diubah_pada := now();
  update public.bom set diubah_oleh = coalesce(new.diubah_oleh, diubah_oleh) where id = bid;
  return new;
end;
$$;

create trigger bom_baris_kunci
  before insert or update or delete on public.bom_baris
  for each row execute function public.cek_bom_draf();

-- Buat BOM baru, kosong atau dengan isi awal yang disalin, dalam satu transaksi.
--   p_jenis 'kosong'  : tanpa baris
--   p_jenis 'arsip'   : salin baris BOM lama hasil impor Dropbox (p_file_id, p_lembar = lembar yang dipilih; null = semua)
--   p_jenis 'bom'     : salin baris BOM lain di Bening Hub (p_bom_id), sebagai revisi 0 untuk project ini
--   p_jenis 'revisi'  : salin BOM final p_bom_id menjadi draf revisi berikutnya (project dan judul ikut BOM asal)
-- Barang yang sudah ditandai "Gabung" disalin dengan kode tujuannya; jumlah 0 atau kosong disalin sebagai kosong.
create function public.buat_bom(
  p_project_id text,
  p_project_nama text,
  p_judul text,
  p_email text,
  p_jenis text,
  p_file_id text default null,
  p_lembar text[] default null,
  p_bom_id bigint default null
) returns bigint
language plpgsql
set search_path = ''
as $$
declare
  new_id bigint;
  src public.bom;
  f public.file_bom;
  v_sumber text;
begin
  if coalesce(trim(p_email), '') = '' then
    raise exception 'Email pembuat wajib diisi.' using errcode = 'P0001';
  end if;
  if p_jenis not in ('kosong', 'arsip', 'bom', 'revisi') then
    raise exception 'Jenis isi awal BOM tidak dikenal.' using errcode = 'P0001';
  end if;

  if p_jenis = 'revisi' then
    select * into src from public.bom where id = p_bom_id for update;
    if not found then
      raise exception 'BOM asal tidak ditemukan.' using errcode = 'P0001';
    end if;
    if src.status <> 'final' then
      raise exception 'Revisi hanya bisa dibuat dari BOM yang sudah diterbitkan.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.bom where revisi_dari = src.id and status = 'draf') then
      raise exception 'Sudah ada draf revisi untuk BOM ini. Lanjutkan draf itu.' using errcode = 'P0001';
    end if;
    insert into public.bom (project_id, project_nama, judul, revisi, revisi_dari, sumber, catatan, dibuat_oleh, diubah_oleh)
    values (src.project_id, src.project_nama, src.judul, src.revisi + 1, src.id, 'Revisi dari Rev. ' || src.revisi, src.catatan, p_email, p_email)
    returning id into new_id;
    insert into public.bom_baris (bom_id, urutan, bagian, barang_kode, qty, satuan, catatan, diubah_oleh)
    select new_id, b.urutan, b.bagian, b.barang_kode, b.qty, b.satuan, b.catatan, p_email
    from public.bom_baris b where b.bom_id = src.id order by b.urutan, b.id;
    return new_id;
  end if;

  if coalesce(trim(p_project_id), '') = '' or coalesce(trim(p_project_nama), '') = '' then
    raise exception 'Pilih project untuk BOM ini.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_judul), '') = '' then
    raise exception 'Judul BOM wajib diisi.' using errcode = 'P0001';
  end if;

  if p_jenis = 'arsip' then
    select * into f from public.file_bom where id = p_file_id;
    if not found then
      raise exception 'File BOM lama tidak ditemukan.' using errcode = 'P0001';
    end if;
    v_sumber := 'Salinan BOM lama: ' || f.nama_file;
  elsif p_jenis = 'bom' then
    select * into src from public.bom where id = p_bom_id;
    if not found then
      raise exception 'BOM yang disalin tidak ditemukan.' using errcode = 'P0001';
    end if;
    v_sumber := 'Salinan BOM ' || src.project_nama || ' (' || src.judul || ', Rev. ' || src.revisi || ')';
  else
    v_sumber := 'Disusun dari awal';
  end if;

  insert into public.bom (project_id, project_nama, judul, sumber, dibuat_oleh, diubah_oleh)
  values (trim(p_project_id), trim(p_project_nama), trim(p_judul), v_sumber, p_email, p_email)
  returning id into new_id;

  if p_jenis = 'arsip' then
    insert into public.bom_baris (bom_id, urutan, bagian, barang_kode, qty, satuan, catatan, diubah_oleh)
    select new_id,
           (row_number() over (order by a.id))::int * 10,
           a.lembar || coalesce(' · ' || nullif(trim(a.bagian), ''), ''),
           coalesce(case when g.status_cek = 'Gabung' then g.gabung_ke end, a.barang_kode),
           case when a.qty > 0 then a.qty end,
           coalesce(nullif(trim(a.satuan), ''), g.satuan),
           nullif(trim(a.keterangan), ''),
           p_email
    from public.baris_bom_arsip a
    join public.barang g on g.kode = a.barang_kode
    where a.file_id = p_file_id
      and (p_lembar is null or a.lembar = any (p_lembar));
  elsif p_jenis = 'bom' then
    insert into public.bom_baris (bom_id, urutan, bagian, barang_kode, qty, satuan, catatan, diubah_oleh)
    select new_id, b.urutan, b.bagian, b.barang_kode, b.qty, b.satuan, b.catatan, p_email
    from public.bom_baris b where b.bom_id = src.id order by b.urutan, b.id;
  end if;

  return new_id;
end;
$$;

-- Terbitkan BOM draf: semua baris wajib punya jumlah. Kalau BOM ini revisi, revisi sebelumnya menjadi 'diganti'.
create function public.terbitkan_bom(p_id bigint, p_email text) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  s public.bom;
  n_baris int;
  n_kosong int;
begin
  select * into s from public.bom where id = p_id for update;
  if not found then
    raise exception 'BOM tidak ditemukan.' using errcode = 'P0001';
  end if;
  if s.status <> 'draf' then
    raise exception 'BOM ini sudah diterbitkan.' using errcode = 'P0001';
  end if;
  select count(*), count(*) filter (where qty is null) into n_baris, n_kosong from public.bom_baris where bom_id = p_id;
  if n_baris = 0 then
    raise exception 'BOM masih kosong. Tambahkan barangnya dulu.' using errcode = 'P0001';
  end if;
  if n_kosong > 0 then
    raise exception '% baris belum punya jumlah. Isi jumlahnya dulu sebelum menerbitkan.', n_kosong using errcode = 'P0001';
  end if;

  update public.bom set status = 'final', diterbitkan_oleh = p_email, diterbitkan_pada = now(), diubah_oleh = p_email
   where id = p_id;
  if s.revisi_dari is not null then
    update public.bom set status = 'diganti' where id = s.revisi_dari and status = 'final';
  end if;
  return jsonb_build_object('id', p_id, 'baris', n_baris, 'revisi', s.revisi);
end;
$$;

alter table public.bom enable row level security;
alter table public.bom_baris enable row level security;

revoke all on function public.buat_bom(text, text, text, text, text, text, text[], bigint) from public, anon, authenticated;
grant execute on function public.buat_bom(text, text, text, text, text, text, text[], bigint) to service_role;
revoke all on function public.terbitkan_bom(bigint, text) from public, anon, authenticated;
grant execute on function public.terbitkan_bom(bigint, text) to service_role;
revoke all on function public.cek_bom_draf() from public, anon, authenticated;
