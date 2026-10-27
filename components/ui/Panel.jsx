// Panel standar: kepala (judul, keterangan, aksi) + isi. Dipakai bersama supaya semua halaman punya ritme yang sama.
// - flush : isi menempel ke tepi panel (untuk daftar bergaris pemisah atau tabel)
// - as    : elemen pembungkus (bawaan section)
export default function Panel({ title, hint, aside, children, flush = false, className = '', bodyClassName = '', id, as: Tag = 'section' }) {
  const hasHead = title || hint || aside;
  return (
    <Tag id={id} className={`bg-panel border border-line rounded-xl shadow-sm min-w-0 ${flush ? 'overflow-hidden' : ''} ${className}`}>
      {hasHead && (
        <div className={`flex items-start justify-between gap-3 px-5 pt-4 ${flush ? 'pb-3 border-b border-line' : 'pb-0'}`}>
          <div className="min-w-0">
            {title && <h2 className="font-display text-base font-semibold text-ink">{title}</h2>}
            {hint && <p className="text-xs text-inkmute mt-1">{hint}</p>}
          </div>
          {aside && <div className="shrink-0 flex items-center gap-2">{aside}</div>}
        </div>
      )}
      <div className={`${flush ? '' : 'p-5'} ${hasHead && !flush ? 'pt-4' : ''} ${bodyClassName}`}>{children}</div>
    </Tag>
  );
}
