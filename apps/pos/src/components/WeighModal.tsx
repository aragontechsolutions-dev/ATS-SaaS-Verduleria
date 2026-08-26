import { useState } from 'react';
import type { CatalogProduct } from '../lib/types';
import type { ScaleReading } from '../lib/scale';
import { formatMoney } from '../lib/format';

interface Props {
  product: CatalogProduct;
  /** Lectura de la balanza en vivo (si hay una conectada). */
  liveReading?: ScaleReading | null;
  onConfirm: (cantidad: number) => void;
  onCancel: () => void;
}

/**
 * Ingreso de peso/cantidad. Si hay una balanza en vivo conectada, muestra el
 * peso en tiempo real y permite tomarlo con un toque; si no, el cajero lo
 * escribe. El POS calcula el precio con el catálogo del día.
 */
export function WeighModal({ product, liveReading, onConfirm, onCancel }: Props) {
  const esPeso = product.unidadVenta === 'KG' || product.unidadVenta === 'GRAMO';
  const [valor, setValor] = useState('');

  const cantidad = parseFloat(valor.replace(',', '.')) || 0;
  const total = cantidad * product.precio;
  const unidadLabel = product.unidadVenta.toLowerCase();
  const live = esPeso && liveReading && liveReading.weightKg > 0 ? liveReading : null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{product.nombre}</h3>
        <p className="modal__sub">
          {formatMoney(product.precio)} / {unidadLabel}
        </p>

        {live && (
          <button
            type="button"
            className={`scale-read ${live.stable ? 'is-stable' : ''}`}
            onClick={() => onConfirm(live.weightKg)}
            title="Tomar el peso de la balanza"
          >
            <span className="scale-read__w">{live.weightKg.toFixed(3)} kg</span>
            <span className="scale-read__hint">
              {live.stable ? 'Balanza estable · tocá para usar' : 'Estabilizando…'}
            </span>
          </button>
        )}

        <label className="field">
          {esPeso ? 'Peso (kg)' : `Cantidad (${unidadLabel})`}
          <input
            type="number"
            inputMode="decimal"
            step={esPeso ? '0.001' : '1'}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && cantidad > 0) onConfirm(cantidad);
            }}
          />
        </label>

        <div className="modal__total">Subtotal: {formatMoney(total)}</div>

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={() => onConfirm(cantidad)} disabled={cantidad <= 0}>
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
