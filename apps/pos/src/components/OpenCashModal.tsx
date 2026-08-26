import { useEffect, useState } from 'react';
import { getSucursales } from '../lib/api';
import type { Sucursal } from '../lib/api';

interface Props {
  onConfirm: (montoApertura: number, sucursalId?: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

const STORE_KEY = 'ats.pos.sucursal';

function loadSaved(): string {
  try {
    return localStorage.getItem(STORE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Apertura de caja: fondo inicial y sucursal donde se va a operar el turno. */
export function OpenCashModal({ onConfirm, onCancel, loading }: Props) {
  const [valor, setValor] = useState('');
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalId, setSucursalId] = useState('');

  const monto = parseFloat(valor.replace(',', '.')) || 0;

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
    onConfirm(monto, elegida);
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
