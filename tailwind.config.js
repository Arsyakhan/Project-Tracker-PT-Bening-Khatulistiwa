/** @type {import('tailwindcss').Config} */
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
        teal: 'rgb(var(--color-teal) / <alpha-value>)',
        amber: 'rgb(var(--color-amber) / <alpha-value>)',
        rust: 'rgb(var(--color-rust) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'], 
        data: ['JetBrains Mono', 'monospace'], 
      }
    },
  },
  plugins: [],
}
