import { NextResponse } from 'next/server';

export function middleware(req) {
  // Cek apakah browser memiliki cookie penanda login
  const isLoggedIn = req.cookies.get('isLoggedIn')?.value;
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
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
