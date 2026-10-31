-- Sesudah ada penerimaan barang (1 Nov 2026): pembelian yang sudah disetujui di revisi BOM sebelumnya hanya dihitung
-- sebanyak yang BELUM datang (qty_beli - qty_diterima). Yang sudah datang sudah ada di stok, jadi ikut terhitung lewat
-- stok tersedia; kalau tetap dihitung sebagai "akan datang", barang di gudang tidak disisihkan untuk revisi baru.

create or replace function public.disetujui_revisi_lama(p_bom_id bigint)
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
  select ub.barang_kode, sum(greatest(0, ub.qty_beli - ub.qty_diterima))
  from public.usulan_pembelian u
  join public.usulan_pembelian_baris ub on ub.usulan_id = u.id
  where u.status = 'disetujui' and u.bom_id in (select id from leluhur)
  group by ub.barang_kode;
$$;
