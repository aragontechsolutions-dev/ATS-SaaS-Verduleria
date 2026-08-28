import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CartItem, MedioPago, OutboxSale } from '../lib/types';
import { formatMoney, formatQty } from '../lib/format';
import { enqueueSale, getAllSales } from '../lib/db';
import { flushOutbox } from '../lib/sync';

interface Props {
  sale: OutboxSale;
  cashSessionId?: string;
  onDone: (montoDevuelto: number, sincronizada: boolean) => void;
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
const keyOf = (it: { productId?: string; concepto: string }) => it.productId ?? `c:${it.concepto}`;

/**
 * Devolución de ítems de una venta ya sincronizada (emite nota de crédito).
 * Funciona offline: se encola y se sincroniza igual que una venta. El tope por
 * producto se calcula descontando devoluciones previas de esta venta (locales);
 * el backend es la autoridad final.
 */
export function DevolucionModal({ sale, cashSessionId, onDone, onClose }: Props) {
  const [ret, setRet] = useState<Record<number, number>>({});
  const [medio, setMedio] = useState<MedioPago>(sale.payments[0]?.medio ?? 'EFECTIVO');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cantidad ya devuelta por producto (devoluciones previas de esta venta).
  const [devueltoPrevio, setDevueltoPrevio] = useState<Record<string, number>>({});

  useEffect(() => {
    getAllSales()
      .then((all) => {
        const previas = all.filter((s) => s.esDevolucion && s.referenciaSaleId === sale.serverId);
        const acc: Record<string, number> = {};
        for (const d of previas) {
          for (const it of d.items) acc[keyOf(it)] = (acc[keyOf(it)] ?? 0) + Math.abs(it.cantidad);
        }
        setDevueltoPrevio(acc);
      })
      .catch(() => setDevueltoPrevio({}));
  }, [sale.serverId]);

  // Disponible por producto = vendido en la venta − ya devuelto antes.
  const disponibleKey = useMemo(() => {
    const vendido: Record<string, number> = {};
    for (const it of sale.items) vendido[keyOf(it)] = (vendido[keyOf(it)] ?? 0) + it.cantidad;
    const out: Record<string, number> = {};
    for (const k of Object.keys(vendido)) out[k] = round2(Math.max(0, vendido[k] - (devueltoPrevio[k] ?? 0)));
    return out;
  }, [sale.items, devueltoPrevio]);

  // Máximo que puede tomar la línea i ahora (respeta el tope del producto).
  function maxLinea(i: number): number {
    const it = sale.items[i];
    const k = keyOf(it);
    const otros = sale.items.reduce((s, x, idx) => (idx !== i && keyOf(x) === k ? s + (ret[idx] ?? 0) : s), 0);
    return round2(Math.max(0, Math.min(it.cantidad, (disponibleKey[k] ?? 0) - otros)));
  }

  function setQty(i: number, v: number) {
    const q = Math.min(Math.max(0, v), maxLinea(i));
    setRet((r) => ({ ...r, [i]: round2(q) }));
  }

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
    if (!sale.serverId) {
      setError('La venta original todavía no se sincronizó. Esperá a que suba y reintentá.');
      return;
    }
    setEnviando(true);
    setError(null);

    const id = uuidv4();
    const seleccion = sale.items.map((it, i) => ({ it, q: ret[i] ?? 0 })).filter((x) => x.q > 0);
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

    try {
      // Se encola como pendiente; el sync la sube (postDevolucion) y emite la NC.
      await enqueueSale({
        id,
        fecha: new Date().toISOString(),
        cashSessionId,
        items: devItems,
        payments: [{ medio, monto: -total }],
        total: -total,
        esDevolucion: true,
        referenciaSaleId: sale.serverId,
        motivo: motivo.trim() || undefined,
        status: 'pending',
        intentos: 0,
        createdAt: Date.now(),
      });
      // Intento de sincronización inmediata (si hay conexión).
      await flushOutbox();
      onDone(total, navigator.onLine);
    } catch {
      setError('No se pudo registrar la devolución.');
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
            const disp = round2(disponibleKey[keyOf(it)] ?? it.cantidad);
            const agotado = disp <= 0;
            return (
              <div key={i} className={`dev-row ${q > 0 ? 'is-on' : ''} ${agotado ? 'is-off' : ''}`}>
                <div className="dev-row__info">
                  <span className="dev-row__name">{it.concepto}</span>
                  <span className="dev-row__sub">
                    Vendido: {formatQty(it.cantidad, it.unidad)} × {formatMoney(it.precioUnit)}
                    {disp < it.cantidad && <span className="dev-row__disp"> · disp. {formatQty(disp, it.unidad)}</span>}
                  </span>
                </div>
                <div className="dev-row__qty">
                  <button onClick={() => setQty(i, q - 1)} aria-label="Menos" disabled={agotado}>−</button>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={disp}
                    step={it.esPesable ? 0.001 : 1}
                    value={q || ''}
                    onChange={(e) => setQty(i, parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.currentTarget.select()}
                    disabled={agotado}
                  />
                  <button onClick={() => setQty(i, disp)} title="Todo" aria-label="Todo" disabled={agotado}>⤒</button>
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
