// Export daftar project ke CSV yang langsung terbuka rapi di Excel.
// - Pemisah kolom ";" (standar Excel dengan pengaturan regional Indonesia). Kalau Excel
//   kamu memakai koma, ganti DELIMITER di bawah menjadi ','.
// - BOM UTF-8 di awal file supaya karakter seperti "·" atau "é" tidak rusak di Excel.
// - Teks yang diawali = + - @ diberi tanda ' di depan supaya tidak dieksekusi sebagai
//   rumus di Excel (CSV injection).

const DELIMITER = ';';

const COLUMNS = [
  ['PO Number', 'poNumber'],
  ['Project Name', 'projectName'],
  ['Client', 'client'],
  ['Technology/Capacity', 'technology'],
  ['PIC', 'pic'],
  ['Current Stage', 'currentStage'],
  ['Status', 'status'],
  ['Stage Progress (%)', 'stageProgress'],
  ['Engineering Doc Progress (%)', 'engineeringDocProgress'],
  ['Priority', 'priority'],
  ['Tanggal PO', 'tanggalPO'],
  ['Tanggal DP', 'tanggalDP'],
  ['Delivery Date', 'deliveryDate'],
  ['Days Remaining', 'daysRemaining'],
  ['Target Finish Date', 'targetFinishDate'],
  ['Remarks', 'remarks'],
];

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let s = String(value).replace(/\r?\n/g, ' ').trim();
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (s.includes(DELIMITER) || s.includes('"')) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildProjectsCsv(projects) {
  const header = COLUMNS.map(([label]) => escapeCell(label)).join(DELIMITER);
  const rows = projects.map((p) => COLUMNS.map(([, key]) => escapeCell(p[key])).join(DELIMITER));
  return '\uFEFF' + [header, ...rows].join('\r\n');
}

export function downloadProjectsCsv(projects) {
  const csv = buildProjectsCsv(projects);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `project-tracker_${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
