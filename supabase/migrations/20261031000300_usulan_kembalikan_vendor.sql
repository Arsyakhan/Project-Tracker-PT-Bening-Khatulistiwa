-- Usulan pembelian: vendor dan tautan penawaran untuk Direksi, serta keputusan ketiga "kembalikan untuk dilengkapi"
-- (31 Okt 2026). Pola dari alur persetujuan pembelian yang umum: pemberi persetujuan bisa menyetujui, menolak, atau
-- mengembalikan usulan supaya datanya dilengkapi, dan sebaiknya sudah melihat vendor dan penawaran sebelum memutuskan.

alter table public.usulan_pembelian
  add column vendor text,                                   -- vendor yang disarankan (boleh lebih dari satu, teks bebas)
  add column tautan_penawaran text check (tautan_penawaran is null or tautan_penawaran ~* '^https://'), -- mis. PDF di Drive
  add column dikembalikan_oleh text,                        -- pengembalian terakhir (riwayat ringkas)
  add column dikembalikan_pada timestamptz,
  add column catatan_dikembalikan text;

-- Diajukan -> draf lagi, dengan catatan apa yang perlu dilengkapi (wajib). Hak memutuskan dicek di route server.
create function public.kembalikan_usulan(p_id bigint, p_email text, p_catatan text) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  u public.usulan_pembelian;
  v_catatan text := nullif(trim(coalesce(p_catatan, '')), '');
begin
  select * into u from public.usulan_pembelian where id = p_id for update;
  if not found then
    raise exception 'Usulan tidak ditemukan.' using errcode = 'P0001';
  end if;
  if u.status <> 'diajukan' then
    raise exception 'Hanya usulan yang menunggu persetujuan yang bisa dikembalikan.' using errcode = 'P0001';
  end if;
  if v_catatan is null then
    raise exception 'Tulis apa yang perlu dilengkapi.' using errcode = 'P0001';
  end if;
  update public.usulan_pembelian
     set status = 'draf', dikembalikan_oleh = p_email, dikembalikan_pada = now(), catatan_dikembalikan = v_catatan,
         diubah_oleh = p_email
   where id = p_id;
  return jsonb_build_object('id', p_id, 'status', 'draf');
end;
$$;

revoke all on function public.kembalikan_usulan(bigint, text, text) from public, anon, authenticated;
grant execute on function public.kembalikan_usulan(bigint, text, text) to service_role;
