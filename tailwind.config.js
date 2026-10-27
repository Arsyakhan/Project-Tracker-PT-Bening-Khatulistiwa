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
