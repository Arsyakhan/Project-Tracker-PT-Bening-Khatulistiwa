-- Usulan dari revisi BOM tidak mengulang pembelian yang sudah disetujui di revisi sebelumnya (31 Okt 2026).
--
-- Kasus: Rev. 0 butuh 8 membran, stok 0, usulan disetujui beli 8. BOM direvisi menjadi Rev. 1 dan diterbitkan sebelum
-- barangnya datang. Tanpa perubahan ini, usulan dari Rev. 1 meminta 8 membran lagi (pembelian ganda).
-- Sekarang per kode barang: sisihkan = min(kebutuhan - sudah disetujui, stok tersedia), beli = sisanya. Jumlah yang sudah
-- disetujui dijumlahkan dari usulan 'disetujui' di semua revisi sebelumnya (rantai revisi_dari), dan dicatat di baris
-- usulan sebagai qty_disetujui_sebelumnya.

alter table public.usulan_pembelian_baris
  add column qty_disetujui_sebelumnya numeric not null default 0 check (qty_disetujui_sebelumnya >= 0);

-- Jumlah beli yang sudah disetujui per kode barang di usulan revisi-revisi sebelumnya dari BOM ini.
create function public.disetujui_revisi_lama(p_bom_id bigint)
returns table (kode text, qty numeric)
language sql
stable
set search_path = ''
as $$
  with recursive leluhur as (
    select b.revisi_dari as id from public.bom b where b.id = p_bom_id and b.revisi_dari is not null
    union all
    select b.revisi_dari from public.bom b join leluhur l on b.id = l.id where b.revisi_dari is not null
  )
  select ub.barang_kode, sum(ub.qty_beli)
  from public.usulan_pembelian u
  join public.usulan_pembelian_baris ub on ub.usulan_id = u.id
  where u.status = 'disetujui' and u.bom_id in (select id from leluhur)
  group by ub.barang_kode;
$$;

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

  -- Satu penyisihan pada satu waktu, supaya dua BOM tidak menyisihkan stok yang sama.
  perform pg_advisory_xact_lock(hashtext('bening_penyisihan_stok'));

  delete from public.penyisihan_stok where bom_id = p_bom_id;

  -- Yang sudah disetujui dibeli di revisi sebelumnya akan datang untuk project ini, jadi tidak disisihkan dari stok.
  with hitung as (
    select k.kode, k.butuh, coalesce(d.qty, 0) as sudah,
           least(greatest(0, k.butuh - coalesce(d.qty, 0)), greatest(0, coalesce(t.tersedia, 0))) as sisih
    from public.kebutuhan_bom(p_bom_id) k
    left join public.stok_tersedia t on t.kode = k.kode
    left join public.disetujui_revisi_lama(p_bom_id) d on d.kode = k.kode
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
    from public.kebutuhan_bom(p_bom_id) k
    left join public.penyisihan_stok ps on ps.bom_id = p_bom_id and ps.barang_kode = k.kode
    left join public.disetujui_revisi_lama(p_bom_id) d on d.kode = k.kode
    where k.butuh > coalesce(ps.qty, 0) + coalesce(d.qty, 0);
  end if;

  return jsonb_build_object('usulan_id', new_id, 'kode', n_kode, 'disisihkan', n_sisih, 'kurang', n_kurang);
end;
$$;

revoke all on function public.disetujui_revisi_lama(bigint) from public, anon, authenticated;
grant execute on function public.disetujui_revisi_lama(bigint) to service_role;
