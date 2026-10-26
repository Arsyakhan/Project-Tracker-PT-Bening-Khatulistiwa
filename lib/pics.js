// Pilihan PIC project untuk dropdown. Fungsi murni.
//
// Isi sheet sekarang memakai kosakata PM sendiri (mis. "Engineer", "Technician"), bukan nama divisi baku
// ("Engineering"). Supaya dropdown tidak memecah satu divisi jadi dua tulisan (filter PIC di Semua Project
// mengelompokkan berdasarkan teks persis), pilihan disusun dari tulisan yang sudah dipakai di project, lalu
// ditambah divisi baku yang belum terwakili dan nama peserta tetap.
import { DEFAULT_ATTENDEES } from './meetings';
import { DIVISIONS } from './today';

// Tulisan peran/divisi yang umum -> divisi bakunya (huruf kecil). Dipakai untuk mengenali bahwa "Engineer"
// sudah mewakili "Engineering".
const ROLE_DIVISION = {
  engineer: 'Engineering', engineering: 'Engineering',
  technician: 'Technician', teknisi: 'Technician',
  marketing: 'Marketing & Direksi', direksi: 'Marketing & Direksi', 'marketing & direksi': 'Marketing & Direksi', commercial: 'Marketing & Direksi',
  warehouse: 'Warehouse & Purchasing', purchasing: 'Warehouse & Purchasing', gudang: 'Warehouse & Purchasing', 'warehouse & purchasing': 'Warehouse & Purchasing',
  // Ejaan lama di daftar dropdown sheet (sebelum 26 Okt 2026): tetap dikenali sebagai divisi, bukan nama orang.
  'warehouse & purchase': 'Warehouse & Purchasing', purchase: 'Warehouse & Purchasing',
};

export const roleDivision = (v) => ROLE_DIVISION[String(v ?? '').trim().toLowerCase()] || '';

// existing = nilai PIC yang sudah dipakai di project (boleh berulang). Mengembalikan dua kelompok:
//   roles = divisi/peran (tulisan yang sudah dipakai + divisi baku yang belum terwakili)
//   names = nama orang (peserta tetap + tulisan lain yang sudah dipakai)
// Tiap kelompok tanpa duplikat (huruf besar/kecil diabaikan); yang paling sering dipakai di depan.
export function picOptions(existing) {
  const count = new Map(); // kunci huruf kecil -> { text, n }
  (existing || []).forEach((raw) => {
    const text = String(raw ?? '').trim();
    if (!text) return;
    const k = text.toLowerCase();
    const cur = count.get(k);
    if (cur) cur.n += 1; else count.set(k, { text, n: 1 });
  });
  const used = [...count.values()].sort((a, b) => b.n - a.n || a.text.localeCompare(b.text, 'id'));

  const roles = used.filter((u) => roleDivision(u.text)).map((u) => u.text);
  const covered = new Set(roles.map(roleDivision));
  DIVISIONS.filter((d) => !covered.has(d)).forEach((d) => roles.push(d));

  const seen = new Set(roles.map((r) => r.toLowerCase()));
  const names = [];
  const addName = (t) => { const k = t.toLowerCase(); if (!seen.has(k)) { seen.add(k); names.push(t); } };
  used.filter((u) => !roleDivision(u.text)).forEach((u) => addName(u.text));
  DEFAULT_ATTENDEES.forEach((a) => addName(a.name));
  return { roles, names };
}
