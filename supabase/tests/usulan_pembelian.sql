-- Uji penyisihan stok dan usulan pembelian. Jalankan lewat SQL editor Supabase atau MCP execute_sql.
-- Semua perubahan SELALU dibatalkan: blok ini diakhiri RAISE, jadi tidak ada data uji yang tersisa.
--   Hasil lulus  : galat "LULUS: ..." (memang galat, supaya transaksinya dibatalkan)
--   Hasil gagal  : galat "assertion failed" / "GAGAL ..." dengan nama skenario yang gagal
-- Catatan: nomor urut (id BOM dan usulan) yang terpakai tidak ikut kembali; di database asli nomor UP bisa terlewat.

do $$
declare
  a text; bk text; c text;
  bom1 bigint; bom2 bigint; bom1r bigint; bom2r bigint;
  r jsonb; u1 bigint; u2 bigint; u2b bigint;
  v numeric; n int; ditolak boolean; msg text;
begin
  select kode into a from public.barang where gabung_ke is null order by kode limit 1 offset 0;
  select kode into bk from public.barang where gabung_ke is null order by kode limit 1 offset 1;
  select kode into c from public.barang where gabung_ke is null order by kode limit 1 offset 2;
  -- Stok uji: A = 10, B = 3, C = 0 (di atas stok yang sudah ada; diuji dengan selisih terhadap keadaan awal)
  insert into public.transaksi_stok (barang_kode, lokasi_kode, jenis, qty, dicatat_oleh) values
    (a, 'UTAMA', 'saldo_awal', 10, 'uji'), (bk, 'UTAMA', 'saldo_awal', 3, 'uji');
  assert (select tersedia from public.stok_tersedia where kode = a) = 10
     and (select tersedia from public.stok_tersedia where kode = c) = 0,
    'awal: database harus tanpa stok dan penyisihan untuk tiga barang pertama';

  -- 1. BOM1: A 4+2 (dua baris), B 5, C 1 -> sisihkan A 6, B 3; beli B 2, C 1
  bom1 := public.buat_bom('prj_ujiA', 'Uji A', 'BOM uji', 'uji', 'kosong');
  insert into public.bom_baris (bom_id, urutan, barang_kode, qty, satuan) values
    (bom1, 10, a, 4, 'pcs'), (bom1, 20, a, 2, 'pcs'), (bom1, 30, bk, 5, 'pcs'), (bom1, 40, c, 1, 'set');
  perform public.terbitkan_bom(bom1, 'uji');
  r := public.sisihkan_dan_usulkan(bom1, 'uji');
  assert r->>'kode' = '3' and r->>'disisihkan' = '2' and r->>'kurang' = '2', '1: ringkasan ' || r::text;
  u1 := (r->>'usulan_id')::bigint;
  assert (select qty from public.penyisihan_stok where bom_id = bom1 and barang_kode = a) = 6, '1: sisih A';
  assert (select qty from public.penyisihan_stok where bom_id = bom1 and barang_kode = bk) = 3, '1: sisih B';
  assert (select qty_beli from public.usulan_pembelian_baris where usulan_id = u1 and barang_kode = bk) = 2, '1: beli B';
  assert (select qty_beli || satuan from public.usulan_pembelian_baris where usulan_id = u1 and barang_kode = c) = '1set', '1: beli C';
  assert (select tersedia from public.stok_tersedia where kode = a) = 4, '1: tersedia A sesudah disisihkan';

  begin perform public.sisihkan_dan_usulkan(bom1, 'uji'); ditolak := false;
  exception when others then ditolak := true; end;
  assert ditolak, '1: usulan kedua untuk BOM yang sama harus ditolak';

  -- 2. BOM2 hanya mendapat sisa stok: A butuh 5, tersedia 4
  bom2 := public.buat_bom('prj_ujiB', 'Uji B', 'BOM uji 2', 'uji', 'kosong');
  insert into public.bom_baris (bom_id, urutan, barang_kode, qty, satuan) values (bom2, 10, a, 5, 'pcs'), (bom2, 20, bk, 1, 'pcs');
  perform public.terbitkan_bom(bom2, 'uji');
  r := public.sisihkan_dan_usulkan(bom2, 'uji');
  u2 := (r->>'usulan_id')::bigint;
  assert (select qty_disisihkan || '/' || qty_beli from public.usulan_pembelian_baris where usulan_id = u2 and barang_kode = a) = '4/1', '2: A';
  assert (select qty_disisihkan || '/' || qty_beli from public.usulan_pembelian_baris where usulan_id = u2 and barang_kode = bk) = '0/1', '2: B';

  -- 3. Ajukan, kunci baris, tolak wajib beralasan
  update public.usulan_pembelian_baris set qty_beli = 3, harga_satuan = 150000 where usulan_id = u2 and barang_kode = a;
  perform public.ajukan_usulan(u2, 'uji');
  begin update public.usulan_pembelian_baris set qty_beli = 9 where usulan_id = u2; ditolak := false;
  exception when others then ditolak := true; end;
  assert ditolak, '3: baris harus terkunci sesudah diajukan';
  begin perform public.putuskan_usulan(u2, 'dir', false, '  '); ditolak := false;
  exception when others then ditolak := true; end;
  assert ditolak, '3: tolak tanpa alasan harus ditolak';
  perform public.putuskan_usulan(u2, 'dir', false, 'Pakai stok project lain');
  assert (select status from public.usulan_pembelian where id = u2) = 'ditolak', '3: status ditolak';

  -- 4. Usulan ulang sesudah ditolak menghitung ulang penyisihan
  r := public.sisihkan_dan_usulkan(bom2, 'uji');
  u2b := (r->>'usulan_id')::bigint;
  assert u2b is not null and (select count(*) from public.penyisihan_stok where bom_id = bom2) = 1, '4: ' || r::text;

  -- 5. Setujui hanya dari diajukan, sekali saja
  begin perform public.putuskan_usulan(u1, 'dir', true, null); ditolak := false;
  exception when others then ditolak := true; end;
  assert ditolak, '5: draf tidak boleh disetujui';
  perform public.ajukan_usulan(u1, 'uji');
  perform public.putuskan_usulan(u1, 'dir', true, null);
  begin perform public.putuskan_usulan(u1, 'dir', false, 'x'); ditolak := false;
  exception when others then ditolak := true; end;
  assert ditolak, '5: usulan yang sudah diputuskan tidak boleh diputus ulang';

  -- 6. Penyisihan BOM yang diganti revisi baru tidak dihitung lagi
  bom1r := public.buat_bom(null, null, null, 'uji', 'revisi', null, null, bom1);
  perform public.terbitkan_bom(bom1r, 'uji');
  assert (select disisihkan from public.stok_tersedia where kode = a) = 4, '6: hanya penyisihan BOM2 (4) yang tersisa';

  -- 7. Usulan dan penyisihan dari BOM yang diganti ditolak
  bom2r := public.buat_bom(null, null, null, 'uji', 'revisi', null, null, bom2);
  perform public.terbitkan_bom(bom2r, 'uji');
  begin perform public.ajukan_usulan(u2b, 'uji'); ditolak := false;
  exception when others then ditolak := true; end;
  assert ditolak, '7: ajukan dari BOM yang diganti harus ditolak';
  begin perform public.sisihkan_dan_usulkan(bom2, 'uji'); ditolak := false;
  exception when others then ditolak := true; end;
  assert ditolak, '7: sisihkan BOM yang diganti harus ditolak';

  -- 8. Usulan kosong tidak bisa diajukan
  delete from public.usulan_pembelian_baris where usulan_id = u2b;
  begin perform public.ajukan_usulan(u2b, 'uji'); ditolak := false;
  exception when others then ditolak := true; end;
  assert ditolak, '8: usulan kosong tidak boleh diajukan';
  delete from public.usulan_pembelian where id = u2b;

  -- 9. Revisi tidak mengulang pembelian yang sudah disetujui: Rev. 1 BOM1 butuh sama (A 6, B 5, C 1), usulan Rev. 0
  --    sudah disetujui beli B 2 dan C 1. Stok A 10 (tidak ada BOM final lain), B 3.
  --    -> sisihkan A 6, B 3 (5 - 2 disetujui = 3), C 0; tidak ada yang dibeli lagi.
  r := public.sisihkan_dan_usulkan(bom1r, 'uji');
  assert r->>'kurang' = '0' and r->'usulan_id' = 'null'::jsonb, '9: tidak boleh ada pembelian ganda ' || r::text;
  assert (select qty from public.penyisihan_stok where bom_id = bom1r and barang_kode = bk) = 3, '9: sisih B';
  assert not exists (select 1 from public.penyisihan_stok where bom_id = bom1r and barang_kode = c), '9: C menunggu pembelian, tidak disisihkan';
  --    Kebutuhan C naik menjadi 4 di Rev. 2 -> beli 3 saja (1 sudah disetujui di Rev. 0)
  bom1r := public.buat_bom(null, null, null, 'uji', 'revisi', null, null, bom1r);
  update public.bom_baris set qty = 4 where bom_id = bom1r and barang_kode = c;
  perform public.terbitkan_bom(bom1r, 'uji');
  r := public.sisihkan_dan_usulkan(bom1r, 'uji');
  assert (select qty_disetujui_sebelumnya || '/' || qty_beli from public.usulan_pembelian_baris
           where usulan_id = (r->>'usulan_id')::bigint and barang_kode = c) = '1/3', '9: Rev. 2 C ' || r::text;

  raise exception 'LULUS: 9 skenario usulan pembelian (semua perubahan dibatalkan)';
end $$;
