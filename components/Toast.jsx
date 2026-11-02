import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

let idCounter = 0;

// Pesan galat berisi apa yang gagal dan apa yang harus dilakukan, jadi tampil lebih lama supaya sempat dibaca.
const SHOW_MS = { success: 3500, info: 3500, error: 7000 };
const EXIT_MS = 200; // = --dur-normal

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  // Toast naik lagi ke atas (jalur yang sama dengan saat masuk) sebelum dilepas dari daftar.
  const dismiss = useCallback((id) => {
    setToasts((t) => t.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));
    setTimeout(() => setToasts((t) => t.filter((toast) => toast.id !== id)), EXIT_MS);
  }, []);

  // type: 'success' | 'error' | 'info'
  const showToast = useCallback((message, type = 'success') => {
    const id = ++idCounter;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => dismiss(id), SHOW_MS[type] || SHOW_MS.success);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div role="status" aria-live="polite" className="fixed top-4 right-4 z-[100] flex flex-col gap-2 items-end pointer-events-none w-[calc(100%-2rem)] sm:w-auto">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            data-state={toast.leaving ? 'closed' : 'open'}
            title="Ketuk untuk menutup"
            onClick={() => dismiss(toast.id)}
            className={`layer-pop pointer-events-auto cursor-pointer flex items-start gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium w-full sm:w-auto sm:max-w-sm ${
              toast.type === 'error'
                ? 'bg-panel border-rust/30 text-rust'
                : toast.type === 'info'
                ? 'bg-panel border-blueprint/30 text-blueprint'
                : 'bg-panel border-teal/30 text-teal'
            }`}
          >
            {toast.type === 'error' ? (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.007v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="text-ink">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast harus dipakai di dalam <ToastProvider>');
  return ctx;
}
