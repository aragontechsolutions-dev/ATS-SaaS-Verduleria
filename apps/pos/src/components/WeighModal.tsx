import { useMemo, useState } from 'react';
import type { CatalogProduct } from '../lib/types';
import { formatMoney } from '../lib/format';

interface Props {
  product: CatalogProduct;
  onConfirm: (cantidad: number) => void;
  onCancel: () => void;
}

type Modo = 'peso' | 'importe';

/**
 * Ingreso manual para productos pesables, pensado para balanzas que muestran
 * peso y precio pero NO imprimen etiqueta con código de barras.
 *
 * Dos modos:
 *  - "Por peso": el cajero escribe los kg que muestra la balanza → el POS
 *    calcula el precio con el catálogo del día.
 *  - "Por importe": el cajero escribe el $ que muestra la balanza → el POS
 *    deriva el peso (importe / precio) para que el total coincida exacto.
 *
 * Para unidades no ponderables (unidad, atado) solo se pide cantidad.
 */
export function WeighModal({ product, onConfirm, onCancel }: Props) {
  const esPeso = product.unidadVenta === 'KG' || product.unidadVenta === 'GRAMO';
  const [modo, setModo] = useState<Modo>('peso');
  const [valor, setValor] = useState('');

  const num = parseFloat(valor.replace(',', '.')) || 0;

  // cantidad = lo que se persiste como cantidad de la línea (en la unidad de venta).
  const { cantidad, total, pesoDerivado } = useMemo(() => {
    if (!esPeso) return { cantidad: num, total: num * product.precio, pesoDerivado: null };
    if (modo === 'peso') return { cantidad: num, total: num * product.precio, pesoDerivado: null };
    // modo importe: derivar peso desde el importe.
    const kg = product.precio > 0 ? num / product.precio : 0;
    return { cantidad: kg, total: num, pesoDerivado: kg };
  }, [esPeso, modo, num, product.precio]);

  const puedeConfirmar = cantidad > 0 && (modo === 'peso' ? true : product.precio > 0);
  const unidadLabel = product.unidadVenta.toLowerCase();

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{product.nombre}</h3>
        <p className="modal__sub">
          {formatMoney(product.precio)} / {unidadLabel}
        </p>

        {esPeso && (
          <div className="segmented">
            <button className={`seg ${modo === 'peso' ? 'seg--on' : ''}`} onClick={() => setModo('peso')}>
              ⚖ Por peso (kg)
            </button>
            <button className={`seg ${modo === 'importe' ? 'seg--on' : ''}`} onClick={() => setModo('importe')}>
              💲 Por importe
            </button>
          </div>
        )}

        <label className="field">
          {!esPeso ? `Cantidad (${unidadLabel})` : modo === 'peso' ? 'Peso (kg)' : 'Importe que muestra la balanza ($)'}
          <input
            type="number"
            inputMode="decimal"
            step={!esPeso ? '1' : modo === 'peso' ? '0.001' : '0.01'}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && puedeConfirmar) onConfirm(cantidad);
            }}
          />
        </label>

        {esPeso && modo === 'importe' && pesoDerivado != null && (
          <div className="modal__hint">≈ {pesoDerivado.toFixed(3)} kg</div>
        )}

        <div className="modal__total">{modo === 'importe' ? 'Total' : 'Subtotal'}: {formatMoney(total)}</div>

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={() => onConfirm(cantidad)} disabled={!puedeConfirmar}>
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
