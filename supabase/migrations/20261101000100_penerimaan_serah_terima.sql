-- Alur gudang sesudah usulan disetujui (1 Nov 2026): pemesanan oleh W&P -> barang diterima di gudang -> serah terima
-- ke teknisi per project (bisa bertahap). Tanggung jawab barang ada di W&P sampai diserahkan.
--
-- Pemesanan   : kolom no_po / tanggal_pesan / eta / dipesan_oleh / dipesan_pada di usulan_pembelian (status tetap
--               'disetujui'; diisi lewat route server).
-- Penerimaan  : terima_barang -> transaksi 'masuk' per baris usulan (usulan_baris_id), qty_diterima bertambah, dan
--               barangnya langsung disisihkan untuk BOM usulan itu (dibeli untuk project itu).
-- Serah terima: serahkan_barang -> dokumen serah_terima (ST-0001) + transaksi 'keluar' (serah_terima_id, bom_id),
--               penyisihan BOM berkurang. Hanya barang yang disisihkan untuk project itu dan ada stoknya di lokasi itu.
-- sisihkan_dan_usulkan kini mengurangi kebutuhan dengan yang sudah diserahkan (diserahkan_bom), supaya menghitung ulang
-- penyisihan sesudah serah terima tidak menyisihkan atau mengusulkan beli barang yang sudah diserahkan.

alter table public.usulan_pembelian
  add column no_po text,
  add column tanggal_pesan date,
  add column eta date,
  add column dipesan_oleh text,
  add column dipesan_pada timestamptz;

alter table public.usulan_pembelian_baris
  add column qty_diterima numeric not null default 0 check (qty_diterima >= 0);

create table public.serah_terima (
  id bigint generated always as identity primary key,   -- nomor tampil: ST-0001
  project_id text not null,
  project_nama text not null,
  penerima text not null,                                -- teknisi yang menerima barang
  tanggal date not null default current_date,
  lokasi_kode text not null references public.lokasi_gudang (kode) on update cascade,
  catatan text,
  dibuat_oleh text not null,
  dibuat_pada timestamptz not null default now()
);
create index serah_terima_project_idx on public.serah_terima (project_id);
alter table public.serah_terima enable row level security;

alter table public.transaksi_stok
  add column usulan_baris_id bigint references public.usulan_pembelian_baris (id) on delete restrict,
  add column serah_terima_id bigint references public.serah_terima (id) on delete restrict,
  add column bom_id bigint references public.bom (id) on delete restrict;
create index transaksi_stok_usulan_baris_idx on public.transaksi_stok (usulan_baris_id);
create index transaksi_stok_serah_terima_idx on public.transaksi_stok (serah_terima_id);
create index transaksi_stok_bom_idx on public.transaksi_stok (bom_id);

-- Baris usulan terkunci sesudah diajukan, KECUALI qty_diterima pada usulan yang disetujui (penerimaan barang).
create or replace function public.cek_usulan_draf() returns trigger
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
    if tg_op = 'UPDATE' and st = 'disetujui'
       and (new.usulan_id, new.barang_kode, new.qty_butuh, new.qty_disisihkan, new.qty_disetujui_sebelumnya, new.qty_beli,
            new.satuan, new.harga_satuan, new.catatan)
       is not distinct from
           (old.usulan_id, old.barang_kode, old.qty_butuh, old.qty_disisihkan, old.qty_disetujui_sebelumnya, old.qty_beli,
            old.satuan, old.harga_satuan, old.catatan) then
      return new;  -- hanya jumlah diterima yang berubah
    end if;
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

-- Jumlah yang sudah diserahkan ke teknisi per kode barang untuk BOM ini dan revisi-revisi sebelumnya.
create function public.diserahkan_bom(p_bom_id bigint)
returns table (kode text, qty numeric)
language sql
stable
set search_path = ''
as $$
  with recursive rantai as (
    select b.id, b.revisi_dari from public.bom b where b.id = p_bom_id
    union all
    select b.id, b.revisi_dari from public.bom b join rantai r on b.id = r.revisi_dari
  )
  select t.barang_kode, -sum(t.qty)
  from public.transaksi_stok t
  where t.jenis = 'keluar' and t.serah_terima_id is not null and t.bom_id in (select id from rantai)
  group by t.barang_kode;
$$;

-- Penerimaan barang dari usulan yang disetujui. p_items: [{ "baris_id": 12, "qty": 3 }, ...] (qty 0 dilewati).
create function public.terima_barang(p_usulan_id bigint, p_email text, p_lokasi text, p_tanggal date, p_referensi text, p_items jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  u public.usulan_pembelian;
  l public.usulan_pembelian_baris;
  it jsonb;
  q numeric;
  n int := 0;
  nomor text;
  v_ref text := nullif(trim(coalesce(p_referensi, '')), '');
begin
  if coalesce(trim(p_email), '') = '' then
    raise exception 'Email pencatat wajib diisi.' using errcode = 'P0001';
  end if;
  select * into u from public.usulan_pembelian where id = p_usulan_id for update;
  if not found then
    raise exception 'Usulan tidak ditemukan.' using errcode = 'P0001';
  end if;
  if u.status <> 'disetujui' then
    raise exception 'Barang hanya bisa dicatat diterima untuk usulan yang sudah disetujui.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.lokasi_gudang where kode = p_lokasi and aktif) then
    raise exception 'Pilih lokasi gudang tempat barang disimpan.' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Isi jumlah barang yang diterima.' using errcode = 'P0001';
  end if;
  nomor := 'UP-' || lpad(u.id::text, 4, '0');

  for it in select value from jsonb_array_elements(p_items) loop
    q := nullif(it->>'qty', '')::numeric;
    if q is null or q = 0 then
      continue;
    end if;
    if q < 0 then
      raise exception 'Jumlah diterima tidak boleh negatif.' using errcode = 'P0001';
    end if;
    select * into l from public.usulan_pembelian_baris
     where id = (it->>'baris_id')::bigint and usulan_id = p_usulan_id for update;
    if not found then
      raise exception 'Baris usulan tidak ditemukan. Muat ulang halaman.' using errcode = 'P0001';
    end if;
    if l.qty_diterima + q > l.qty_beli then
      raise exception '% diterima % melebihi jumlah beli (% dibeli, % sudah diterima).',
        l.barang_kode, q, l.qty_beli, l.qty_diterima using errcode = 'P0001';
    end if;
    update public.usulan_pembelian_baris set qty_diterima = qty_diterima + q where id = l.id;
    insert into public.transaksi_stok (barang_kode, lokasi_kode, jenis, qty, project_id, referensi, catatan, tanggal, dicatat_oleh, usulan_baris_id)
    values (l.barang_kode, p_lokasi, 'masuk', q, u.project_id, coalesce(v_ref, nomor), 'Penerimaan ' || nomor,
            coalesce(p_tanggal, current_date), p_email, l.id);
    -- Dibeli untuk project ini: langsung disisihkan untuk BOM usulan.
    insert into public.penyisihan_stok (bom_id, project_id, barang_kode, qty, dibuat_oleh)
    values (u.bom_id, u.project_id, l.barang_kode, q, p_email)
    on conflict (bom_id, barang_kode) do update set qty = public.penyisihan_stok.qty + excluded.qty;
    n := n + 1;
  end loop;

  if n = 0 then
    raise exception 'Isi jumlah barang yang diterima.' using errcode = 'P0001';
  end if;
  return jsonb_build_object('id', p_usulan_id, 'baris', n);
end;
$$;

-- Serah terima barang yang disisihkan untuk satu project ke teknisi. p_items: [{ "bom_id": 5, "barang_kode": "MBR-0012", "qty": 2 }].
create function public.serahkan_barang(p_project_id text, p_project_nama text, p_email text, p_penerima text, p_tanggal date,
                                       p_lokasi text, p_catatan text, p_items jsonb)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  new_id bigint;
  ps public.penyisihan_stok;
  it jsonb;
  q numeric;
  stok numeric;
  n int := 0;
begin
  if coalesce(trim(p_email), '') = '' then
    raise exception 'Email pencatat wajib diisi.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_project_id), '') = '' or coalesce(trim(p_project_nama), '') = '' then
    raise exception 'Pilih project.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_penerima), '') = '' then
    raise exception 'Tulis nama teknisi yang menerima barang.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.lokasi_gudang where kode = p_lokasi and aktif) then
    raise exception 'Pilih lokasi gudang asal barang.' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Isi jumlah barang yang diserahkan.' using errcode = 'P0001';
  end if;

  -- Satu perubahan penyisihan pada satu waktu (sama dengan sisihkan_dan_usulkan).
  perform pg_advisory_xact_lock(hashtext('bening_penyisihan_stok'));

  insert into public.serah_terima (project_id, project_nama, penerima, tanggal, lokasi_kode, catatan, dibuat_oleh)
  values (trim(p_project_id), trim(p_project_nama), trim(p_penerima), coalesce(p_tanggal, current_date), p_lokasi,
          nullif(trim(coalesce(p_catatan, '')), ''), p_email)
  returning id into new_id;

  for it in select value from jsonb_array_elements(p_items) loop
    q := nullif(it->>'qty', '')::numeric;
    if q is null or q = 0 then
      continue;
    end if;
    if q < 0 then
      raise exception 'Jumlah diserahkan tidak boleh negatif.' using errcode = 'P0001';
    end if;
    select * into ps from public.penyisihan_stok p
     where p.bom_id = (it->>'bom_id')::bigint and p.barang_kode = it->>'barang_kode' and p.project_id = trim(p_project_id)
     for update;
    if not found then
      raise exception '% tidak disisihkan untuk project ini.', it->>'barang_kode' using errcode = 'P0001';
    end if;
    if q > ps.qty then
      raise exception '% diserahkan % melebihi yang disisihkan untuk project ini (%).', ps.barang_kode, q, ps.qty using errcode = 'P0001';
    end if;
    select coalesce(sum(t.qty), 0) into stok from public.transaksi_stok t where t.barang_kode = ps.barang_kode and t.lokasi_kode = p_lokasi;
    if q > stok then
      raise exception 'Stok % di lokasi ini hanya %.', ps.barang_kode, stok using errcode = 'P0001';
    end if;
    insert into public.transaksi_stok (barang_kode, lokasi_kode, jenis, qty, project_id, referensi, catatan, tanggal, dicatat_oleh, serah_terima_id, bom_id)
    values (ps.barang_kode, p_lokasi, 'keluar', -q, trim(p_project_id), 'ST-' || lpad(new_id::text, 4, '0'),
            'Diserahkan ke ' || trim(p_penerima), coalesce(p_tanggal, current_date), p_email, new_id, ps.bom_id);
    if ps.qty - q > 0 then
      update public.penyisihan_stok set qty = qty - q where id = ps.id;
    else
      delete from public.penyisihan_stok where id = ps.id;
    end if;
    n := n + 1;
  end loop;

  if n = 0 then
    raise exception 'Isi jumlah barang yang diserahkan.' using errcode = 'P0001';
  end if;
  return new_id;
end;
$$;

-- Kebutuhan efektif = kebutuhan BOM - yang sudah diserahkan ke teknisi (BOM ini dan revisi sebelumnya).
create or replace function public.sisihkan_dan_usulkan(p_bom_id bigint, p_email text) returns jsonb
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

  perform pg_advisory_xact_lock(hashtext('bening_penyisihan_stok'));

  delete from public.penyisihan_stok where bom_id = p_bom_id;

  with k0 as (
    select k.kode, greatest(0, k.butuh - coalesce(s.qty, 0)) as butuh, k.satuan
    from public.kebutuhan_bom(p_bom_id) k
    left join public.diserahkan_bom(p_bom_id) s on s.kode = k.kode
  ), hitung as (
    select k.kode, k.butuh, coalesce(d.qty, 0) as sudah,
           least(greatest(0, k.butuh - coalesce(d.qty, 0)), greatest(0, coalesce(t.tersedia, 0))) as sisih
    from k0 k
    left join public.stok_tersedia t on t.kode = k.kode
    left join public.disetujui_revisi_lama(p_bom_id) d on d.kode = k.kode
    where k.butuh > 0
  ), ins as (
    insert into public.penyisihan_stok (bom_id, project_id, barang_kode, qty, dibuat_oleh)
    select p_bom_id, b.project_id, h.kode, h.sisih, p_email from hitung h where h.sisih > 0
    returning 1
  )
  select count(*), (select count(*) from ins), count(*) filter (where h.butuh > h.sisih + h.sudah)
    into n_kode, n_sisih, n_kurang
  from hitung h;

  if n_kurang > 0 then
    insert into public.usulan_pembelian (bom_id, project_id, project_nama, dibuat_oleh, diubah_oleh)
    values (p_bom_id, b.project_id, b.project_nama, p_email, p_email)
    returning id into new_id;
    insert into public.usulan_pembelian_baris
      (usulan_id, barang_kode, qty_butuh, qty_disisihkan, qty_disetujui_sebelumnya, qty_beli, satuan, diubah_oleh)
    select new_id, k.kode, k.butuh, coalesce(ps.qty, 0), coalesce(d.qty, 0),
           k.butuh - coalesce(ps.qty, 0) - coalesce(d.qty, 0), k.satuan, p_email
    from (
      select k.kode, greatest(0, k.butuh - coalesce(s.qty, 0)) as butuh, k.satuan
      from public.kebutuhan_bom(p_bom_id) k
      left join public.diserahkan_bom(p_bom_id) s on s.kode = k.kode
    ) k
    left join public.penyisihan_stok ps on ps.bom_id = p_bom_id and ps.barang_kode = k.kode
    left join public.disetujui_revisi_lama(p_bom_id) d on d.kode = k.kode
    where k.butuh > coalesce(ps.qty, 0) + coalesce(d.qty, 0);
  end if;

  return jsonb_build_object('usulan_id', new_id, 'kode', n_kode, 'disisihkan', n_sisih, 'kurang', n_kurang);
end;
$$;

revoke all on function public.diserahkan_bom(bigint) from public, anon, authenticated;
grant execute on function public.diserahkan_bom(bigint) to service_role;
revoke all on function public.terima_barang(bigint, text, text, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.terima_barang(bigint, text, text, date, text, jsonb) to service_role;
revoke all on function public.serahkan_barang(text, text, text, text, date, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.serahkan_barang(text, text, text, text, date, text, text, jsonb) to service_role;
