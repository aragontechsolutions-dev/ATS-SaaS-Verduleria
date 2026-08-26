import { useState } from 'react';
import { addCashMovement } from '../lib/api';
import type { CashMovementTipo } from '../lib/types';

interface Props {
  sessionId: string;
  onDone: (tipo: CashMovementTipo, monto: number, motivo: string) => void;
  onCancel: () => void;
}

/** Ingreso o egreso de efectivo de la caja que NO es una venta (aporte/retiro). */
export function CashMovementModal({ sessionId, onDone, onCancel }: Props) {
  const [tipo, setTipo] = useState<CashMovementTipo>('EGRESO');
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
        <h3>Movimiento de caja</h3>
        <p className="modal__sub">Registrá dinero que entra o sale de la caja sin ser una venta.</p>

        <div className="medios">
          <button className={`medio ${tipo === 'INGRESO' ? 'medio--on' : ''}`} onClick={() => setTipo('INGRESO')}>
            ➕ Ingreso (aporte)
          </button>
          <button className={`medio ${tipo === 'EGRESO' ? 'medio--on' : ''}`} onClick={() => setTipo('EGRESO')}>
            ➖ Egreso (retiro/pago)
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
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ej. pago a proveedor, retiro, vuelto inicial…" />
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
