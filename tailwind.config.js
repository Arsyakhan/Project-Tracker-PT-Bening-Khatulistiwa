/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#E8F3F7',       // Latar belakang utama: Biru air sangat muda (bersih)
        panel: '#FFFFFF',        // Latar card & tabel: Putih bersih
        line: '#C6DDE6',         // Garis batas: Biru keabu-abuan pucat
        ink: '#0C2D48',          // Teks utama: Navy Blue pekat (pengganti hitam)
        inkmute: '#4A7291',      // Teks sekunder/label: Biru laut redup
        blueprint: '#0077B6',    // Warna aksen utama: Biru cerah khas industri air
        blueprintdark: '#005B8F',// Biru gelap untuk efek saat tombol disorot (hover)
        teal: '#009688',         // Hijau toska air untuk status Completed/Success
        amber: '#D98A00',        // Oranye hangat untuk status Warning/Review
        rust: '#D94848',         // Merah soft untuk Delete/Error
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'], 
        data: ['JetBrains Mono', 'monospace'], 
      }
    },
  },
  plugins: [],
}
