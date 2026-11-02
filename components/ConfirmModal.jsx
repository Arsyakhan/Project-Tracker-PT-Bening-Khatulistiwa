import { useEffect, useRef, useState } from 'react';
import useLayer from '../lib/useLayer';

// Di HP dialog ini menjadi lembar dari bawah (tombol dalam jangkauan jempol, Batal paling bawah); di layar lebar tetap
// di tengah. Masuk dan keluar lewat jalur yang sama (lib/useLayer.js + .layer-* di globals.css).
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
  confirmDisabled = false,
  children,
}) {
  const [typed, setTyped] = useState('');
  const { mounted, state } = useLayer(open, 200);
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

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

  // Fokus pindah ke dalam dialog. Kalau tidak ada isian yang meminta fokus (autoFocus), pilihan aman = Batal,
  // jadi Enter yang tidak sengaja tidak menjalankan tindakan yang tidak bisa dibatalkan.
  useEffect(() => {
    if (open && dialogRef.current && !dialogRef.current.contains(document.activeElement)) cancelRef.current?.focus();
  }, [open]);

  if (!mounted) return null;

  const canConfirm = (!requireText || typed === requireText) && !confirmDisabled;

  return (
    <div
      data-state={state}
      className="layer-scrim fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={description ? 'confirm-desc' : undefined}
        data-state={state}
        className="layer-sheet bg-panel rounded-t-2xl sm:rounded-xl border border-line shadow-xl w-full sm:max-w-sm p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 flex flex-col gap-4"
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
              className="input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        )}

        {children /* isian tambahan, mis. alasan penolakan */}

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end mt-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="btn btn-ghost max-sm:h-11">
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'} max-sm:h-11`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
