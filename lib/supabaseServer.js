// Akses database Supabase modul gudang dari SERVER saja (API route). Jangan diimpor dari halaman/komponen.
//
// - SUPABASE_URL dan SUPABASE_SECRET_KEY ada di env Vercel. Kunci rahasia melewati RLS, jadi tidak boleh sampai ke
//   browser: semua tabel memakai RLS tanpa policy, dan hanya route server yang sudah mengecek sesi yang memanggil ini.
// - Memakai REST PostgREST langsung (fetch), tanpa pustaka tambahan.

const PAGE = 1000; // batas baris per permintaan PostgREST di Supabase

export function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

function headers(extra) {
  return {
    apikey: process.env.SUPABASE_SECRET_KEY,
    'Content-Type': 'application/json',
    ...(extra || {}),
  };
}

function url(table, query) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const qs = new URLSearchParams(query || {}).toString();
  return `${base}/rest/v1/${table}${qs ? `?${qs}` : ''}`;
}

async function readJson(res) {
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg = (json && (json.message || json.hint)) || text || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.code = json && json.code;
    throw err;
  }
  return json;
}

// SELECT. query = parameter PostgREST, mis. { select: 'kode,nama', kode: 'eq.FTG-0001', order: 'kode' }.
export async function sbSelect(table, query, { limit } = {}) {
  const res = await fetch(url(table, { ...query, ...(limit ? { limit: String(limit) } : {}) }), {
    headers: headers(),
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  return readJson(res);
}

// SELECT semua baris (melewati batas 1000 baris per permintaan). Wajib ada `order` supaya halaman stabil.
export async function sbSelectAll(table, query) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(url(table, query), {
      headers: headers({ Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    const rows = await readJson(res);
    out.push(...(rows || []));
    if (!rows || rows.length < PAGE) break;
  }
  return out;
}

// INSERT satu atau beberapa baris (satu permintaan = satu pernyataan SQL, jadi atomik). Mengembalikan baris yang dibuat.
// upsertOn = nama kolom unik (dipisah koma) untuk "insert atau perbarui kalau sudah ada"; select = kolom yang dikembalikan
// (boleh memuat tabel terkait, mis. 'id,barang(nama)').
export async function sbInsert(table, rows, { upsertOn, select } = {}) {
  const query = { ...(upsertOn ? { on_conflict: upsertOn } : {}), ...(select ? { select } : {}) };
  const res = await fetch(url(table, query), {
    method: 'POST',
    headers: headers({ Prefer: `return=representation${upsertOn ? ',resolution=merge-duplicates' : ''}` }),
    body: JSON.stringify(rows),
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  return readJson(res);
}

// DELETE dengan filter; mengembalikan baris yang terhapus.
export async function sbDelete(table, filter) {
  const res = await fetch(url(table, filter), {
    method: 'DELETE',
    headers: headers({ Prefer: 'return=representation' }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  return readJson(res);
}

// Panggil fungsi database (RPC), mis. posting_opname.
export async function sbRpc(fn, args) {
  const res = await fetch(url(`rpc/${fn}`), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(args || {}),
    cache: 'no-store',
    signal: AbortSignal.timeout(25000),
  });
  return readJson(res);
}

// Storage (foto barang). Bucket privat; kunci rahasia lewat header apikey sama seperti PostgREST.
function storageUrl(bucket, path) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  return `${base}/storage/v1/object/${bucket}${path ? `/${path.split('/').map(encodeURIComponent).join('/')}` : ''}`;
}

export async function sbStorageUpload(bucket, path, bytes, contentType) {
  const res = await fetch(storageUrl(bucket, path), {
    method: 'POST',
    headers: headers({ 'Content-Type': contentType, 'x-upsert': 'false' }),
    body: bytes,
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  return readJson(res);
}

// Mengembalikan Response mentah (body gambar) supaya route bisa meneruskannya; galat HTTP dilempar.
export async function sbStorageGet(bucket, path) {
  const res = await fetch(storageUrl(`authenticated/${bucket}`, path), { headers: headers(), cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (!res.ok) await readJson(res);
  return res;
}

export async function sbStorageRemove(bucket, paths) {
  const res = await fetch(storageUrl(bucket), {
    method: 'DELETE',
    headers: headers(),
    body: JSON.stringify({ prefixes: paths }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  return readJson(res);
}

// UPDATE dengan filter; mengembalikan baris yang berubah (kosong = tidak ada yang cocok dengan filter).
export async function sbUpdate(table, filter, changes) {
  const res = await fetch(url(table, filter), {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(changes),
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  return readJson(res);
}
