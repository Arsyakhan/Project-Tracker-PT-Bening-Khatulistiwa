import { Html, Head, Main, NextScript } from 'next/document';

// Dijalankan sebelum halaman digambar sama sekali, supaya kalau user
// pernah pilih dark mode, tidak ada "kedipan" warna terang sekilas dulu.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('ptbk_theme');
    var theme = (stored === 'light' || stored === 'dark')
      ? stored
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function Document() {
  return (
    <Html lang="id">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
