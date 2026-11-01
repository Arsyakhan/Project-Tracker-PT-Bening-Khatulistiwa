-- Uji foto_barang dan foto_utama (4 skenario). Semua perubahan SELALU dibatalkan (diakhiri RAISE):
--   "LULUS: ..." = semua lulus; galat lain menyebut skenario yang gagal. Nomor urut yang terpakai tidak kembali.

do $$
declare
  a text; ditolak boolean; f1 bigint; f2 bigint; f3 bigint;
begin
  select kode into a from public.barang where gabung_ke is null order by kode limit 1;

  -- 1. Isian yang tidak cocok dengan sumbernya ditolak
  begin insert into public.foto_barang (barang_kode, sumber, url, dibuat_oleh) values (a, 'gudang', 'https://x/y.jpg', 'uji'); ditolak := false;
  exception when check_violation then ditolak := true; end;
  assert ditolak, '1: foto gudang tanpa path harus ditolak';
  begin insert into public.foto_barang (barang_kode, sumber, url, dibuat_oleh) values (a, 'internet', 'http://x/y.jpg', 'uji'); ditolak := false;
  exception when check_violation then ditolak := true; end;
  assert ditolak, '1: tautan tanpa https harus ditolak';

  -- 2. Hanya foto internet -> foto internet terbaru jadi foto utama
  insert into public.foto_barang (barang_kode, sumber, url, dibuat_oleh, dibuat_pada) values (a, 'internet', 'https://x/lama.jpg', 'uji', now() - interval '2 day') returning id into f1;
  insert into public.foto_barang (barang_kode, sumber, url, dibuat_oleh, dibuat_pada) values (a, 'internet', 'https://x/baru.jpg', 'uji', now() - interval '1 day') returning id into f2;
  assert (select id from public.foto_utama where barang_kode = a) = f2, '2: foto internet terbaru';

  -- 3. Foto gudang (walau lebih lama dari foto internet) mengalahkan foto internet
  insert into public.foto_barang (barang_kode, sumber, path, path_kecil, dibuat_oleh, dibuat_pada) values (a, 'gudang', a || '/u.jpg', a || '/u-kecil.jpg', 'uji', now() - interval '3 day') returning id into f3;
  assert (select id from public.foto_utama where barang_kode = a) = f3, '3: foto gudang menang';

  -- 4. Barang yang punya foto tidak bisa dihapus dari katalog (foto tidak boleh yatim)
  begin delete from public.barang where kode = a; ditolak := false;
  exception when foreign_key_violation then ditolak := true; end;
  assert ditolak, '4: barang berfoto tidak boleh terhapus';

  raise exception 'LULUS: 4 skenario foto barang (semua perubahan dibatalkan)';
end $$;
