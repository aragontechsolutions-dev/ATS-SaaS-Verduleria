import { useState } from 'react';
import { addCashMovement } from '../lib/api';
import type { CashMovementTipo } from '../lib/types';

interface Props {
  sessionId: string;
  /** Tipo inicial (ej. abrir directo en modo Sangría). */
  initialTipo?: CashMovementTipo;
  onDone: (tipo: CashMovementTipo, monto: number, motivo: string) => void;
  onCancel: () => void;
}

/** Ingreso, egreso o sangría de efectivo de la caja (no es una venta). */
export function CashMovementModal({ sessionId, initialTipo = 'EGRESO', onDone, onCancel }: Props) {
  const [tipo, setTipo] = useState<CashMovementTipo>(initialTipo);
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const valor = parseFloat(monto.replace(',', '.')) || 0;

  async function confirmar() {
    if (valor <= 0) { setError('Ingresá un monto mayor a 0'); return; }
    setGuardando(true);
    setError(null);
    try {
      await addCashMovement(sessionId, tipo, valor, motivo.trim() || undefined);
      onDone(tipo, valor, motivo.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setGuardando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{tipo === 'SANGRIA' ? 'Sangría de caja' : 'Movimiento de caja'}</h3>
        <p className="modal__sub">
          {tipo === 'SANGRIA'
            ? 'Retiro de efectivo del cajón hacia la caja fuerte (por seguridad). Queda registrado.'
            : 'Registrá dinero que entra o sale de la caja sin ser una venta.'}
        </p>

        <div className="medios">
          <button className={`medio ${tipo === 'INGRESO' ? 'medio--on' : ''}`} onClick={() => setTipo('INGRESO')}>
            ➕ Ingreso
          </button>
          <button className={`medio ${tipo === 'EGRESO' ? 'medio--on' : ''}`} onClick={() => setTipo('EGRESO')}>
            ➖ Egreso
          </button>
          <button className={`medio ${tipo === 'SANGRIA' ? 'medio--on' : ''}`} onClick={() => setTipo('SANGRIA')}>
            🔻 Sangría
          </button>
        </div>

        <label className="field">
          Monto ($)
          <input
            type="number"
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') confirmar(); }}
          />
        </label>
        <label className="field">
          Motivo
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={tipo === 'SANGRIA' ? 'ej. retiro a caja fuerte, depósito bancario…' : 'ej. pago a proveedor, retiro, vuelto inicial…'} />
        </label>

        {error && <p className="modal__err">{error}</p>}
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancel} disabled={guardando}>Cancelar</button>
          <button className="btn btn--primary" onClick={confirmar} disabled={guardando || valor <= 0}>
            {guardando ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
