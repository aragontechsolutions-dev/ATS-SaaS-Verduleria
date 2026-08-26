import { boletaHtml, printBoleta } from '../lib/boleta';
import type { OutboxSale } from '../lib/types';

interface Props {
  sale: OutboxSale;
  onClose: () => void;
}

/** Previsualización de la boleta (render real 80mm) con opción de imprimir. */
export function BoletaPreviewModal({ sale, onClose }: Props) {
  return (
    <div className="modal-backdrop">
      <div className="modal modal--tall">
        <div className="modal__head">
          <h3>Boleta</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Cerrar</button>
        </div>
        <div className="boleta-prev">
          <iframe className="boleta-prev__frame" title="Boleta" srcDoc={boletaHtml(sale)} />
        </div>
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose}>Cerrar</button>
          <button className="btn btn--primary" onClick={() => printBoleta(sale)}>🖨 Imprimir</button>
        </div>
      </div>
    </div>
  );
}
