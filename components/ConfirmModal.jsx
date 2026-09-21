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

  if (!open) return null;

  const canConfirm = !requireText || typed === requireText;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-panel rounded-xl border border-line shadow-xl w-full max-w-sm p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1.5">
          <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
          {description && <p className="text-sm text-inkmute">{description}</p>}
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
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm font-medium text-inkmute hover:bg-canvas transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              danger ? 'bg-rust hover:bg-red-800' : 'bg-blueprint hover:bg-blueprintdark'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
