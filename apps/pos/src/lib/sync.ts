// Cola de sincronización (outbox). Las ventas se guardan primero en IndexedDB y
// se suben al backend cuando hay conexión. La idempotencia (idempotencyKey =
// sale.id) garantiza que reintentar nunca duplique una venta.
//
// Background Sync solo existe en Chromium; por eso el disparador principal es un
// listener `online` + un flush manual/por intervalo. Siempre encolamos primero.
import { emitCfe, postDevolucion, postSale } from './api';
import { getPendingSales, updateSale } from './db';
import type { CfeSummary, OutboxSale } from './types';

let sincronizando = false;

/** Sube una venta normal. */
function subirVenta(sale: OutboxSale) {
  return postSale({
    idempotencyKey: sale.id,
    fecha: sale.fecha,
    cashSessionId: sale.cashSessionId,
    customerId: sale.customer?.id,
    items: sale.items.map((it) => ({
      productId: it.productId,
      concepto: it.concepto,
      unidad: it.unidad,
      cantidad: it.cantidad,
      precioUnit: it.precioUnit,
      ivaIndicador: it.ivaIndicador,
      descuento: it.descuento,
    })),
    payments: sale.payments,
  });
}

/** Sube una devolución (cantidades en positivo; el backend las guarda negativas). */
function subirDevolucion(sale: OutboxSale) {
  return postDevolucion({
    idempotencyKey: sale.id,
    originalSaleId: sale.referenciaSaleId ?? '',
    cashSessionId: sale.cashSessionId,
    medio: sale.payments[0]?.medio ?? 'EFECTIVO',
    motivo: sale.motivo,
    items: sale.items.map((it) => ({
      productId: it.productId,
      concepto: it.concepto,
      unidad: it.unidad,
      cantidad: Math.abs(it.cantidad),
      precioUnit: it.precioUnit,
      descuento: it.descuento,
      ivaIndicador: it.ivaIndicador,
    })),
  });
}

export type SyncListener = () => void;
const listeners = new Set<SyncListener>();
export function onSyncChange(fn: SyncListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify(): void {
  for (const fn of listeners) fn();
}

/** Sube todas las ventas pendientes. Seguro de llamar varias veces (dedupe). */
export async function flushOutbox(): Promise<void> {
  if (sincronizando || !navigator.onLine) return;
  sincronizando = true;
  try {
    const pendientes = await getPendingSales();
    for (const sale of pendientes) {
      await updateSale(sale.id, { status: 'syncing' });
      notify();
      try {
        const res = sale.esDevolucion ? await subirDevolucion(sale) : await subirVenta(sale);

        // Emisión del e-Ticket (best-effort). Si falla, la venta igual quedó
        // registrada; el CFE se puede reintentar. El polling DGI corre server-side.
        let cfe: CfeSummary | undefined;
        try {
          cfe = await emitCfe(res.id);
        } catch {
          /* CFE diferido: se emite en un próximo intento */
        }

        await updateSale(sale.id, { status: 'synced', serverId: res.id, cfe, ultimoError: undefined });
      } catch (err) {
        await updateSale(sale.id, {
          status: 'error',
          intentos: sale.intentos + 1,
          ultimoError: err instanceof Error ? err.message : String(err),
        });
      }
      notify();
    }
  } finally {
    sincronizando = false;
    notify();
  }
}

/** Arranca el sync automático: al volver online y cada 30s como red de seguridad. */
export function startAutoSync(): () => void {
  const onOnline = () => void flushOutbox();
  window.addEventListener('online', onOnline);
  const timer = window.setInterval(() => void flushOutbox(), 30_000);
  void flushOutbox();
  return () => {
    window.removeEventListener('online', onOnline);
    window.clearInterval(timer);
  };
}
