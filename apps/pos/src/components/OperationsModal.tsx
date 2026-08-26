import { useEffect, useState } from 'react';
import { getAllSales } from '../lib/db';
import { printBoleta } from '../lib/boleta';
import { formatMoney } from '../lib/format';
import type { OutboxSale } from '../lib/types';
import { BoletaPreviewModal } from './BoletaPreviewModal';

interface Props {
  /** Turno actual: si viene, solo se muestran las operaciones de ese turno. */
  sessionId?: string;
  onClose: () => void;
}

const ESTADO: Record<string, { txt: string; cls: string }> = {
  pending: { txt: 'Pendiente', cls: 'pill--warn' },
  syncing: { txt: 'Sincronizando', cls: 'pill--info' },
  synced: { txt: 'Sincronizada', cls: 'pill--ok' },
  error: { txt: 'Error', cls: 'pill--warn' },
};

const medios = (s: OutboxSale) => [...new Set(s.payments.map((p) => p.medio.toLowerCase().replace(/_/g, ' ')))].join(', ');

/** Operaciones realizadas: lista de ventas del dispositivo con su boleta. */
export function OperationsModal({ sessionId, onClose }: Props) {
  const [sales, setSales] = useState<OutboxSale[] | null>(null);
  const [detalle, setDetalle] = useState<OutboxSale | null>(null);

  useEffect(() => {
    getAllSales()
      .then((all) => setSales(sessionId ? all.filter((s) => s.cashSessionId === sessionId) : all))
      .catch(() => setSales([]));
  }, [sessionId]);

  return (
    <div className="modal-backdrop">
      <div className="modal modal--wide modal--tall">
        <div className="modal__head">
          <h3>Operaciones del turno</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Cerrar</button>
        </div>

        {!sales ? (
          <p className="modal__sub">Cargando…</p>
        ) : sales.length === 0 ? (
          <p className="empty">Todavía no hay operaciones en este turno.</p>
        ) : (
          <div className="ops">
            {sales.map((s) => {
              const est = ESTADO[s.status] ?? ESTADO.synced;
              const comp = s.cfe?.serie ? `${s.cfe.serie}-${s.cfe.numero}` : 'Ticket interno';
              return (
                <div className="ops__row" key={s.id}>
                  <div className="ops__info">
                    <span className="ops__date">{new Date(s.fecha ?? s.createdAt).toLocaleString('es-UY')}</span>
                    <span className="ops__meta">{comp} · {medios(s) || '—'}</span>
                  </div>
                  <span className={`pill ${est.cls}`}>{est.txt}</span>
                  <strong className="ops__total">{formatMoney(s.total)}</strong>
                  <div className="ops__actions">
                    <button className="btn btn--ghost btn--sm" onClick={() => printBoleta(s)}>🖨</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setDetalle(s)}>Ver</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detalle && <BoletaPreviewModal sale={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}
