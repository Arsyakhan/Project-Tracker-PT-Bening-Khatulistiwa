-- Katalog barang dikelompokkan menurut BENTUK FISIK barang, bukan fungsinya (31 Okt 2026, permintaan PM).
--
-- Untuk stok yang penting: barangnya apa dan jenisnya apa. Fungsi (CIP, chemical, raw water, booster, RO feed, ...)
-- baru ditentukan di BOM project. Dulu tangki dan pompa dinamai menurut fungsinya, sehingga barang fisik yang sama
-- (mis. tangki PE 2000 L) tercatat dengan banyak kode: "Chemical cleaning tank", "Raw water tank", "CIP Tank", ...
--
-- 1. Tabel jenis_barang (daftar jenis per kategori) + kolom barang.jenis (kunci asing gabungan kategori + jenis).
-- 2. Cadangan seluruh tabel barang sebelum perubahan: barang_cadangan_20261031 (untuk dikembalikan bila perlu).
-- 3. Barang yang salah kategori dipindah (mis. overload/CB di Pompa -> Kelistrikan, "PE tank" di Instrumen -> Tangki).
--    Kode barang TIDAK diubah (awalan kode lama tetap), supaya BOM, berkas Excel, dan label yang ada tetap cocok.
-- 4. Jenis diisi otomatis dari nama, spesifikasi, material, dan model.
-- 5. Tangki dan pompa diberi nama menurut bentuk fisiknya ("Tangki PE", "Pompa vertikal multistage"); kapasitas tangki
--    dipindah dari spesifikasi ke ukuran, material/merek diisi bila kosong. Nama lama disimpan di nama_lain (ikut dicari).
-- 6. Tangki/pompa yang sesudah itu identik (jenis, ukuran, material, merek, model sama) ditandai Gabung ke kode yang
--    paling sering dipakai (mekanisme Gabung yang sudah ada; bisa dibatalkan di halaman Katalog Barang).
-- 7. Barang yang jenisnya belum pasti diberi penanda "jenis perlu dicek"; tangki tanpa kapasitas "kapasitas belum diisi".

create table public.barang_cadangan_20261031 as select * from public.barang;
alter table public.barang_cadangan_20261031 enable row level security;

create table public.jenis_barang (
  kategori_kode text not null references public.kategori_barang (kode) on update cascade,
  nama text not null,
  urutan int not null,
  primary key (kategori_kode, nama)
);
alter table public.jenis_barang enable row level security;

insert into public.jenis_barang (kategori_kode, nama, urutan)
select k, j, ord from (values
  ('EQP', array['Unit RO','Unit UF','Unit filter & softener','UV & ozon','Sistem dosing & CIP','Unit lain']),
  ('PMP', array['Pompa vertikal multistage','Pompa horizontal multistage','Pompa sentrifugal','Pompa jet','Pompa vane','Pompa submersible','Pompa dosing','Blower & kompresor','Pompa air (tipe belum jelas)','Aksesori pompa']),
  ('MBR', array['Membran RO','Membran UF','Membran NF','Aksesori membran']),
  ('PVS', array['Pressure vessel','Aksesori pressure vessel']),
  ('FLT', array['Housing filter','Cartridge filter','Bag filter','Strainer','Aksesori filter']),
  ('VLV', array['Ball valve','Butterfly valve','Check valve','Gate valve','Globe / needle valve','Solenoid valve','Valve otomatis','Control / multiport valve','Float valve','Valve lain']),
  ('INS', array['Pressure gauge','Pressure switch / transmitter','Flowmeter','Level switch / sensor','pH / ORP','Konduktivitas / TDS','Turbidity','Instrumen lain']),
  ('FTG', array['Pipa & selang','Elbow','Tee','Reducer','Socket / coupling','Union','Flange','Nipple','Cap / plug','Konektor & adaptor','Gasket & seal','Klem & support','Fitting lain']),
  ('TNK', array['Tangki PE','Tangki PP','Tangki FRP','Tangki SS','Tangki lain','Aksesori tangki']),
  ('MDA', array['Media filter','Resin','Bahan kimia']),
  ('ELK', array['Kabel','Terminal & aksesori kabel','MCB, MCCB & proteksi','Kontaktor & overload','Relay & timer','PLC, HMI & power supply','Inverter & soft starter','Saklar, tombol & lampu','Box panel & aksesori','Motor listrik','Kelistrikan lain']),
  ('HRD', array['Baut, mur & angkur','Besi profil & plat','Cat & thinner','Habis pakai','Skid & rangka','Hardware lain']),
  ('LAN', array['Lainnya'])
) v(k, arr), unnest(arr) with ordinality u(j, ord);

alter table public.barang add column jenis text;
alter table public.barang add constraint barang_jenis_fkey
  foreign key (kategori_kode, jenis) references public.jenis_barang (kategori_kode, nama) on update cascade;
create index barang_jenis_idx on public.barang (kategori_kode, jenis);

-- 3. Pindah kategori
update public.barang set kategori_kode = case
    when kategori_kode in ('PMP','INS','LAN','HRD') and lower(nama) ~ '^(overload|thermal overload|cb\M|mcb|mccb|contactor|kontaktor|magnetic contactor|stop ?kontak)' then 'ELK'
    when kategori_kode = 'ELK' and lower(nama) !~ '^(cable|kabel)' and lower(nama) ~ '(conductiv|\mtds\M|\mph (meter|sensor|controller)|turbid|flow ?meter|pressure (switch|gauge|transmitter)|level (switch|sensor))' then 'INS'
    when kategori_kode in ('INS','FLT','LAN') and lower(nama) ~ '(\mtank\M|tangki)' and lower(nama) !~ '(level|tank head)' then 'TNK'
    when kategori_kode = 'LAN' and lower(nama) ~ '(hypochlorite|naocl|antiscalant|\msoda\M|caustic|naoh|\mhcl\M|\mpac\M|polymer|polimer|smbs|biocide|citric|garam|\msalt\M)' then 'MDA'
    when kategori_kode = 'LAN' and lower(nama) ~ '(\mdop\M|nipple|neeple|elbow|socket|\mtee\M|reducer|union|flange)' then 'FTG'
    when kategori_kode = 'LAN' and lower(nama) ~ '(gurinda|gerinda|amplas|kuas|\mlem\M|seal ?tape|kawat)' then 'HRD'
    else kategori_kode end,
  diubah_oleh = 'penataan katalog 31 Okt 2026';

-- 4. Jenis
with x as (
  select kode, kategori_kode k, lower(nama) n, coalesce(lower(material), '') m,
         lower(concat_ws(' ', nama, spesifikasi, material, model, merek)) t
  from public.barang
)
update public.barang b set jenis = case x.k
  when 'TNK' then case
    when x.n ~ 'tank head' or (x.n ~ '(distributor|nozzle|head|lateral)' and x.n !~ '(\mtank\M|tangki)') then 'Aksesori tangki'
    when x.m ~ '^\s*frp' or x.t ~ '(frp|vessel)' or x.n ~ '^(acf|mmf|softener|filter) tank' then 'Tangki FRP'
    when x.m ~ '^\s*(ss|stainless)' then 'Tangki SS'
    when x.m ~ '^\s*pp' then 'Tangki PP'
    when x.m ~ '^\s*(pe|hdpe|ldpe)' then 'Tangki PE'
    when x.t ~ '(\mss\M|stainless)' then 'Tangki SS'
    when x.t ~ '\mpp\M' then 'Tangki PP'
    when x.t ~ '(\mpe\M|polyeth|penguin|ldpe|hdpe)' then 'Tangki PE'
    else 'Tangki lain' end
  when 'PMP' then case
    when x.t ~ '(dosing|metering|\d\s*lph|\makl\M|\mdde\M|seko|anti ?scalant pump|chemical pump)' then 'Pompa dosing'
    when x.t ~ '(blower|air pump|compressor|kompresor|\mrb-?\d)' then 'Blower & kompresor'
    when x.t ~ 'submersib' then 'Pompa submersible'
    when x.t ~ '\m(cdmf?|cdlf?|crn?|cri|crne)\s*-?\s*\d' then 'Pompa vertikal multistage'
    when x.t ~ '\m(chlf?|cmb?|chm)\s*-?\s*\d' then 'Pompa horizontal multistage'
    when x.t ~ '(procon|rotary vane|\mvane\M)' then 'Pompa vane'
    when x.t ~ '(\mjet\M|\mjcr|self.?prim)' then 'Pompa jet'
    when x.t ~ '(centrifugal|sentrifugal|end.?suction|\mcp\s*\d|\mns\M)' then 'Pompa sentrifugal'
    when x.t ~ '(pump|pompa)' then 'Pompa air (tipe belum jelas)'
    else 'Aksesori pompa' end
  when 'VLV' then case
    when x.t ~ '(motori|actuat|pneumat|electric valve)' then 'Valve otomatis'
    when x.t ~ 'solenoid' then 'Solenoid valve'
    when x.t ~ '(control valve|multiport|fleck|autotrol|runxin|clack|aquamati)' then 'Control / multiport valve'
    when x.t ~ '(butterfly|buttefly)' then 'Butterfly valve'
    when x.t ~ '(check|non.?return|\mcv\M|foot valve|swing)' then 'Check valve'
    when x.t ~ '\mgate\M' then 'Gate valve'
    when x.t ~ '(globe|needle)' then 'Globe / needle valve'
    when x.t ~ 'float' then 'Float valve'
    when x.t ~ '(ball|\mbv\M|drain)' then 'Ball valve'
    else 'Valve lain' end
  when 'INS' then case
    when x.t ~ '(gauge|manometer)' then 'Pressure gauge'
    when x.t ~ 'pressure (switch|transmitter|sensor)' then 'Pressure switch / transmitter'
    when x.t ~ '(flow ?meter|flow ?transmitter|rotameter|flow sensor|flow indicator)' then 'Flowmeter'
    when x.t ~ '(level|float switch|ballfloat)' then 'Level switch / sensor'
    when x.t ~ '(\mph\M|\morp\M)' then 'pH / ORP'
    when x.t ~ '(conductiv|\mtds\M|\mec\M|resistiv)' then 'Konduktivitas / TDS'
    when x.t ~ 'turbid' then 'Turbidity'
    else 'Instrumen lain' end
  when 'FLT' then case
    when x.t ~ 'housing' then 'Housing filter'
    when x.t ~ '(cartridge|catridge|micron|element|elemen|melt ?blown|\mspun\M)' then 'Cartridge filter'
    when x.t ~ 'bag filter' then 'Bag filter'
    when x.t ~ 'strainer' then 'Strainer'
    else 'Aksesori filter' end
  when 'PVS' then case
    when x.n ~ '(pressure vessel|ropv|\mpv\M)' and x.n !~ '(head|end ?cap|adaptor|adapter|coupling|clamp|o.?ring|\mport\M|retainer|spacer)' then 'Pressure vessel'
    else 'Aksesori pressure vessel' end
  when 'MBR' then case
    when x.t ~ '(adapter|adaptor|interconnector|o.?ring|brine seal|coupling)' then 'Aksesori membran'
    when x.t ~ '(\muf\M|ultra|hollow)' then 'Membran UF'
    when x.t ~ '(\mnf\M|nano)' then 'Membran NF'
    else 'Membran RO' end
  when 'MDA' then case
    when x.t ~ '(resin|cation|anion|mixed bed)' then 'Resin'
    when x.t ~ '(sand|pasir|carbon|karbon|birm|mangan|anthra|gravel|kerikil|zeolit|silica|media|filox|greensand|calcite|garnet)' then 'Media filter'
    else 'Bahan kimia' end
  when 'FTG' then case
    when x.t ~ '(gasket|o.?ring|\mseal\M|packing)' then 'Gasket & seal'
    when x.t ~ '(elbow|knee|\mbend\M|\mel\M)' then 'Elbow'
    when x.t ~ '(\mtee\M|\mtea\M|\mtie\M)' then 'Tee'
    when x.t ~ '(reducer|reducing|bushing)' then 'Reducer'
    when x.t ~ 'flange' then 'Flange'
    when x.t ~ 'union' then 'Union'
    when x.t ~ '(socket|soket|coupling|\msok\M|faucet)' then 'Socket / coupling'
    when x.t ~ '(nipple|neeple|nepel)' then 'Nipple'
    when x.t ~ '(\mcap\M|\mdop\M|plug|end ?cap)' then 'Cap / plug'
    when x.t ~ '(jaco|connector|konektor|adaptor|adapter|\mmale\M|female|quick|v.?lock)' then 'Konektor & adaptor'
    when x.t ~ '(clamp|support|hanger|klem)' then 'Klem & support'
    when x.t ~ '(pipe|pipa|tube|hose|selang)' then 'Pipa & selang'
    else 'Fitting lain' end
  when 'ELK' then case
    when x.t ~ '(\mlug\M|skun|gland|cable ?ties|kabel ?ties|sleeve|marker|ferrule|end ?plate|isolasi|terminal)' then 'Terminal & aksesori kabel'
    when x.t ~ '(panel|\mbox\M|enclosure|\mduct\M|din rail|\mrail\M|\mfan\M|exhaust|kipas)' then 'Box panel & aksesori'
    when x.t ~ '(cable|kabel|\mnyy\M|\mnyaf\M|\mnym\M|\mmm2\M)' then 'Kabel'
    when x.t ~ '(mccb|\mmcb\M|elcb|rccb|breaker|\mcb\M|fuse|sekring|surge|arrester|stop ?kontak)' then 'MCB, MCCB & proteksi'
    when x.t ~ '(contactor|kontaktor|overload|\mtor\M|thermal)' then 'Kontaktor & overload'
    when x.t ~ '(relay|relai|timer|\mtdr\M|phase fail)' then 'Relay & timer'
    when x.t ~ '(\mplc\M|\mhmi\M|module|modul|\mcpu\M|power supply|\mpsu\M)' then 'PLC, HMI & power supply'
    when x.t ~ '(inverter|\mvfd\M|\mvsd\M|soft ?starter)' then 'Inverter & soft starter'
    when x.t ~ '(push button|selector|switch|saklar|pilot lamp|lampu|indicator|buzzer|sirine|emergency)' then 'Saklar, tombol & lampu'
    when x.t ~ '\mmotor\M' then 'Motor listrik'
    else 'Kelistrikan lain' end
  when 'HRD' then case
    when x.t ~ '(bolt|baut|\mmur\M|\mnut\M|washer|dyna|angkur|anchor|screw|sekrup)' then 'Baut, mur & angkur'
    when x.t ~ '(siku|\munp\M|\mcnp\M|hollow|plat|plate|strip|besi|beam|\mwf\M|channel)' then 'Besi profil & plat'
    when x.t ~ '(\mcat\M|paint|thinner|epoxy|primer|ftalit|zinc)' then 'Cat & thinner'
    when x.t ~ '(\mlem\M|glue|seal|tape|kawat las|elektroda|gurinda|gerinda|amplas|kuas|majun)' then 'Habis pakai'
    when x.t ~ '(skid|frame|rangka)' then 'Skid & rangka'
    else 'Hardware lain' end
  when 'EQP' then case
    when x.t ~ '(\mro\M|reverse)' then 'Unit RO'
    when x.t ~ '(\muf\M|ultra)' then 'Unit UF'
    when x.t ~ '(\muv\M|ozon)' then 'UV & ozon'
    when x.t ~ '(dosing|\mcip\M)' then 'Sistem dosing & CIP'
    when x.t ~ '(filter|softener)' then 'Unit filter & softener'
    else 'Unit lain' end
  else 'Lainnya' end
from x where b.kode = x.kode;

-- 5. Nama tangki dan pompa menurut bentuk fisiknya; nama lama disimpan di nama_lain.
with x as (
  select kode, jenis, nama, ukuran, material, merek,
    -- teks untuk mencari kapasitas; "SS 316L" dibuang supaya tidak terbaca 316 liter
    regexp_replace(lower(concat_ws(' ', nama, spesifikasi, ukuran)), 'ss\s*-?\s*3\d\d\s*l?', ' ', 'g') s,
    lower(concat_ws(' ', nama, spesifikasi, material, model, merek)) t,
    lower(nama) n
  from public.barang
  where (kategori_kode = 'TNK' and jenis in ('Tangki PE','Tangki PP','Tangki FRP','Tangki SS','Tangki lain'))
     or (kategori_kode = 'PMP' and jenis <> 'Aksesori pompa')
), y as (
  select *,
    substring(s from '(\d+(?:[.,]\d+)?)\s*(?:l|lt|ltr|ltrs|liter|liters|litre)\M') cap_l,
    substring(s from '(\d+(?:[.,]\d+)?)\s*m3(?!\s*/)') cap_m3,
    coalesce(substring(s from '\mh\s*(\d{2,3})'), substring(s from '(\d{2,3})"?\s*\(h\)')) tinggi,
    substring(n from 'frp tank\s*(\d{2})\d{2}\M') d4, substring(n from 'frp tank\s*\d{2}(\d{2})\M') h4
  from x
), z as (
  select kode, jenis, nama,
    case
      when jenis like 'Tangki %' and jenis <> 'Tangki lain' then jenis
      when jenis = 'Pompa air (tipe belum jelas)' then 'Pompa air'
      when jenis = 'Blower & kompresor' then case when t ~ '(compressor|kompresor)' then 'Kompresor' else 'Blower' end
      when jenis like 'Pompa %' then jenis
      else nama end as nama_baru,
    case
      when jenis not like 'Tangki %' then ukuran
      when jenis = 'Tangki FRP' and ukuran ~ 'x' then ukuran
      when jenis = 'Tangki FRP' and ukuran ~ '^\s*\d+\s*"?\s*$' and tinggi is not null then regexp_replace(ukuran, '[\s"]', '', 'g') || ' x ' || tinggi || '"'
      when jenis = 'Tangki FRP' and d4 is not null then d4 || ' x ' || h4 || '"'
      when jenis = 'Tangki FRP' then ukuran
      when cap_l is not null then regexp_replace(cap_l, '[.,](\d{3})$', '\1') || ' L'
      when cap_m3 is not null then cap_m3 || ' m3'
      else ukuran end as ukuran_baru,
    case
      when material is not null then material
      when jenis = 'Tangki PE' then 'PE' when jenis = 'Tangki PP' then 'PP' when jenis = 'Tangki FRP' then 'FRP'
      else material end as material_baru,
    case
      when merek is not null then merek
      when jenis like 'Pompa %' or jenis = 'Blower & kompresor' then case
        when t ~ 'grundfos' then 'Grundfos' when t ~ '\mcnp\M' or t ~ '\m(cdmf?|cdlf?|chlf?)\s*-?\s*\d' then 'CNP'
        when t ~ 'procon' then 'Procon' when t ~ 'seko' then 'Seko' when t ~ 'pedrollo' then 'Pedrollo'
        when t ~ 'ebara' then 'Ebara' when t ~ 'lowara' then 'Lowara' when t ~ '\mcr(n|i|ne)?\s*-?\s*\d' then 'Grundfos' end
      else merek end as merek_baru
  from y
)
update public.barang b set
  nama = z.nama_baru,
  ukuran = z.ukuran_baru,
  material = z.material_baru,
  merek = z.merek_baru,
  nama_lain = case
    when z.nama_baru <> b.nama and not exists (select 1 from unnest(b.nama_lain) a where lower(a) = lower(b.nama))
      then array_prepend(b.nama, b.nama_lain)
    else b.nama_lain end
from z where b.kode = z.kode;

-- 6. Gabung tangki/pompa yang identik ke kode yang paling sering dipakai.
with k as (
  select kode, kategori_kode, jenis, nama, dipakai_project,
    lower(regexp_replace(coalesce(ukuran, ''), '[\s,."]', '', 'g')) uk,
    lower(regexp_replace(coalesce(material, ''), '[\s,.\-]', '', 'g')) mt,
    lower(regexp_replace(coalesce(merek, ''), '[\s,.\-]', '', 'g')) mr,
    lower(regexp_replace(regexp_replace(lower(coalesce(model, '')), '(seko|grundfos|cnp|procon|pedrollo|ebara|lowara)', '', 'g'), '[\s,.\-/]', '', 'g')) md
  from public.barang
  where status_cek is null and gabung_ke is null
    and ((kategori_kode = 'TNK' and jenis in ('Tangki PE','Tangki PP','Tangki FRP','Tangki SS') and ukuran is not null)
      or (kategori_kode = 'PMP' and jenis <> 'Aksesori pompa' and coalesce(model, '') <> ''))
), r as (
  select *, first_value(kode) over w as target, row_number() over w as rn
  from k
  -- tujuan: yang paling sering dipakai; kalau sama, kode yang awalannya sesuai kategori (mis. TNK-, bukan FLT-)
  window w as (partition by kategori_kode, jenis, nama, uk, mt, mr, md order by dipakai_project desc, (left(kode, 3) = kategori_kode) desc, kode)
)
update public.barang b set
  status_cek = 'Gabung',
  gabung_ke = r.target,
  catatan = concat_ws(' ', b.catatan, 'Digabung otomatis 31 Okt 2026: barang fisik yang sama dengan ' || r.target || ' (dulu dibedakan menurut fungsinya).')
from r where b.kode = r.kode and r.rn > 1;

-- 7. Penanda untuk diperiksa W&P / Engineering.
update public.barang set perlu_dicek = array_append(perlu_dicek, 'jenis perlu dicek')
 where (jenis ~ '( lain|belum jelas\)|^Lainnya)$' or jenis = 'Lainnya') and not ('jenis perlu dicek' = any (perlu_dicek));
update public.barang set perlu_dicek = array_append(perlu_dicek, 'kapasitas belum diisi')
 where kategori_kode = 'TNK' and jenis like 'Tangki %' and ukuran is null and not ('kapasitas belum diisi' = any (perlu_dicek));
