import type { OutboxSale } from './types';
import { formatMoney, formatQty, ivaIncluido, TASA_LABEL } from './format';
import { lineTotal } from '../state/cart';

const MEDIO_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo', DEBITO: 'Débito', CREDITO: 'Crédito', MERCADO_PAGO: 'QR / MP',
  TRANSFERENCIA: 'Transferencia', DINERO_ELECTRONICO: 'Dinero electrónico', CUENTA_CORRIENTE: 'Cuenta corriente',
};

/** HTML de una boleta 80mm para la venta (se usa para imprimir y previsualizar). */
export function boletaHtml(sale: OutboxSale): string {
  const fecha = new Date(sale.fecha ?? sale.createdAt).toLocaleString('es-UY');
  const cfe = sale.cfe;

  const lineas = sale.items
    .map((it) => {
      const sub = lineTotal(it);
      return `<tr><td>${escapeHtml(it.concepto)}<br><small>${formatQty(it.cantidad, it.unidad)} × ${formatMoney(it.precioUnit)}</small></td><td class="r">${formatMoney(sub)}</td></tr>`;
    })
    .join('');

  // IVA por tasa.
  const porTasa = new Map<string, number>();
  for (const it of sale.items) {
    const iva = ivaIncluido(lineTotal(it), it.ivaIndicador);
    if (iva > 0) porTasa.set(it.ivaIndicador, (porTasa.get(it.ivaIndicador) ?? 0) + iva);
  }
  const ivaRows = [...porTasa.entries()]
    .map(([ind, monto]) => `<div class="row"><span>${TASA_LABEL[ind] ?? ind}</span><span>${formatMoney(monto)}</span></div>`)
    .join('');

  // Los payments suman el total (montos aplicados). El vuelto se guarda aparte:
  // en la boleta mostramos el efectivo RECIBIDO (aplicado + vuelto) y el vuelto.
  const vuelto = sale.vuelto ?? Math.max(0, sale.payments.reduce((s, p) => s + p.monto, 0) - sale.total);
  const pagos = sale.payments
    .map((p) => {
      const monto = p.medio === 'EFECTIVO' ? p.monto + vuelto : p.monto;
      return `<div class="row"><span>${MEDIO_LABEL[p.medio] ?? p.medio}</span><span>${formatMoney(monto)}</span></div>`;
    })
    .join('');

  const cli = sale.customer;
  const clienteBloque = cli
    ? `<div class="cli">Comprador: ${escapeHtml(cli.nombre)}${cli.documento ? `<br>${cli.tipoDocumento} ${escapeHtml(cli.documento)}` : ''}</div>`
    : '';

  const comprobante = cfe?.serie
    ? `<div class="cfe"><div>${cfe.serie}-${cfe.numero}</div>${cfe.caeNumero ? `<div>CAE ${cfe.caeNumero}</div>` : ''}</div>`
    : `<div class="cfe">Ticket interno</div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>ATS SISGESVER · Boleta</title>
<style>
  * { font-family: 'Courier New', monospace; }
  body { width: 280px; margin: 0 auto; color: #000; padding: 8px 10px; }
  h1 { font-size: 15px; text-align: center; margin: 4px 0; }
  .meta { text-align: center; font-size: 11px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td { padding: 3px 0; vertical-align: top; border-bottom: 1px dashed #bbb; }
  td.r, .row span:last-child { text-align: right; }
  small { color: #333; font-size: 10px; }
  .row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
  .total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; border-top: 2px solid #000; margin-top: 6px; padding-top: 6px; }
  .sec { margin-top: 8px; }
  .cfe { text-align: center; font-size: 12px; margin-top: 10px; border-top: 1px dashed #bbb; padding-top: 6px; }
  .cli { font-size: 11px; margin-top: 8px; border-top: 1px dashed #bbb; padding-top: 6px; }
  .gracias { text-align: center; font-size: 11px; margin-top: 10px; }
</style></head><body>
  <h1>BOLETA</h1>
  <div class="meta">ATS SISGESVER · ${fecha}</div>
  <table>${lineas}</table>
  ${ivaRows ? `<div class="sec">${ivaRows}</div>` : ''}
  <div class="total"><span>TOTAL</span><span>${formatMoney(sale.total)}</span></div>
  <div class="sec">${pagos}${vuelto > 0 ? `<div class="row"><span>Vuelto</span><span>${formatMoney(vuelto)}</span></div>` : ''}</div>
  ${clienteBloque}
  ${comprobante}
  <div class="gracias">¡Gracias por su compra!</div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));
}

/** Abre la boleta en una ventana e imprime (80mm). Devuelve false si fue bloqueada. */
export function printBoleta(sale: OutboxSale): boolean {
  const w = window.open('', 'ATS_SISGESVER_Boleta', 'width=320,height=600');
  if (!w) return false;
  w.document.write(boletaHtml(sale));
  w.document.close();
  try { w.document.title = 'ATS SISGESVER · Boleta'; } catch { /* noop */ }
  w.focus();
  setTimeout(() => { w.print(); }, 250);
  return true;
}
