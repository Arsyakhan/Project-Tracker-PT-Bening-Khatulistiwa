-- Status material per project (1 Nov 2026): untuk tiap BOM final project dan tiap kode barangnya, berapa yang
-- dibutuhkan, sudah diserahkan ke teknisi, siap di gudang (disisihkan), sudah dipesan tetapi belum datang (usulan
-- disetujui di BOM ini atau revisi sebelumnya, beserta ETA terdekat), masih menunggu persetujuan (usulan draf/diajukan),
-- dan sisanya yang belum ada jalannya (kurang). Hanya membaca; dipakai panel "BOM & material" di detail project.

create function public.status_material(p_project_id text)
returns table (
  bom_id bigint,
  barang_kode text,
  satuan text,
  butuh numeric,
  diserahkan numeric,
  disisihkan numeric,
  dipesan numeric,
  eta date,
  diusulkan numeric,
  kurang numeric
)
language sql
stable
set search_path = ''
as $$
  with recursive bf as (
    select b.id from public.bom b where b.project_id = p_project_id and b.status = 'final'
  ),
  -- BOM final beserta semua revisi sebelumnya (pembelian yang disetujui di revisi lama tetap dihitung "dipesan")
  rantai as (
    select bf.id as bom_id, bf.id from bf
    union all
    select r.bom_id, b.revisi_dari from rantai r join public.bom b on b.id = r.id where b.revisi_dari is not null
  ),
  k as (
    select bf.id as bom_id, x.kode, x.butuh, x.satuan from bf cross join lateral public.kebutuhan_bom(bf.id) x
  ),
  ds as (
    select bf.id as bom_id, x.kode, x.qty from bf cross join lateral public.diserahkan_bom(bf.id) x
  ),
  ps as (
    select p.bom_id, p.barang_kode as kode, p.qty from public.penyisihan_stok p join bf on bf.id = p.bom_id
  ),
  dp as (
    select r.bom_id, ub.barang_kode as kode,
           sum(ub.qty_beli - ub.qty_diterima) as qty,
           min(u.eta) as eta
    from rantai r
    join public.usulan_pembelian u on u.bom_id = r.id and u.status = 'disetujui'
    join public.usulan_pembelian_baris ub on ub.usulan_id = u.id and ub.qty_beli > ub.qty_diterima
    group by r.bom_id, ub.barang_kode
  ),
  du as (
    select u.bom_id, ub.barang_kode as kode, sum(ub.qty_beli) as qty
    from public.usulan_pembelian u
    join bf on bf.id = u.bom_id
    join public.usulan_pembelian_baris ub on ub.usulan_id = u.id
    where u.status in ('draf', 'diajukan')
    group by u.bom_id, ub.barang_kode
  )
  select k.bom_id, k.kode, k.satuan, k.butuh,
         coalesce(ds.qty, 0), coalesce(ps.qty, 0), coalesce(dp.qty, 0), dp.eta, coalesce(du.qty, 0),
         greatest(0, k.butuh - coalesce(ds.qty, 0) - coalesce(ps.qty, 0) - coalesce(dp.qty, 0) - coalesce(du.qty, 0))
  from k
  left join ds on ds.bom_id = k.bom_id and ds.kode = k.kode
  left join ps on ps.bom_id = k.bom_id and ps.kode = k.kode
  left join dp on dp.bom_id = k.bom_id and dp.kode = k.kode
  left join du on du.bom_id = k.bom_id and du.kode = k.kode
  order by k.bom_id, k.kode;
$$;

revoke all on function public.status_material(text) from public, anon, authenticated;
grant execute on function public.status_material(text) to service_role;
