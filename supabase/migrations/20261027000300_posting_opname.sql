-- Posting stock opname dalam satu transaksi database (atomik), dan kunci hitungan sesudah diposting.
--
-- posting_opname(p_id, p_email):
--   - mengunci baris sesi (FOR UPDATE), menolak kalau sesi bukan draf atau belum ada barang yang dihitung;
--   - per barang yang dihitung, membandingkan dengan stok sistem DI LOKASI SESI:
--       belum pernah ada transaksi di lokasi itu -> 'saldo_awal' sebesar hitungan (hitungan 0 dilewati);
--       sudah ada transaksi -> 'penyesuaian' sebesar selisih (hitungan - stok), kalau selisihnya bukan 0;
--   - menandai sesi selesai. Barang yang tidak dihitung tidak berubah stoknya.
-- Selisih per barang sesudah posting dibaca dari transaksi_stok (opname_id), jadi tidak disimpan di baris hitungan.
-- Hanya service_role (route server Bening Hub) yang boleh memanggilnya.

alter table public.stock_opname_baris drop column stok_sistem;

alter table public.stock_opname drop constraint stock_opname_status_check;
alter table public.stock_opname add constraint stock_opname_status_check check (status in ('draf', 'selesai'));

-- Baris hitungan hanya bisa ditambah, diubah, atau dihapus selama sesinya masih draf.
create function public.cek_opname_draf() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  st text;
begin
  select status into st from public.stock_opname where id = coalesce(new.opname_id, old.opname_id) for share;
  if st is null or st = 'draf' then
    return coalesce(new, old);  -- st null = sesi sedang dihapus (cascade)
  end if;
  raise exception 'Sesi opname ini sudah diposting, jadi hitungannya tidak bisa diubah lagi.' using errcode = 'P0001';
end;
$$;

create trigger stock_opname_baris_kunci
  before insert or update or delete on public.stock_opname_baris
  for each row execute function public.cek_opname_draf();

create function public.posting_opname(p_id bigint, p_email text) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  s public.stock_opname;
  n_baris int;
  n_awal int;
  n_sesuai int;
begin
  if coalesce(trim(p_email), '') = '' then
    raise exception 'Email pemosting wajib diisi.' using errcode = 'P0001';
  end if;

  select * into s from public.stock_opname where id = p_id for update;
  if not found then
    raise exception 'Sesi opname tidak ditemukan.' using errcode = 'P0001';
  end if;
  if s.status <> 'draf' then
    raise exception 'Sesi opname ini sudah diposting.' using errcode = 'P0001';
  end if;

  select count(*) into n_baris from public.stock_opname_baris where opname_id = p_id;
  if n_baris = 0 then
    raise exception 'Belum ada barang yang dihitung di sesi ini.' using errcode = 'P0001';
  end if;

  with stok as (
    select t.barang_kode, sum(t.qty) as stok, count(*) as n
    from public.transaksi_stok t
    where t.lokasi_kode = s.lokasi_kode
    group by t.barang_kode
  ),
  hit as (
    select b.barang_kode, b.qty_hitung, b.catatan, coalesce(st.stok, 0) as stok, coalesce(st.n, 0) as n
    from public.stock_opname_baris b
    left join stok st on st.barang_kode = b.barang_kode
    where b.opname_id = p_id
  )
  insert into public.transaksi_stok (barang_kode, lokasi_kode, jenis, qty, referensi, catatan, tanggal, dicatat_oleh, opname_id)
  select h.barang_kode,
         s.lokasi_kode,
         case when h.n = 0 then 'saldo_awal' else 'penyesuaian' end,
         case when h.n = 0 then h.qty_hitung else h.qty_hitung - h.stok end,
         'Opname #' || p_id,
         h.catatan,
         s.tanggal,
         p_email,
         p_id
  from hit h
  where (h.n = 0 and h.qty_hitung > 0) or (h.n > 0 and h.qty_hitung <> h.stok);

  select count(*) filter (where jenis = 'saldo_awal'), count(*) filter (where jenis = 'penyesuaian')
    into n_awal, n_sesuai
  from public.transaksi_stok where opname_id = p_id;

  update public.stock_opname
     set status = 'selesai', diposting_oleh = p_email, diposting_pada = now()
   where id = p_id;

  return jsonb_build_object(
    'dihitung', n_baris,
    'saldo_awal', n_awal,
    'penyesuaian', n_sesuai,
    'tanpa_perubahan', n_baris - n_awal - n_sesuai
  );
end;
$$;

revoke all on function public.posting_opname(bigint, text) from public, anon, authenticated;
grant execute on function public.posting_opname(bigint, text) to service_role;
revoke all on function public.cek_opname_draf() from public, anon, authenticated;
