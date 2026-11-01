// Foto barang di browser: alamat gambar, kompres sebelum unggah, dan panggilan /api/gudang-foto.

// Foto gudang disajikan route server (wajib login); foto internet langsung dari tautannya.
export function fotoSrc(f, kecil = true) {
  if (!f) return null;
  if (f.sumber === 'internet') return f.url;
  return `/api/gudang-foto/${f.id}${kecil ? '?ukuran=kecil' : ''}`;
}

// Foto utama dari daftar foto satu barang (sama dengan view foto_utama): foto gudang terbaru, kalau belum ada foto
// internet terbaru. Daftar dari server sudah urut terbaru dulu.
export function fotoUtama(list) {
  return (list || []).find((f) => f.sumber === 'gudang') || (list || [])[0] || null;
}

export function domainSumber(f) {
  try {
    return new URL(f.halaman_sumber || f.url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function bacaGambar(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* lanjut ke cara biasa */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    // mis. HEIC di browser yang tidak mendukungnya
    throw new Error('Gambar tidak bisa dibaca. Coba foto ulang, atau pilih berkas JPG/PNG.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function keJpeg(src, maks, kualitas) {
  const skala = Math.min(1, maks / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * skala));
  c.height = Math.max(1, Math.round(src.height * skala));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; // PNG transparan jadi latar putih, bukan hitam
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', kualitas);
}

// Foto dari kamera HP bisa 3-8 MB; dikecilkan jadi dua JPEG: besar (sisi terpanjang 1600 px) dan kecil (480 px).
export async function siapkanFoto(file) {
  if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('Berkas yang dipilih bukan gambar.');
  const src = await bacaGambar(file);
  try {
    let besar = keJpeg(src, 1600, 0.82);
    if (besar.length > 3000000) besar = keJpeg(src, 1280, 0.72);
    const kecil = keJpeg(src, 480, 0.72);
    return { besar, kecil };
  } finally {
    if (typeof src.close === 'function') src.close();
  }
}

async function panggil(method, body, query) {
  const qs = query ? `?${new URLSearchParams(query)}` : '';
  const res = await fetch(`/api/gudang-foto${qs}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* bukan JSON */ }
  if (!res.ok || !json || !json.ok) {
    const err = new Error((json && json.error) || (res.status === 413 ? 'Foto terlalu besar.' : `Gagal (HTTP ${res.status}).`));
    err.status = res.status;
    throw err;
  }
  return json.data;
}

export const fotoApi = {
  list: (kode) => panggil('GET', null, { kode }),
  unggah: (payload) => panggil('POST', { action: 'unggah', payload }),
  tautkan: (payload) => panggil('POST', { action: 'tautkan', payload }),
  hapus: (id) => panggil('POST', { action: 'hapus', payload: { id } }),
};
