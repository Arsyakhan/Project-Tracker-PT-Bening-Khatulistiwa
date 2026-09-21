const defaultRuntimeCaching = require('next-pwa/cache');

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    // Data dari /api/* (data project, activity log) TIDAK boleh disimpan service worker:
    // bawaan next-pwa menyimpannya 24 jam di browser, sehingga data tetap bisa terlihat
    // setelah logout dan data lama bisa muncul saat backend lambat.
    // Aturan ini harus di paling atas karena yang cocok pertama yang dipakai.
    {
      urlPattern: ({ url }) => self.origin === url.origin && url.pathname.startsWith('/api/'),
      handler: 'NetworkOnly',
    },
    ...defaultRuntimeCaching,
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = withPWA(nextConfig);
