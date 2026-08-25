import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  titulo: string;
  detalle?: string;
}

interface ToastApi {
  success: (titulo: string, detalle?: string) => void;
  error: (titulo: string, detalle?: string) => void;
  info: (titulo: string, detalle?: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

const ICON: Record<ToastKind, string> = { success: '✓', error: '⚠', info: 'ℹ' };
const TTL: Record<ToastKind, number> = { success: 3200, error: 5200, info: 3600 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (kind: ToastKind, titulo: string, detalle?: string) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-4), { id, kind, titulo, detalle }]);
      window.setTimeout(() => remove(id), TTL[kind]);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (t, d) => push('success', t, d),
      error: (t, d) => push('error', t, d),
      info: (t, d) => push('info', t, d),
    }),
    [push],
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toasts" role="region" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toastc toastc--${t.kind}`} role="status" onClick={() => remove(t.id)}>
            <span className="toastc__icon" aria-hidden>{ICON[t.kind]}</span>
            <span className="toastc__body">
              <strong>{t.titulo}</strong>
              {t.detalle && <span className="toastc__detalle">{t.detalle}</span>}
            </span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
