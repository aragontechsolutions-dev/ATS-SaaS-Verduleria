import { useState } from 'react';
import type { CatalogProduct } from '../lib/types';
import { formatMoney } from '../lib/format';

interface Props {
  product: CatalogProduct;
  onConfirm: (cantidad: number) => void;
  onCancel: () => void;
}

/**
 * Ingreso manual para balanzas que muestran el peso pero no imprimen etiqueta.
 * El cajero escribe solo el peso (o la cantidad en unidades) y el POS calcula
 * el precio con el catálogo del día.
 */
export function WeighModal({ product, onConfirm, onCancel }: Props) {
  const esPeso = product.unidadVenta === 'KG' || product.unidadVenta === 'GRAMO';
  const [valor, setValor] = useState('');

  const cantidad = parseFloat(valor.replace(',', '.')) || 0;
  const total = cantidad * product.precio;
  const unidadLabel = product.unidadVenta.toLowerCase();

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{product.nombre}</h3>
        <p className="modal__sub">
          {formatMoney(product.precio)} / {unidadLabel}
        </p>

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
