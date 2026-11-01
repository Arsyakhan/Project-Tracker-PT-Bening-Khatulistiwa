-- Uji status_material (6 skenario). Semua perubahan SELALU dibatalkan (diakhiri RAISE):
--   "LULUS: ..." = semua lulus; galat lain menyebut skenario yang gagal. Nomor urut yang terpakai tidak kembali.

do $$
declare
  a text; bk text;
  bom0 bigint; bom1 bigint; r jsonb; u bigint; la bigint; lb bigint; s record;
begin
  select kode into a from public.barang where gabung_ke is null order by kode limit 1 offset 0;
  select kode into bk from public.barang where gabung_ke is null order by kode limit 1 offset 1;
  insert into public.transaksi_stok (barang_kode, lokasi_kode, jenis, qty, dicatat_oleh) values (a, 'UTAMA', 'saldo_awal', 2, 'uji');

  -- 1. BOM draf belum punya status; sesudah terbit + sisihkan: a butuh 5, disisihkan 2, diusulkan 3; b diusulkan 3.
  bom0 := public.buat_bom('prj_ujiSM', 'Uji SM', 'BOM uji', 'uji', 'kosong');
  insert into public.bom_baris (bom_id, urutan, barang_kode, qty, satuan) values (bom0, 10, a, 5, 'pcs'), (bom0, 20, bk, 3, 'pcs');
  assert not exists (select 1 from public.status_material('prj_ujiSM')), '1: BOM draf tidak punya status';
  perform public.terbitkan_bom(bom0, 'uji');
  r := public.sisihkan_dan_usulkan(bom0, 'uji');
  u := (r->>'usulan_id')::bigint;
  select * into s from public.status_material('prj_ujiSM') where barang_kode = a;
  assert s.butuh = 5 and s.disisihkan = 2 and s.diusulkan = 3 and s.dipesan = 0 and s.kurang = 0, '1: a ' || row_to_json(s)::text;

  -- 2. Baris b dihapus dari usulan -> b kurang 3
  select id into lb from public.usulan_pembelian_baris where usulan_id = u and barang_kode = bk;
  delete from public.usulan_pembelian_baris where id = lb;
  select * into s from public.status_material('prj_ujiSM') where barang_kode = bk;
  assert s.diusulkan = 0 and s.kurang = 3, '2: b ' || row_to_json(s)::text;

  -- 3. Disetujui + dipesan dengan ETA -> a dipesan 3, ETA terbawa
  perform public.ajukan_usulan(u, 'uji');
  perform public.putuskan_usulan(u, 'dir', true, null);
  update public.usulan_pembelian set no_po = 'PO-UJI', eta = '2026-11-10' where id = u;
  select * into s from public.status_material('prj_ujiSM') where barang_kode = a;
  assert s.dipesan = 3 and s.eta = '2026-11-10' and s.diusulkan = 0 and s.kurang = 0, '3: a ' || row_to_json(s)::text;

  -- 4. Terima 2 -> disisihkan 4, dipesan sisa 1
  select id into la from public.usulan_pembelian_baris where usulan_id = u and barang_kode = a;
  perform public.terima_barang(u, 'wp', 'UTAMA', '2026-11-01', 'SJ-UJI', jsonb_build_array(jsonb_build_object('baris_id', la, 'qty', 2)));
  select * into s from public.status_material('prj_ujiSM') where barang_kode = a;
  assert s.disisihkan = 4 and s.dipesan = 1 and s.kurang = 0, '4: a ' || row_to_json(s)::text;

  -- 5. Serahkan 3 -> diserahkan 3, disisihkan 1, dipesan 1
  perform public.serahkan_barang('prj_ujiSM', 'Uji SM', 'wp', 'Budi', '2026-11-02', 'UTAMA', null,
    jsonb_build_array(jsonb_build_object('bom_id', bom0, 'barang_kode', a, 'qty', 3)));
  select * into s from public.status_material('prj_ujiSM') where barang_kode = a;
  assert s.diserahkan = 3 and s.disisihkan = 1 and s.dipesan = 1 and s.kurang = 0, '5: a ' || row_to_json(s)::text;

  -- 6. Revisi diterbitkan: hanya BOM baru yang tampil; yang sudah diserahkan dan dipesan di revisi lama tetap terhitung
  bom1 := public.buat_bom(null, null, null, 'uji', 'revisi', null, null, bom0);
  perform public.terbitkan_bom(bom1, 'uji');
  perform public.sisihkan_dan_usulkan(bom1, 'uji');
  assert not exists (select 1 from public.status_material('prj_ujiSM') where bom_id = bom0), '6: BOM lama tidak tampil';
  select * into s from public.status_material('prj_ujiSM') where bom_id = bom1 and barang_kode = a;
  assert s.diserahkan = 3 and s.dipesan = 1 and s.eta = '2026-11-10' and s.disisihkan = 1 and s.kurang = 0, '6: a ' || row_to_json(s)::text;
  select * into s from public.status_material('prj_ujiSM') where bom_id = bom1 and barang_kode = bk;
  assert s.diusulkan = 3 and s.kurang = 0, '6: b ' || row_to_json(s)::text;

  raise exception 'LULUS: 6 skenario status material (semua perubahan dibatalkan)';
end $$;
