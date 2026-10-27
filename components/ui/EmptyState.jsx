// Keadaan kosong: apa yang terjadi + apa yang bisa dilakukan. Tanpa ilustrasi hiasan.
export default function EmptyState({ title, children, action, dashed = true, className = '' }) {
  return (
    <div className={`bg-panel border ${dashed ? 'border-dashed' : ''} border-line rounded-xl px-6 py-10 text-center flex flex-col items-center gap-1.5 ${className}`}>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {children && <div className="text-sm text-inkmute max-w-md">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
