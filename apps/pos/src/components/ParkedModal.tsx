import { useEffect, useState } from 'react';
import type { ParkedTicket } from '../state/cart';
import { cartTotals } from '../state/cart';
import { getParkedTickets, deleteParked } from '../lib/db';
import { formatMoney } from '../lib/format';

interface Props {
  onResume: (t: ParkedTicket) => void;
  onClose: () => void;
  onChange?: () => void;
}

/** Lista de tickets suspendidos (venta en espera): retomar o descartar. */
export function ParkedModal({ onResume, onClose, onChange }: Props) {
  const [tickets, setTickets] = useState<ParkedTicket[] | null>(null);

  const cargar = () => getParkedTickets().then(setTickets).catch(() => setTickets([]));
  useEffect(() => { void cargar(); }, []);

  async function descartar(id: string) {
    await deleteParked(id);
    await cargar();
    onChange?.();
  }

  return (
    <div className="modal-backdrop">
      <div className="modal modal--wide modal--tall">
        <div className="modal__head">
          <h3>Ventas en espera</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Cerrar</button>
        </div>

        {!tickets ? (
          <p className="modal__sub">Cargando…</p>
        ) : tickets.length === 0 ? (
          <p className="empty">No hay ventas en espera.</p>
        ) : (
          <div className="parked">
            {tickets.map((t) => {
              const total = cartTotals({ items: t.items, globalDiscount: t.globalDiscount }).total;
              const nItems = t.items.length;
              return (
                <div className="parked__row" key={t.id}>
                  <div className="parked__info">
                    <span className="parked__label">{t.label}</span>
                    <span className="parked__meta">
                      {nItems} {nItems === 1 ? 'ítem' : 'ítems'}
                      {t.customer ? ` · ${t.customer.nombre}` : ''} · {new Date(t.createdAt).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <strong className="parked__total">{formatMoney(total)}</strong>
                  <div className="parked__actions">
                    <button className="btn btn--ghost btn--sm" onClick={() => void descartar(t.id)}>Descartar</button>
                    <button className="btn btn--accent btn--sm" onClick={() => onResume(t)}>Retomar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
