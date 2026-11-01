// Foto barang: logika server (hanya untuk route API). Foto gudang di bucket Storage privat `foto-barang`, foto internet
// hanya tautan. Lihat supabase/migrations/20261101000400_foto_barang.sql.
import crypto from 'crypto';
import { sbSelect, sbInsert, sbDelete, sbStorageUpload, sbStorageRemove } from './supabaseServer';
import { userError } from './gudangServer';

export const BUCKET = 'foto-barang';
export const FOTO_FIELDS = 'id,barang_kode,sumber,url,halaman_sumber,keterangan,opname_id,dibuat_oleh,dibuat_pada';
const MAX_PER_BARANG = 12;
const MAX_BESAR = 2.5 * 1024 * 1024;
const MAX_KECIL = 400 * 1024;
const HTTPS_RE = /^https:\/\/[^\s"'<>]+$/;

// "data:image/jpeg;base64,..." -> Buffer; hanya JPEG (dikompres di browser), dicek dari byte awalnya.
function jpegFromDataUrl(v, label, max) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(v || ''));
  if (!m) throw userError(`${label} harus berupa gambar JPEG.`);
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) throw userError(`${label} bukan berkas JPEG yang valid.`);
  if (buf.length > max) throw userError(`${label} terlalu besar.`);
  return buf;
}

async function cekBarang(kodeRaw) {
  const kode = String(kodeRaw || '').trim();
  const rows = kode ? await sbSelect('barang', { select: 'kode,gabung_ke', kode: `eq.${kode}` }) : [];
  const b = rows && rows[0];
  if (!b) throw userError('Barang tidak ditemukan.', 404);
  if (b.gabung_ke) throw userError(`Barang ini sudah digabung ke ${b.gabung_ke}. Tambahkan fotonya di kode tujuan.`);
  const ada = await sbSelect('foto_barang', { select: 'id', barang_kode: `eq.${kode}` });
  if ((ada || []).length >= MAX_PER_BARANG) throw userError(`Satu barang paling banyak ${MAX_PER_BARANG} foto. Hapus foto lama dulu.`);
  return kode;
}

function opnameId(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw userError('Nomor opname tidak valid.');
  return n;
}

export async function listFoto(kode) {
  return sbSelect('foto_barang', { select: FOTO_FIELDS, barang_kode: `eq.${kode}`, order: 'dibuat_pada.desc,id.desc' });
}

// Foto asli dari gudang: dua ukuran yang sudah dikompres di browser (besar untuk galeri, kecil untuk daftar).
export async function unggahFoto(payload, email) {
  const kode = await cekBarang(payload?.kode);
  const besar = jpegFromDataUrl(payload?.besar, 'Foto', MAX_BESAR);
  const kecil = jpegFromDataUrl(payload?.kecil, 'Foto kecil', MAX_KECIL);
  const opname_id = opnameId(payload?.opname_id);
  const nama = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const path = `${kode}/${nama}.jpg`;
  const path_kecil = `${kode}/${nama}-kecil.jpg`;
  await sbStorageUpload(BUCKET, path, besar, 'image/jpeg');
  try {
    await sbStorageUpload(BUCKET, path_kecil, kecil, 'image/jpeg');
    const rows = await sbInsert('foto_barang', [{ barang_kode: kode, sumber: 'gudang', path, path_kecil, opname_id, dibuat_oleh: email }], { select: FOTO_FIELDS });
    return rows[0];
  } catch (err) {
    // Jangan tinggalkan berkas yatim di Storage kalau langkah berikutnya gagal.
    await sbStorageRemove(BUCKET, [path, path_kecil]).catch(() => {});
    throw err;
  }
}

// Foto contoh dari internet: hanya tautan gambar (https) dan halaman sumbernya.
export async function tautkanFoto(payload, email) {
  const kode = await cekBarang(payload?.kode);
  const url = String(payload?.url || '').trim();
  const halaman = String(payload?.halaman_sumber || '').trim();
  if (!HTTPS_RE.test(url) || url.length > 1000) throw userError('Tautan gambar harus diawali https:// dan tidak lebih dari 1.000 karakter.');
  if (halaman && (!HTTPS_RE.test(halaman) || halaman.length > 1000)) throw userError('Tautan halaman sumber harus diawali https://.');
  const rows = await sbInsert('foto_barang', [{ barang_kode: kode, sumber: 'internet', url, halaman_sumber: halaman || null, dibuat_oleh: email }], { select: FOTO_FIELDS });
  return rows[0];
}

export async function hapusFoto(idRaw) {
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) throw userError('Nomor foto tidak valid.');
  const rows = await sbDelete('foto_barang', { id: `eq.${id}`, select: 'id,sumber,path,path_kecil' });
  const f = rows && rows[0];
  if (!f) throw userError('Foto tidak ditemukan.', 404);
  if (f.sumber === 'gudang') await sbStorageRemove(BUCKET, [f.path, f.path_kecil]).catch((e) => console.error('Hapus berkas foto gagal:', e));
  return { id };
}

// Path Storage satu foto gudang (untuk route yang menyajikan gambar). null = tidak ada / bukan foto gudang.
export async function pathFoto(idRaw, kecil) {
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) return null;
  const rows = await sbSelect('foto_barang', { select: 'sumber,path,path_kecil', id: `eq.${id}` });
  const f = rows && rows[0];
  if (!f || f.sumber !== 'gudang') return null;
  return kecil ? f.path_kecil : f.path;
}
