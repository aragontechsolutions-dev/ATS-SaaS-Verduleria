import { getCfePdf } from '../lib/api';
import { formatMoney } from '../lib/format';
import type { OutboxSale } from '../lib/types';

interface Props {
  sale: OutboxSale;
  onClose: () => void;
}

const ESTADO_LABEL: Record<string, string> = {
  LOCAL: 'Ticket interno',
  ENVIANDO: 'Emitiendo…',
  NE: 'Emitido — esperando acuse DGI',
  AE: 'Aceptado por DGI',
  BE: 'Rechazado por DGI',
  CE: 'Observado por DGI',
  ERROR: 'Error de emisión',
};

/** Confirmación de venta con el estado del comprobante fiscal. */
export function TicketModal({ sale, onClose }: Props) {
  const cfe = sale.cfe;

  async function verPdf() {
    if (!cfe?.id) return;
    try {
      const blob = await getCfePdf(cfe.id, 'ticket80');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      /* sin conexión o sin PDF todavía */
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>✓ Venta registrada</h3>
        <div className="ticket__total">{formatMoney(sale.total)}</div>

        <div className="ticket__cfe">
          {sale.status !== 'synced' ? (
            <p className="pill pill--muted">Sin conexión — se sincroniza y emite al reconectar</p>
          ) : cfe && cfe.serie ? (
            <>
              <div className="ticket__row">
                <span>Comprobante</span>
                <strong>
                  {cfe.serie}-{cfe.numero}
                </strong>
              </div>
              {cfe.caeNumero && (
                <div className="ticket__row">
                  <span>CAE</span>
                  <span>{cfe.caeNumero}</span>
                </div>
              )}
              <div className="ticket__row">
                <span>Estado</span>
                <span>{ESTADO_LABEL[cfe.estado] ?? cfe.estado}</span>
              </div>
            </>
          ) : cfe && cfe.estado === 'LOCAL' ? (
            <p className="pill pill--muted">Ticket interno (sin CFE — régimen Monotributo)</p>
          ) : (
            <p className="pill pill--warn">Comprobante pendiente de emisión</p>
          )}
        </div>

        <div className="modal__actions">
          {cfe?.serie && (
            <button className="btn btn--ghost" onClick={verPdf}>
              Ver PDF
            </button>
          )}
          <button className="btn btn--primary" onClick={onClose}>
            Nueva venta
          </button>
        </div>
      </div>
    </div>
  );
}
