// Kelengkapan dokumen engineering lintas project: untuk tiap dokumen di checklist, berapa project yang sudah
// Completed dari yang memerlukannya (status N/A tidak dihitung). Membantu Engineering melihat dokumen mana yang
// paling sering tertinggal.
const SHORT = {
  'BOM (Bill of Materials)': 'BOM',
  'P&ID (Drawings)': 'P&ID',
  'EWD (Electrical Wiring)': 'EWD',
  'GAD (General Arrangement)': 'GAD',
};

export default function DocCoverage({ projects, items }) {
  const rows = (items || []).map((item) => {
    let need = 0;
    let done = 0;
    let review = 0;
    projects.forEach((p) => {
      const st = p.checklist?.items?.[item];
      if (!st || st === 'N/A') return;
      need += 1;
      if (st === 'Completed') done += 1;
      else if (st === 'Under Review') review += 1;
    });
    return { item, need, done, review };
  });

  if (rows.length === 0) return <p className="text-sm text-inkmute">Checklist belum tersedia.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => {
        const pct = r.need ? Math.round((r.done / r.need) * 100) : 0;
        const left = r.need - r.done;
        return (
          <li key={r.item} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5">
            <span className="text-sm text-ink truncate" title={r.item}>{SHORT[r.item] || r.item}</span>
            <span className="text-xs text-inkmute tnum text-right">
              <span className="font-semibold text-ink">{r.done}</span> / {r.need}
              {left > 0 && <span className="ml-1.5">· {left} belum</span>}
            </span>
            <span className="col-span-2 h-1.5 rounded-full bg-line/60 overflow-hidden flex" aria-hidden="true">
              <span className="h-full bg-teal" style={{ width: `${pct}%` }} />
              {r.need > 0 && <span className="h-full bg-amber/70" style={{ width: `${(r.review / r.need) * 100}%` }} />}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
