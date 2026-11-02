/** @type {import('tailwindcss').Config} */
// Nilai-nilai di sini berasal dari DESIGN.md (arah desain "jernih, presisi, mengalir").
// Warna selalu lewat variabel CSS di styles/globals.css supaya mode gelap ikut otomatis.
module.exports = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        panel: 'rgb(var(--color-panel) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        inkmute: 'rgb(var(--color-inkmute) / <alpha-value>)',
        blueprint: 'rgb(var(--color-blueprint) / <alpha-value>)',
        blueprintdark: 'rgb(var(--color-blueprintdark) / <alpha-value>)',
        brand: 'rgb(var(--color-brand) / <alpha-value>)',
        air: 'rgb(var(--color-air) / <alpha-value>)',
        deep: 'rgb(var(--color-deep) / <alpha-value>)',
        teal: 'rgb(var(--color-teal) / <alpha-value>)',
        amber: 'rgb(var(--color-amber) / <alpha-value>)',
        amberink: 'rgb(var(--color-amberink) / <alpha-value>)',
        rust: 'rgb(var(--color-rust) / <alpha-value>)',
        rustdark: 'rgb(var(--color-rustdark) / <alpha-value>)',
        onaccent: 'rgb(var(--color-onaccent) / <alpha-value>)',
      },
      // Ukuran dan tinggi baris bawaan Tailwind, ditambah spasi huruf yang mengikuti ukuran: huruf besar tampak
      // terlalu renggang kalau spasinya tetap, huruf kecil perlu sedikit ruang supaya terbaca (DESIGN.md, Tipografi).
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        lg: ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.012em' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.016em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.022em' }],
        '5xl': ['3rem', { lineHeight: '1', letterSpacing: '-0.025em' }],
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        data: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        sm: 'var(--shadow-soft)',
        md: 'var(--shadow-lift)',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [],
}
