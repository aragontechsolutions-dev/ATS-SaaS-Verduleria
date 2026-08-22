import { useCallback, useEffect, useState } from 'react';
import { currentCash, openCash } from '../lib/api';
import type { CashSession } from '../lib/types';

export interface CashState {
  session: CashSession | null;
  loading: boolean;
  error: string | null;
  open: (montoApertura: number) => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
}

/** Gestiona la caja abierta del cajero (abrir / consultar / cerrar). */
export function useCash(): CashState {
  const [session, setSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSession(await currentCash());
    } catch {
      // Sin conexión: no bloqueamos la venta (offline-first).
      setSession((s) => s);
    }
  }, []);

  const open = useCallback(async (montoApertura: number) => {
    setLoading(true);
    setError(null);
    try {
      setSession(await openCash(montoApertura));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => setSession(null), []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { session, loading, error, open, refresh, clear };
}
