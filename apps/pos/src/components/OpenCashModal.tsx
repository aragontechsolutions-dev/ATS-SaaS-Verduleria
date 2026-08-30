import { useEffect, useState } from 'react';
import { getSucursales } from '../lib/api';
import type { Sucursal } from '../lib/api';
import { DenominationCounter } from './DenominationCounter';

interface Props {
  onConfirm: (montoApertura: number, sucursalId?: string, terminal?: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

const STORE_KEY = 'ats.pos.sucursal';
const TERMINAL_KEY = 'ats.pos.terminal';

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

/** Apertura de caja: fondo inicial y sucursal donde se va a operar el turno. */
export function OpenCashModal({ onConfirm, onCancel, loading }: Props) {
  const [valor, setValor] = useState('');
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalId, setSucursalId] = useState('');
  // Caja física / terminal (por dispositivo). Se recuerda para la próxima apertura.
  const [terminal, setTerminal] = useState(() => loadTerminal());
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

  function confirm() {
    const elegida = sucursales.length > 1 ? sucursalId : undefined;
    if (elegida) {
      try {
        localStorage.setItem(STORE_KEY, elegida);
      } catch {
        // localStorage no disponible: no es crítico.
      }
    }
    const term = terminal.trim();
    try {
      if (term) localStorage.setItem(TERMINAL_KEY, term);
      else localStorage.removeItem(TERMINAL_KEY);
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

        <label className="field">
          Caja / terminal (opcional)
          <input
            type="text"
            value={terminal}
            onChange={(e) => setTerminal(e.target.value)}
            placeholder="ej. Caja 1"
            maxLength={40}
          />
        </label>

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
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={confirm} disabled={loading}>
            {loading ? 'Abriendo…' : 'Abrir caja'}
          </button>
        </div>
      </div>
    </div>
  );
}
