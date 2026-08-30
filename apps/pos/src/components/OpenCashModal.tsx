import { useEffect, useState } from 'react';
import { getMyTerminals, getSucursales } from '../lib/api';
import type { PosTerminal, Sucursal } from '../lib/api';
import { DenominationCounter } from './DenominationCounter';

interface Props {
  onConfirm: (montoApertura: number, sucursalId?: string, terminalId?: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

const STORE_KEY = 'ats.pos.sucursal';
const TERMINAL_KEY = 'ats.pos.terminalId';

function loadSaved(): string {
  try {
    return localStorage.getItem(STORE_KEY) ?? '';
  } catch {
    return '';
  }
}

function loadTerminal(): string {
  try {
    return localStorage.getItem(TERMINAL_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Apertura de caja: fondo inicial, sucursal y caja donde se opera el turno. */
export function OpenCashModal({ onConfirm, onCancel, loading }: Props) {
  const [valor, setValor] = useState('');
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalId, setSucursalId] = useState('');
  // Cajas gestionadas que este cajero puede operar (según la sucursal elegida).
  const [terminals, setTerminals] = useState<PosTerminal[]>([]);
  const [terminalId, setTerminalId] = useState('');
  // El comercio tiene cajas definidas (aunque este cajero no tenga ninguna).
  const [hayCajas, setHayCajas] = useState(false);
  // Modo de conteo: total directo o desglose por denominación.
  const [porDenom, setPorDenom] = useState(false);
  const [denomTotal, setDenomTotal] = useState(0);

  const monto = porDenom ? denomTotal : parseFloat(valor.replace(',', '.')) || 0;

  useEffect(() => {
    let vivo = true;
    void getSucursales()
      .then((list) => {
        if (!vivo) return;
        const activas = list.filter((s) => s.activo);
        setSucursales(activas);
        const saved = loadSaved();
        const inicial = activas.find((s) => s.id === saved)?.id ?? activas[0]?.id ?? '';
        setSucursalId(inicial);
      })
      .catch(() => {
        // Sin conexión / sin permisos: seguimos con la sucursal principal (backend).
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Carga las cajas operables cuando cambia la sucursal (o al montar).
  useEffect(() => {
    let vivo = true;
    void getMyTerminals(sucursalId || undefined)
      .then((res) => {
        if (!vivo) return;
        setTerminals(res.terminals);
        setHayCajas(res.hayCajas);
        const saved = loadTerminal();
        setTerminalId(res.terminals.find((t) => t.id === saved)?.id ?? res.terminals[0]?.id ?? '');
      })
      .catch(() => {
        if (vivo) { setTerminals([]); setHayCajas(false); }
      });
    return () => {
      vivo = false;
    };
  }, [sucursalId]);

  // El comercio tiene cajas pero este cajero no puede operar ninguna → bloqueado.
  const sinCajaHabilitada = hayCajas && terminals.length === 0;
  // Si hay cajas para operar, elegir una es obligatorio.
  const faltaCaja = terminals.length > 0 && !terminalId;
  const bloqueado = sinCajaHabilitada || faltaCaja;

  function confirm() {
    if (bloqueado) return;
    const elegida = sucursales.length > 1 ? sucursalId : undefined;
    if (elegida) {
      try {
        localStorage.setItem(STORE_KEY, elegida);
      } catch {
        // localStorage no disponible: no es crítico.
      }
    }
    const term = terminals.length > 0 ? terminalId : '';
    try {
      if (term) localStorage.setItem(TERMINAL_KEY, term);
    } catch {
      // localStorage no disponible: no es crítico.
    }
    onConfirm(monto, elegida, term || undefined);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Abrir caja</h3>
        <p className="modal__sub">Ingresá el fondo inicial de efectivo.</p>

        {sucursales.length > 1 && (
          <label className="field">
            Sucursal
            <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
        )}

        {terminals.length > 0 && (
          <label className="field">
            Caja
            <select value={terminalId} onChange={(e) => setTerminalId(e.target.value)}>
              {terminals.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                  {sucursales.length > 1 ? ` · ${t.sucursalNombre}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        {sinCajaHabilitada ? (
          <p className="modal__hint modal__hint--warn">
            No tenés una caja asignada para operar. Pedile al administrador que te habilite una desde el Panel (Caja → Cajas).
          </p>
        ) : (
        <>
        <div className="seg">
          <button type="button" className={`seg__btn ${!porDenom ? 'is-on' : ''}`} onClick={() => setPorDenom(false)}>Total</button>
          <button type="button" className={`seg__btn ${porDenom ? 'is-on' : ''}`} onClick={() => setPorDenom(true)}>Por denominación</button>
        </div>

        {porDenom ? (
          <>
            <p className="modal__sub">Contá los billetes y monedas del fondo inicial.</p>
            <DenominationCounter onTotal={setDenomTotal} />
          </>
        ) : (
          <label className="field">
            Fondo de apertura ($)
            <input
              type="number"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirm();
              }}
            />
          </label>
        )}
        </>
        )}
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          {!sinCajaHabilitada && (
            <button className="btn btn--primary" onClick={confirm} disabled={loading || bloqueado}>
              {loading ? 'Abriendo…' : 'Abrir caja'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
