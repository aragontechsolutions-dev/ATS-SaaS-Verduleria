import { getCfePdf } from '../lib/api';
import { formatMoney } from '../lib/format';
import { printBoleta } from '../lib/boleta';
import type { OutboxSale } from '../lib/types';

interface Props {
  sale: OutboxSale;
  onClose: () => void;
}

const MEDIO_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo', DEBITO: 'Débito', CREDITO: 'Crédito', MERCADO_PAGO: 'QR / MP',
  TRANSFERENCIA: 'Transferencia', DINERO_ELECTRONICO: 'Dinero electrónico', CUENTA_CORRIENTE: 'Cuenta corriente',
};

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
  const vuelto = sale.vuelto ?? 0;
  // Boleta: para el efectivo mostramos lo recibido (aplicado + vuelto).
  const mixto = sale.payments.length > 1;

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
    <div className="modal-backdrop">
      <div className="modal">
        <h3>✓ Venta registrada</h3>
        <div className="ticket__total">{formatMoney(sale.total)}</div>

        {(mixto || vuelto > 0) && (
          <div className="ticket__pagos">
            {sale.payments.map((p, i) => (
              <div key={i} className="ticket__row">
                <span>{MEDIO_LABEL[p.medio] ?? p.medio}</span>
                <span>{formatMoney(p.medio === 'EFECTIVO' ? p.monto + vuelto : p.monto)}</span>
              </div>
            ))}
            {vuelto > 0 && (
              <div className="ticket__row ticket__row--vuelto">
                <span>Vuelto</span>
                <strong>{formatMoney(vuelto)}</strong>
              </div>
            )}
          </div>
        )}

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

        <div className="modal__actions modal__actions--wrap">
          <button className="btn btn--ghost" onClick={() => printBoleta(sale)}>
            🖨 Imprimir boleta
          </button>
          {cfe?.serie && (
            <button className="btn btn--ghost" onClick={verPdf}>
              Ver PDF fiscal
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
