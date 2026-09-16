import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req) {
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
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|gif|svg|ico|avif)$).*)',
  ],
};
