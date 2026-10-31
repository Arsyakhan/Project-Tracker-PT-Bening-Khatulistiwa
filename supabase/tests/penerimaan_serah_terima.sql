-- Uji penerimaan barang dan serah terima ke teknisi (8 skenario). Semua perubahan SELALU dibatalkan (diakhiri RAISE):
--   "LULUS: ..." = semua lulus; galat lain menyebut skenario yang gagal. Nomor urut yang terpakai tidak kembali.

do $$
declare
  a text; bk text; c text;
  bom0 bigint; bom1 bigint; r jsonb; u bigint; la bigint; lb bigint; st bigint; ditolak boolean; v numeric;
begin
  select kode into a from public.barang where gabung_ke is null order by kode limit 1 offset 0;
  select kode into bk from public.barang where gabung_ke is null order by kode limit 1 offset 1;
  select kode into c from public.barang where gabung_ke is null order by kode limit 1 offset 2;
  insert into public.transaksi_stok (barang_kode, lokasi_kode, jenis, qty, dicatat_oleh) values (a, 'UTAMA', 'saldo_awal', 2, 'uji');
  insert into public.lokasi_gudang (kode, nama) values ('UJI-ST', 'Lokasi uji');

  -- Persiapan: BOM a 5, b 3 -> sisihkan a 2, usulan beli a 3, b 3 -> diajukan.
  bom0 := public.buat_bom('prj_ujiST', 'Uji ST', 'BOM uji', 'uji', 'kosong');
  insert into public.bom_baris (bom_id, urutan, barang_kode, qty, satuan) values (bom0, 10, a, 5, 'pcs'), (bom0, 20, bk, 3, 'pcs');
  perform public.terbitkan_bom(bom0, 'uji');
  r := public.sisihkan_dan_usulkan(bom0, 'uji');
  u := (r->>'usulan_id')::bigint;
  select id into la from public.usulan_pembelian_baris where usulan_id = u and barang_kode = a;
  select id into lb from public.usulan_pembelian_baris where usulan_id = u and barang_kode = bk;
  perform public.ajukan_usulan(u, 'uji');

  -- 1. Terima sebelum disetujui ditolak
  begin perform public.terima_barang(u, 'wp', 'UTAMA', null, null, jsonb_build_array(jsonb_build_object('baris_id', la, 'qty', 1))); ditolak := false;
  exception when others then ditolak := true; end;
  assert ditolak, '1: terima sebelum disetujui harus ditolak';
  perform public.putuskan_usulan(u, 'dir', true, null);

  -- 2. Terima melebihi jumlah beli ditolak; terima normal menambah stok, qty_diterima, dan penyisihan
  begin perform public.terima_barang(u, 'wp', 'UTAMA', null, null, jsonb_build_array(jsonb_build_object('baris_id', la, 'qty', 4))); ditolak := false;
  exception when others then ditolak := true; end;
  assert ditolak, '2: terima melebihi jumlah beli harus ditolak';
  perform public.terima_barang(u, 'wp', 'UTAMA', '2026-11-01', 'SJ-001',
    jsonb_build_array(jsonb_build_object('baris_id', la, 'qty', 2), jsonb_build_object('baris_id', lb, 'qty', 3), jsonb_build_object('baris_id', lb, 'qty', 0)));
  assert (select qty_diterima from public.usulan_pembelian_baris where id = la) = 2, '2: qty_diterima a';
  assert (select stok from public.stok_barang where kode = a) = 4, '2: stok a = 2 awal + 2 diterima';
  assert (select qty from public.penyisihan_stok where bom_id = bom0 and barang_kode = a) = 4, '2: penyisihan a = 2 + 2';
  assert (select qty from public.penyisihan_stok where bom_id = bom0 and barang_kode = bk) = 3, '2: penyisihan b = 3';
  assert (select referensi from public.transaksi_stok where usulan_baris_id = la) = 'SJ-001', '2: referensi surat jalan';

  -- 3. Baris usulan yang disetujui tetap terkunci untuk perubahan selain jumlah diterima
  begin update public.usulan_pembelian_baris set qty_beli = 9 where id = la; ditolak := false;
  exception when others then ditolak := true; end;
  assert ditolak, '3: jumlah beli tidak boleh diubah sesudah disetujui';

  -- 4. Serah terima: barang yang tidak disisihkan, melebihi penyisihan, atau tanpa stok di lokasi itu ditolak
  begin perform public.serahkan_barang('prj_ujiST', 'Uji ST', 'wp', 'Budi', null, 'UTAMA', null,
          jsonb_build_array(jsonb_build_object('bom_id', bom0, 'barang_kode', c, 'qty', 1))); ditolak := false;
  exception when others then ditolak := true; end;
  assert ditolak, '4: barang yang tidak disisihkan harus ditolak';
  begin perform public.serahkan_barang('prj_ujiST', 'Uji ST', 'wp', 'Budi', null, 'UTAMA', null,
          jsonb_build_array(jsonb_build_object('bom_id', bom0, 'barang_kode', a, 'qty', 5))); ditolak := false;
  exception when others then ditolak := true; end;
  assert ditolak, '4: melebihi penyisihan harus ditolak';
  begin perform public.serahkan_barang('prj_ujiST', 'Uji ST', 'wp', 'Budi', null, 'UJI-ST', null,
          jsonb_build_array(jsonb_build_object('bom_id', bom0, 'barang_kode', a, 'qty', 1))); ditolak := false;
  exception when others then ditolak := true; end;
  assert ditolak, '4: lokasi tanpa stok harus ditolak';

  -- 5. Serah terima kosong ditolak dan tidak meninggalkan dokumen
  begin perform public.serahkan_barang('prj_ujiST', 'Uji ST', 'wp', 'Budi', null, 'UTAMA', null,
          jsonb_build_array(jsonb_build_object('bom_id', bom0, 'barang_kode', a, 'qty', 0))); ditolak := false;
  exception when others then ditolak := true; end;
  assert ditolak and not exists (select 1 from public.serah_terima where project_id = 'prj_ujiST'), '5: serah terima kosong';

  -- 6. Serah terima bertahap: a 3, b 1 -> stok dan penyisihan berkurang, transaksi keluar tercatat
  st := public.serahkan_barang('prj_ujiST', 'Uji ST', 'wp', 'Budi', '2026-11-02', 'UTAMA', 'Untuk fabrikasi skid',
          jsonb_build_array(jsonb_build_object('bom_id', bom0, 'barang_kode', a, 'qty', 3), jsonb_build_object('bom_id', bom0, 'barang_kode', bk, 'qty', 1)));
  assert (select stok from public.stok_barang where kode = a) = 1, '6: stok a sisa 1';
  assert (select qty from public.penyisihan_stok where bom_id = bom0 and barang_kode = a) = 1, '6: penyisihan a sisa 1';
  assert (select qty from public.penyisihan_stok where bom_id = bom0 and barang_kode = bk) = 2, '6: penyisihan b sisa 2';
  assert (select count(*) from public.transaksi_stok where serah_terima_id = st and jenis = 'keluar') = 2, '6: dua transaksi keluar';
  assert (select qty from public.diserahkan_bom(bom0) where kode = a) = 3, '6: diserahkan a = 3';

  -- 7. Serah semua sisa a -> baris penyisihan a hilang
  perform public.serahkan_barang('prj_ujiST', 'Uji ST', 'wp', 'Budi', null, 'UTAMA', null,
    jsonb_build_array(jsonb_build_object('bom_id', bom0, 'barang_kode', a, 'qty', 1)));
  assert not exists (select 1 from public.penyisihan_stok where bom_id = bom0 and barang_kode = a), '7: penyisihan a habis';

  -- 8. Revisi BOM sesudah sebagian diserahkan: kebutuhan dikurangi yang sudah diserahkan (a 4 dari 5, b 1 dari 3),
  --    pembelian revisi lama dihitung sebanyak yang belum datang (a 3-2 = 1, b 3-3 = 0).
  --    a: sisa butuh 1, belum datang 1 -> disisihkan 0, tidak beli. b: sisa butuh 2, stok b 2 -> disisihkan 2, tidak beli.
  bom1 := public.buat_bom(null, null, null, 'uji', 'revisi', null, null, bom0);
  perform public.terbitkan_bom(bom1, 'uji');
  r := public.sisihkan_dan_usulkan(bom1, 'uji');
  assert r->>'kurang' = '0' and r->'usulan_id' = 'null'::jsonb, '8: tidak ada pembelian ganda ' || r::text;
  assert (select qty from public.penyisihan_stok where bom_id = bom1 and barang_kode = bk) = 2, '8: b disisihkan 2';
  assert not exists (select 1 from public.penyisihan_stok where bom_id = bom1 and barang_kode = a), '8: a menunggu barang datang';

  raise exception 'LULUS: 8 skenario penerimaan dan serah terima (semua perubahan dibatalkan)';
end $$;
