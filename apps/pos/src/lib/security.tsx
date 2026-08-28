import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// ============================================================================
// Permisos por PIN (autorización de supervisor). Local por dispositivo: el PIN
// se guarda HASHEADO en localStorage y se exige para acciones sensibles según
// una configuración de puertas (gates). Funciona offline. No es criptografía
// fuerte (un técnico con devtools puede sortearlo), pero es un control real
// frente al cajero. Se puede migrar a verificación por usuario/rol más adelante.
// ============================================================================

export type SecurityGate = 'discount' | 'void' | 'return';

export interface SecurityConfig {
  /** SHA-256 del PIN (o null si no hay PIN configurado). */
  pinHash: string | null;
  /** Qué acciones exigen PIN. Solo aplican si hay un PIN configurado. */
  gates: Record<SecurityGate, boolean>;
}

const KEY = 'ats.pos.security';

const DEFAULT_CONFIG: SecurityConfig = {
  pinHash: null,
  gates: { discount: false, void: false, return: false },
};

export const GATE_LABEL: Record<SecurityGate, string> = {
  discount: 'Aplicar descuento',
  void: 'Vaciar el carrito',
  return: 'Registrar devolución',
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

function saveSecurity(c: SecurityConfig): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
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
  /** Abre la configuración de seguridad (pide PIN si ya hay uno). */
  openSettings: () => void;
}

const Ctx = createContext<SecurityApi | null>(null);

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SecurityConfig>(() => loadSecurity());
  const [gate, setGate] = useState<{ reason: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const persist = useCallback((c: SecurityConfig) => { setConfig(c); saveSecurity(c); }, []);

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

  const openSettings = useCallback(async () => {
    if (config.pinHash) {
      const ok = await prompt('Configuración de seguridad');
      if (!ok) return;
    }
    setSettingsOpen(true);
  }, [config.pinHash, prompt]);

  const api = useMemo<SecurityApi>(() => ({ config, requireAuth, openSettings }), [config, requireAuth, openSettings]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {gate && <AuthGate reason={gate.reason} pinHash={config.pinHash} onResult={finish} />}
      {settingsOpen && (
        <SecuritySettingsModal config={config} onSave={persist} onClose={() => setSettingsOpen(false)} />
      )}
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

const GATES: SecurityGate[] = ['discount', 'void', 'return'];

/** Configura el PIN de supervisor y qué acciones lo requieren. */
function SecuritySettingsModal({
  config,
  onSave,
  onClose,
}: {
  config: SecurityConfig;
  onSave: (c: SecurityConfig) => void;
  onClose: () => void;
}) {
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [gates, setGates] = useState<Record<SecurityGate, boolean>>({ ...config.gates });
  const [error, setError] = useState<string | null>(null);
  const tienePin = !!config.pinHash;

  async function guardar() {
    let pinHash = config.pinHash;
    if (pin || pin2 || !tienePin) {
      // Se está fijando o cambiando el PIN.
      if (pin.length < 4) return setError('El PIN debe tener al menos 4 dígitos.');
      if (pin !== pin2) return setError('Los PIN no coinciden.');
      pinHash = await hashPin(pin);
    }
    if (!pinHash && Object.values(gates).some(Boolean)) {
      return setError('Configurá un PIN para poder exigir autorización.');
    }
    onSave({ pinHash, gates });
    onClose();
  }

  function quitarPin() {
    onSave({ pinHash: null, gates: { discount: false, void: false, return: false } });
    onClose();
  }

  return (
    <div className="modal-backdrop modal-backdrop--top">
      <div className="modal">
        <h3>Seguridad · PIN de supervisor</h3>
        <p className="modal__sub">
          {tienePin ? 'Hay un PIN configurado. Dejá los campos vacíos para conservarlo.' : 'Definí un PIN para exigir autorización en acciones sensibles.'}
        </p>

        <div className="row2">
          <label className="field">
            {tienePin ? 'Nuevo PIN' : 'PIN'}
            <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => { setPin(e.target.value); setError(null); }} placeholder="4+ dígitos" />
          </label>
          <label className="field">
            Repetir
            <input type="password" inputMode="numeric" autoComplete="off" value={pin2} onChange={(e) => { setPin2(e.target.value); setError(null); }} />
          </label>
        </div>

        <p className="modal__hint">Acciones que exigen PIN:</p>
        {GATES.map((g) => (
          <label key={g} className="chk-row">
            <input type="checkbox" checked={gates[g]} onChange={(e) => setGates((x) => ({ ...x, [g]: e.target.checked }))} />
            {GATE_LABEL[g]}
          </label>
        ))}

        {error && <p className="modal__hint modal__hint--warn">{error}</p>}

        <div className="modal__actions modal__actions--wrap">
          {tienePin && <button className="btn btn--ghost" onClick={quitarPin}>Quitar PIN</button>}
          <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={() => void guardar()}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
