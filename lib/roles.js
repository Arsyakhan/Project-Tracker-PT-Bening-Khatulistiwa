// Peran pengguna: admin | editor | viewer.
//
// Diatur lewat Environment Variables di Vercel (pisah koma), TANPA ubah kode:
//   ADMIN_EMAILS  = email yang boleh SEMUANYA, termasuk menghapus project
//   VIEWER_EMAILS = email yang hanya boleh MELIHAT (tidak bisa menyimpan/mengubah apa pun)
//   (email lain di ALLOWED_EMAILS = editor: boleh mengubah serta menghapus rapat & pengadaan,
//    tapi tidak boleh menghapus project)
//
// ATURAN AMAN: kalau ADMIN_EMAILS tidak diisi sama sekali, SEMUA pengguna dianggap admin
// (sama seperti perilaku sebelum fitur ini ada), jadi memasang file ini tidak mengubah apa pun
// sampai ADMIN_EMAILS diisi.
//
// Pengecekan sebenarnya dilakukan di server (API route). Tampilan di browser hanya cerminannya.

export const ROLES = ['admin', 'editor', 'viewer'];

function listFromEnv(name) {
  return (process.env[name] || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// HANYA dipanggil dari kode server (API route / NextAuth). Di browser env ini kosong.
export function getRoleForEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  const admins = listFromEnv('ADMIN_EMAILS');
  if (admins.length === 0) return 'admin';
  if (admins.includes(e)) return 'admin';
  if (listFromEnv('VIEWER_EMAILS').includes(e)) return 'viewer';
  return 'editor';
}

export const canWrite = (role) => role === 'admin' || role === 'editor';
export const canDelete = (role) => role === 'admin';

export function roleLabel(role) {
  return role === 'admin' ? 'Admin' : role === 'viewer' ? 'Viewer (hanya lihat)' : 'Editor';
}

export const MSG_VIEWER = 'Akun Anda berstatus Viewer (hanya lihat), jadi tidak bisa mengubah data.';
export const MSG_NOT_ADMIN = 'Hanya Admin yang boleh menghapus project atau data arsip.';
