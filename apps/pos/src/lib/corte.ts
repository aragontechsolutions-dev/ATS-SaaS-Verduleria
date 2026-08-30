import type { Corte } from './api';
import { formatMoney } from './format';

const MEDIO_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo', DEBITO: 'Débito', CREDITO: 'Crédito', MERCADO_PAGO: 'QR / MP',
  TRANSFERENCIA: 'Transferencia', DINERO_ELECTRONICO: 'Dinero electrónico', CUENTA_CORRIENTE: 'Cuenta corriente',
};

/** HTML 80mm de un corte X/Z (para imprimir desde el navegador). */
export function corteHtml(c: Corte): string {
  const medios = Object.keys(c.porMedio);
  const filasMedio = medios.length
    ? medios.map((m) => `<div class="row"><span>${MEDIO_LABEL[m] ?? m}</span><span>${formatMoney(c.porMedio[m])}</span></div>`).join('')
    : '<div class="row"><span>(sin ventas)</span><span></span></div>';
  const dif = c.diferencia ?? 0;

  return `<!doctype html><html><head><meta charset="utf-8"><title>ATS SISGESVER · Corte ${c.tipo}</title>
<style>
  * { font-family: 'Courier New', monospace; }
  body { width: 280px; margin: 0 auto; color: #000; padding: 8px 10px; }
  h1 { font-size: 15px; text-align: center; margin: 4px 0; }
  .meta { text-align: center; font-size: 11px; margin-bottom: 8px; }
  .row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
  .row span:last-child { text-align: right; }
  .sec { margin-top: 8px; border-top: 1px dashed #bbb; padding-top: 6px; }
  .tit { font-weight: bold; font-size: 12px; margin-bottom: 2px; }
  .big { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; border-top: 2px solid #000; margin-top: 6px; padding-top: 6px; }
  .foot { text-align: center; font-size: 11px; margin-top: 10px; }
</style></head><body>
  <h1>CORTE ${c.tipo === 'Z' ? 'Z (CIERRE)' : 'X (PARCIAL)'}</h1>
  <div class="meta">ATS SISGESVER${c.terminal ? `<br>${c.terminal}` : ''}${c.sucursalNombre ? ` · ${c.sucursalNombre}` : ''}${c.userNombre ? `<br>Cajero: ${c.userNombre}` : ''}</div>
  <div class="row"><span>Apertura</span><span>${new Date(c.aperturaAt).toLocaleString('es-UY')}</span></div>
  <div class="row"><span>${c.tipo === 'Z' && c.cierreAt ? 'Cierre' : 'Emitido'}</span><span>${new Date(c.cierreAt ?? c.generadoAt).toLocaleString('es-UY')}</span></div>
  <div class="sec">
    <div class="row"><span>Fondo de apertura</span><span>${formatMoney(c.montoApertura)}</span></div>
    <div class="row"><span>Ventas (${c.ventas})</span><span>${formatMoney(c.totalVendido)}</span></div>
    ${c.ingresos > 0 ? `<div class="row"><span>Ingresos</span><span>+${formatMoney(c.ingresos)}</span></div>` : ''}
    ${c.egresos > 0 ? `<div class="row"><span>Egresos</span><span>−${formatMoney(c.egresos)}</span></div>` : ''}
    ${c.sangrias > 0 ? `<div class="row"><span>Sangrías</span><span>−${formatMoney(c.sangrias)}</span></div>` : ''}
  </div>
  <div class="sec">
    <div class="tit">Por medio de pago</div>
    ${filasMedio}
  </div>
  <div class="sec">
    <div class="row"><span><b>Efectivo esperado</b></span><span><b>${formatMoney(c.efectivoEsperado)}</b></span></div>
    ${c.tipo === 'Z' && c.montoCierre != null ? `
      <div class="row"><span>Efectivo contado</span><span>${formatMoney(c.montoCierre)}</span></div>
      <div class="big"><span>Diferencia</span><span>${dif > 0 ? '+' : ''}${formatMoney(dif)}</span></div>` : ''}
  </div>
  <div class="foot">${c.tipo === 'Z' ? 'Turno cerrado' : 'Corte parcial — la caja sigue abierta'}</div>
</body></html>`;
}

/** Abre el corte en una ventana e imprime (80mm). Devuelve false si fue bloqueada. */
export function printCorteBrowser(c: Corte): boolean {
  const w = window.open('', 'ATS_SISGESVER_Corte', 'width=320,height=600');
  if (!w) return false;
  w.document.write(corteHtml(c));
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 250);
  return true;
}
