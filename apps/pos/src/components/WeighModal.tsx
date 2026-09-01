import { useState } from 'react';
import type { CatalogProduct } from '../lib/types';
import type { ScaleReading } from '../lib/scale';
import type { WeightBarcodeConfig } from '../lib/barcode';
import { formatMoney } from '../lib/format';
import { buildLabelData, type LabelData } from '../lib/etiqueta';
import { loadPrinterConfig, printLabel } from '../lib/printer';

interface Props {
  product: CatalogProduct;
  /** Lectura de la balanza en vivo (si hay una conectada). */
  liveReading?: ScaleReading | null;
  /** Formato del EAN de peso variable (para imprimir la etiqueta). */
  barcodeConfig: WeightBarcodeConfig;
  /** Nombre a mostrar en la etiqueta (sucursal/negocio). */
  negocio?: string | null;
  onConfirm: (cantidad: number) => void;
  onCancel: () => void;
}

/**
 * Ingreso de peso/cantidad. Si hay una balanza en vivo conectada, muestra el
 * peso en tiempo real y permite tomarlo con un toque; si no, el cajero lo
 * escribe. El POS calcula el precio con el catálogo del día.
 */
export function WeighModal({ product, liveReading, barcodeConfig, negocio, onConfirm, onCancel }: Props) {
  const esPeso = product.unidadVenta === 'KG' || product.unidadVenta === 'GRAMO';
  const [valor, setValor] = useState('');
  const [labelMsg, setLabelMsg] = useState<string | null>(null);

  const cantidad = parseFloat(valor.replace(',', '.')) || 0;
  const total = cantidad * product.precio;
  const unidadLabel = product.unidadVenta.toLowerCase();
  const live = esPeso && liveReading && liveReading.weightKg > 0 ? liveReading : null;

  // Se puede imprimir etiqueta de balanza si es pesable y tiene PLU.
  const puedeEtiqueta = esPeso && product.plu != null;

  async function imprimirEtiqueta() {
    const data: LabelData | null = buildLabelData(product, cantidad, barcodeConfig, negocio ?? undefined);
    if (!data) {
      setLabelMsg('No se pudo armar la etiqueta (falta PLU o el código no entra en el formato).');
      return;
    }
    try {
      const ok = await printLabel(data, loadPrinterConfig());
      setLabelMsg(ok ? `Etiqueta impresa · ${data.ean}` : 'El navegador bloqueó la ventana de impresión.');
    } catch {
      setLabelMsg('No se pudo imprimir la etiqueta.');
    }
  }

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

        {puedeEtiqueta && (
          <div className="weigh-label">
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={() => void imprimirEtiqueta()}
              disabled={cantidad <= 0}
              title="Imprime una etiqueta con el código de barras de peso para pegar en la bolsa"
            >
              🏷️ Imprimir etiqueta
            </button>
            {labelMsg && <p className="weigh-label__msg">{labelMsg}</p>}
          </div>
        )}

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
