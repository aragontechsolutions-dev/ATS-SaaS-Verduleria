import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// ============================================================================
// Permisos por PIN (autorización de supervisor). El PIN se configura de forma
// CENTRAL en el panel de administración (un PIN por negocio) y viaja al POS
// dentro del catálogo. Acá se CACHEA (localStorage) y se EXIGE para acciones
// sensibles según las puertas (gates), funcionando offline. El cajero ya no lo
// configura en la caja. No es criptografía fuerte, pero es un control real
// frente al cajero (que ya no puede quitarlo borrando el almacenamiento local).
// ============================================================================

export type SecurityGate = 'discount' | 'void' | 'return' | 'price';

export interface SecurityConfig {
  /** SHA-256 del PIN (o null si no hay PIN configurado). */
  pinHash: string | null;
  /** Qué acciones exigen PIN. Solo aplican si hay un PIN configurado. */
  gates: Record<SecurityGate, boolean>;
}

const KEY = 'ats.pos.security';
const EVENT = 'ats:security-updated';

const DEFAULT_CONFIG: SecurityConfig = {
  pinHash: null,
  gates: { discount: false, void: false, return: false, price: false },
};

export const GATE_LABEL: Record<SecurityGate, string> = {
  discount: 'Aplicar descuento',
  void: 'Vaciar el carrito',
  return: 'Registrar devolución',
  price: 'Cambiar el precio de una línea',
};

export function loadSecurity(): SecurityConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_CONFIG, gates: { ...DEFAULT_CONFIG.gates } };
    const parsed = JSON.parse(raw) as Partial<SecurityConfig>;
    return { pinHash: parsed.pinHash ?? null, gates: { ...DEFAULT_CONFIG.gates, ...(parsed.gates ?? {}) } };
  } catch {
    return { ...DEFAULT_CONFIG, gates: { ...DEFAULT_CONFIG.gates } };
  }
}

/**
 * Cachea la config de seguridad recibida del backend (dentro del catálogo) y
 * avisa al provider para que la aplique en caliente. La fuente de verdad es el
 * panel de administración; acá solo se guarda para poder exigir el PIN offline.
 */
export function saveServerSecurity(config: { pinHash: string | null; gates: Record<string, boolean> } | undefined): void {
  if (!config) return;
  const normalized: SecurityConfig = {
    pinHash: config.pinHash ?? null,
    gates: {
      discount: !!config.gates?.discount,
      void: !!config.gates?.void,
      return: !!config.gates?.return,
      price: !!config.gates?.price,
    },
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* localStorage no disponible: no crítico */
  }
}

/** SHA-256 del PIN (hex). Con sal fija de app para no guardar el PIN en claro. */
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`ats:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface SecurityApi {
  config: SecurityConfig;
  /** Exige PIN si la puerta está activa y hay PIN. Devuelve true si autorizado. */
  requireAuth: (gate: SecurityGate) => Promise<boolean>;
}

const Ctx = createContext<SecurityApi | null>(null);

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SecurityConfig>(() => loadSecurity());
  const [gate, setGate] = useState<{ reason: string } | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  // Aplica en caliente la config que el catálogo cachea al refrescarse.
  useEffect(() => {
    const onUpdate = () => setConfig(loadSecurity());
    window.addEventListener(EVENT, onUpdate);
    return () => window.removeEventListener(EVENT, onUpdate);
  }, []);

  const prompt = useCallback((reason: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setGate({ reason });
    });
  }, []);

  const finish = useCallback((ok: boolean) => {
    setGate(null);
    const r = resolver.current;
    resolver.current = null;
    r?.(ok);
  }, []);

  const requireAuth = useCallback(
    (g: SecurityGate): Promise<boolean> => {
      if (!config.pinHash || !config.gates[g]) return Promise.resolve(true);
      return prompt(GATE_LABEL[g]);
    },
    [config, prompt],
  );

  const api = useMemo<SecurityApi>(() => ({ config, requireAuth }), [config, requireAuth]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {gate && <AuthGate reason={gate.reason} pinHash={config.pinHash} onResult={finish} />}
    </Ctx.Provider>
  );
}

export function useSecurity(): SecurityApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSecurity debe usarse dentro de <SecurityProvider>');
  return ctx;
}

/** Pide el PIN para autorizar una acción. */
function AuthGate({ reason, pinHash, onResult }: { reason: string; pinHash: string | null; onResult: (ok: boolean) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [verificando, setVerificando] = useState(false);

  async function verificar() {
    if (!pin || verificando) return;
    setVerificando(true);
    const h = await hashPin(pin);
    if (h === pinHash) {
      onResult(true);
    } else {
      setError(true);
      setPin('');
      setVerificando(false);
    }
  }

  return (
    <div className="modal-backdrop modal-backdrop--top">
      <div className="modal modal--sm">
        <h3>🔒 Autorización</h3>
        <p className="modal__sub">{reason} — ingresá el PIN de supervisor.</p>
        <input
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') void verificar(); if (e.key === 'Escape') onResult(false); }}
          autoFocus
          placeholder="••••"
        />
        {error && <p className="modal__hint modal__hint--warn">PIN incorrecto.</p>}
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={() => onResult(false)}>Cancelar</button>
          <button className="btn btn--primary" onClick={() => void verificar()} disabled={!pin || verificando}>Autorizar</button>
        </div>
      </div>
    </div>
  );
}
