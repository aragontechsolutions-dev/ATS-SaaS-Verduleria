import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CartItem, MedioPago, OutboxSale } from '../lib/types';
import { formatMoney, formatQty } from '../lib/format';
import { postDevolucion, emitCfe, type DevolucionItemPayload } from '../lib/api';
import { enqueueSale } from '../lib/db';

interface Props {
  sale: OutboxSale;
  cashSessionId?: string;
  onDone: (montoDevuelto: number) => void;
  onClose: () => void;
}

const MEDIOS: Array<{ key: MedioPago; label: string }> = [
  { key: 'EFECTIVO', label: 'Efectivo' },
  { key: 'DEBITO', label: 'Débito' },
  { key: 'CREDITO', label: 'Crédito' },
  { key: 'MERCADO_PAGO', label: 'QR / MP' },
  { key: 'TRANSFERENCIA', label: 'Transferencia' },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Devolución de ítems de una venta ya sincronizada (emite nota de crédito). */
export function DevolucionModal({ sale, cashSessionId, onDone, onClose }: Props) {
  // Cantidad a devolver por línea (índice → cantidad).
  const [ret, setRet] = useState<Record<number, number>>({});
  const [medio, setMedio] = useState<MedioPago>(sale.payments[0]?.medio ?? 'EFECTIVO');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setQty(i: number, v: number) {
    const max = sale.items[i].cantidad;
    const q = Math.min(Math.max(0, v), max);
    setRet((r) => ({ ...r, [i]: q }));
  }

  // Importe de una línea devuelta = proporción del total de esa línea.
  function lineRefund(it: CartItem, cantidadRet: number): number {
    if (cantidadRet <= 0) return 0;
    const frac = cantidadRet / it.cantidad;
    const descProp = (it.descuento ?? 0) * frac;
    return round2(cantidadRet * it.precioUnit - descProp);
  }

  const total = round2(sale.items.reduce((s, it, i) => s + lineRefund(it, ret[i] ?? 0), 0));
  const hayAlgo = total > 0;

  async function confirmar() {
    if (!hayAlgo || enviando) return;
    if (!navigator.onLine) {
      setError('La devolución necesita conexión (referencia el comprobante original).');
      return;
    }
    if (!sale.serverId) {
      setError('La venta original todavía no se sincronizó. Esperá a que suba.');
      return;
    }
    setEnviando(true);
    setError(null);

    const idempotencyKey = uuidv4();
    const seleccion = sale.items
      .map((it, i) => ({ it, i, q: ret[i] ?? 0 }))
      .filter((x) => x.q > 0);

    const items: DevolucionItemPayload[] = seleccion.map(({ it, q }) => ({
      productId: it.productId,
      concepto: it.concepto,
      unidad: it.unidad,
      cantidad: q,
      precioUnit: it.precioUnit,
      descuento: round2((it.descuento ?? 0) * (q / it.cantidad)),
      ivaIndicador: it.ivaIndicador,
    }));

    try {
      const resp = await postDevolucion({
        idempotencyKey,
        originalSaleId: sale.serverId,
        cashSessionId,
        medio,
        motivo: motivo.trim() || undefined,
        items,
      });

      // Emitir la nota de crédito (best-effort).
      let cfe;
      try {
        cfe = await emitCfe(resp.id);
      } catch {
        /* la NC se puede reintentar */
      }

      // Guardar la devolución local (para verla/reimprimirla en Operaciones).
      const devItems: CartItem[] = seleccion.map(({ it, q }) => ({
        productId: it.productId,
        concepto: it.concepto,
        unidad: it.unidad,
        cantidad: -q,
        precioUnit: it.precioUnit,
        ivaIndicador: it.ivaIndicador,
        descuento: round2((it.descuento ?? 0) * (q / it.cantidad)) || undefined,
        esPesable: it.esPesable,
      }));
      await enqueueSale({
        id: idempotencyKey,
        fecha: new Date().toISOString(),
        cashSessionId,
        items: devItems,
        payments: [{ medio, monto: -total }],
        total: -total,
        esDevolucion: true,
        referenciaSaleId: sale.serverId,
        status: 'synced',
        serverId: resp.id,
        cfe,
        intentos: 0,
        createdAt: Date.now(),
      });

      onDone(total);
    } catch (e) {
      setError(e instanceof Error && e.message.includes('supera') ? 'Algún ítem supera lo disponible para devolver.' : 'No se pudo registrar la devolución.');
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal modal--wide modal--tall">
        <div className="modal__head">
          <h3>Devolución</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Cerrar</button>
        </div>
        <p className="modal__sub">
          Elegí qué devolver de la venta {sale.cfe?.serie ? `${sale.cfe.serie}-${sale.cfe.numero}` : ''}. Se emite una nota de crédito.
        </p>

        <div className="dev-list">
          {sale.items.map((it, i) => {
            const q = ret[i] ?? 0;
            return (
              <div key={i} className={`dev-row ${q > 0 ? 'is-on' : ''}`}>
                <div className="dev-row__info">
                  <span className="dev-row__name">{it.concepto}</span>
                  <span className="dev-row__sub">Vendido: {formatQty(it.cantidad, it.unidad)} × {formatMoney(it.precioUnit)}</span>
                </div>
                <div className="dev-row__qty">
                  <button onClick={() => setQty(i, q - 1)} aria-label="Menos">−</button>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={it.cantidad}
                    step={it.esPesable ? 0.001 : 1}
                    value={q || ''}
                    onChange={(e) => setQty(i, parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button onClick={() => setQty(i, it.cantidad)} title="Todo" aria-label="Todo">⤒</button>
                </div>
                <span className="dev-row__refund">{formatMoney(lineRefund(it, q))}</span>
              </div>
            );
          })}
        </div>

        <label className="field">
          Reintegrar por
          <select value={medio} onChange={(e) => setMedio(e.target.value as MedioPago)}>
            {MEDIOS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
        <label className="field">
          Motivo (opcional)
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: producto en mal estado" />
        </label>

        {error && <p className="modal__hint modal__hint--warn">{error}</p>}

        <div className="modal__total">A devolver: {formatMoney(total)}</div>
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button className="btn btn--primary" onClick={confirmar} disabled={!hayAlgo || enviando}>
            {enviando ? 'Registrando…' : 'Registrar devolución'}
          </button>
        </div>
      </div>
    </div>
  );
}
