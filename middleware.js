import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// TL-0038: login Google kadang gagal "State cookie was missing". Penyebab yang paling mungkin: login dimulai dari
// alamat Vercel lain (alias atau URL deployment) daripada alamat di NEXTAUTH_URL. Cookie "state" tersimpan di alamat
// alias, sedangkan Google mengembalikan pengguna ke alamat NEXTAUTH_URL, jadi cookie itu tidak terbaca. Di produksi,
// semua halaman yang dibuka dari alamat lain diarahkan dulu ke alamat NEXTAUTH_URL (path dan query tetap).
// Hanya GET/HEAD, hanya produksi (Preview Deployment dan lokal tidak disentuh), dan 307 (sementara) supaya browser
// tidak menyimpan pengalihan ini selamanya kalau alamatnya diganti nanti.
function redirectToCanonicalHost(req) {
  if (process.env.VERCEL_ENV !== 'production' || !process.env.NEXTAUTH_URL) return null;
  if (req.method !== 'GET' && req.method !== 'HEAD') return null;
  let canonical;
  try {
    canonical = new URL(process.env.NEXTAUTH_URL);
  } catch (e) {
    return null;
  }
  const host = req.headers.get('host');
  if (!host || host === canonical.host) return null;
  const target = new URL(req.nextUrl.pathname + req.nextUrl.search, canonical.origin);
  return NextResponse.redirect(target, 307);
}

export async function middleware(req) {
  const toCanonical = redirectToCanonicalHost(req);
  if (toCanonical) return toCanonical;

  // Cek sesi NextAuth yang sesungguhnya (JWT ter-signature, tidak bisa
  // dipalsukan dari console browser seperti cookie isLoggedIn sebelumnya)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isLoggedIn = !!token;
  const url = req.nextUrl.clone();

  // Jika belum login dan mencoba mengakses halaman selain /login, arahkan ke /login
  if (!isLoggedIn && url.pathname !== '/login') {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Jika sudah login tapi mencoba mengakses halaman /login, arahkan ke dashboard (/)
  if (isLoggedIn && url.pathname === '/login') {
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Terapkan middleware ini ke seluruh halaman kecuali file aset (gambar, favicon, API internal)
// serta file-file PWA (manifest, service worker) yang harus bisa diakses tanpa login
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*\\.js|worker-.*\\.js|.*\\.(?:png|jpg|jpeg|webp|gif|svg|ico|avif)$).*)',
  ],
};
