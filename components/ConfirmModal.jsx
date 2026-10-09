import { useEffect, useState } from 'react';

export default function ConfirmModal({
  open,
  title,
  description,
  confirmText = 'Hapus',
  cancelText = 'Batal',
  requireText, // kalau diisi, user harus ketik ulang teks ini persis sebelum tombol aktif
  onConfirm,
  onCancel,
  danger = true,
}) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  // Escape menutup dialog (sama seperti tombol Batal)
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const canConfirm = !requireText || typed === requireText;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={description ? 'confirm-desc' : undefined}
        className="bg-panel rounded-xl border border-line shadow-xl w-full max-w-sm p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1.5">
          <h3 id="confirm-title" className="font-display text-lg font-semibold text-ink">{title}</h3>
          {description && <p id="confirm-desc" className="text-sm text-inkmute">{description}</p>}
        </div>

        {requireText && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-inkmute">
              Ketik <span className="font-data font-semibold text-ink">{requireText}</span> untuk konfirmasi
            </label>
            <input
              autoFocus
              className="border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-blueprint bg-panel text-ink"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        )}

        <div className="flex gap-3 justify-end mt-2">
          <button type="button" onClick={onCancel} className="btn btn-ghost">
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
