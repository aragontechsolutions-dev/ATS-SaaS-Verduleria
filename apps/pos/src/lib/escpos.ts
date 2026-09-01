// ============================================================================
// Generación de comandos ESC/POS para impresoras térmicas (58/80mm).
//
// Puro y testeable: arma un Uint8Array con la boleta (texto) y los comandos de
// control. El texto se translitera a ASCII (á→a, ñ→n, …) para evitar mojibake
// entre codepages de las térmicas. También expone el "kick" del cajón de dinero.
// ============================================================================

import type { OutboxSale } from './types';
import type { LabelData } from './etiqueta';
import { lineBruto, lineTotal } from '../state/cart';
import { formatMoney, formatQty, TASA_LABEL } from './format';

const ESC = 0x1b;
const GS = 0x1d;

const MEDIO_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo', DEBITO: 'Debito', CREDITO: 'Credito', MERCADO_PAGO: 'QR / MP',
  TRANSFERENCIA: 'Transferencia', DINERO_ELECTRONICO: 'Dinero electronico', CUENTA_CORRIENTE: 'Cuenta corriente',
};

/** Translitera a ASCII imprimible (evita problemas de codepage en la térmica). */
export function ascii(s: string): string {
  // NFD separa los acentos como marcas combinantes; luego quitamos todo lo no ASCII.
  return s.normalize('NFD').replace(/[^\x20-\x7e]/g, '');
}

/** Dos columnas (izq/der) ajustadas al ancho en caracteres. */
export function twoCol(left: string, right: string, width: number): string {
  const r = ascii(right).slice(0, width);
  const maxL = Math.max(0, width - r.length - 1);
  const l = ascii(left).slice(0, maxL);
  const pad = Math.max(1, width - l.length - r.length);
  return l + ' '.repeat(pad) + r;
}

/** Acumulador de bytes con helpers ESC/POS. */
class Builder {
  private parts: number[] = [];
  private readonly width: number;

  constructor(width: number) {
    this.width = width;
  }

  raw(...b: number[]): this { this.parts.push(...b); return this; }
  text(s: string): this { for (const ch of ascii(s)) this.parts.push(ch.charCodeAt(0) & 0xff); return this; }
  line(s = ''): this { return this.text(s).raw(0x0a); }
  cols(l: string, r: string): this { return this.line(twoCol(l, r, this.width)); }
  sep(ch = '-'): this { return this.line(ch.repeat(this.width)); }

  init(): this { return this.raw(ESC, 0x40); }
  align(a: 'l' | 'c' | 'r'): this { return this.raw(ESC, 0x61, a === 'c' ? 1 : a === 'r' ? 2 : 0); }
  bold(on: boolean): this { return this.raw(ESC, 0x45, on ? 1 : 0); }
  size(double: boolean): this { return this.raw(GS, 0x21, double ? 0x11 : 0x00); }
  feed(n: number): this { return this.raw(ESC, 0x64, n & 0xff); }
  cut(): this { return this.raw(GS, 0x56, 0x01); } // corte parcial
  drawer(): this { return this.raw(ESC, 0x70, 0x00, 0x19, 0xfa); } // kick pin 0

  build(): Uint8Array { return Uint8Array.from(this.parts); }
}

/** Comando para abrir el cajón de dinero (kick). */
export function drawerKick(): Uint8Array {
  return Uint8Array.from([ESC, 0x70, 0x00, 0x19, 0xfa]);
}

/**
 * Arma la boleta como bytes ESC/POS. `width` en caracteres (32 = 58mm, 48 = 80mm).
 * Si `openDrawer`, agrega el kick del cajón al final.
 */
export function buildReceipt(sale: OutboxSale, opts: { width?: number; openDrawer?: boolean } = {}): Uint8Array {
  const width = opts.width ?? 48;
  const b = new Builder(width);
  const fecha = new Date(sale.fecha ?? sale.createdAt).toLocaleString('es-UY');
  const esDev = !!sale.esDevolucion;

  b.init().align('c').bold(true).size(true);
  b.line('ATS SISGESVER');
  b.size(false);
  b.line(esDev ? 'NOTA DE CREDITO' : 'BOLETA');
  b.bold(false).line(fecha);
  if (esDev) b.line('DEVOLUCION');
  b.align('l').sep();

  for (const it of sale.items) {
    b.line(it.concepto);
    b.cols(`  ${formatQty(it.cantidad, it.unidad)} x ${formatMoney(it.precioUnit)}`, formatMoney(lineTotal(it)));
  }
  b.sep();

  // IVA por tasa.
  const porTasa = new Map<string, number>();
  for (const it of sale.items) {
    const t = ivaIncluidoLocal(lineTotal(it), it.ivaIndicador);
    if (t > 0) porTasa.set(it.ivaIndicador, (porTasa.get(it.ivaIndicador) ?? 0) + t);
  }
  for (const [ind, monto] of porTasa) b.cols(TASA_LABEL[ind] ?? ind, formatMoney(monto));

  const descuentoTotal = sale.items.reduce((s, it) => s + (it.descuento ?? 0), 0);
  if (descuentoTotal > 0) {
    const bruto = sale.items.reduce((s, it) => s + lineBruto(it), 0);
    b.cols('Subtotal', formatMoney(bruto));
    b.cols('Descuento', `-${formatMoney(descuentoTotal)}`);
  }

  b.bold(true).size(true).cols('TOTAL', formatMoney(sale.total)).size(false).bold(false);

  const vuelto = sale.vuelto ?? 0;
  for (const p of sale.payments) {
    const monto = p.medio === 'EFECTIVO' ? p.monto + vuelto : p.monto;
    b.cols(MEDIO_LABEL[p.medio] ?? p.medio, formatMoney(monto));
  }
  if (vuelto > 0) b.cols('Vuelto', formatMoney(vuelto));

  if (sale.customer) {
    b.sep();
    b.line(`Comprador: ${sale.customer.nombre}`);
    if (sale.customer.documento) b.line(`${sale.customer.tipoDocumento} ${sale.customer.documento}`);
  }

  b.sep().align('c');
  b.line(sale.cfe?.serie ? `${sale.cfe.serie}-${sale.cfe.numero}` : 'Ticket interno');
  if (sale.cfe?.caeNumero) b.line(`CAE ${sale.cfe.caeNumero}`);
  b.line('Gracias por su compra!');
  b.feed(3).cut();

  if (opts.openDrawer) b.drawer();
  return b.build();
}

/** Datos mínimos de un corte X/Z para imprimir (subset de la respuesta del API). */
export interface CorteTicket {
  tipo: 'X' | 'Z';
  terminal: string | null;
  sucursalNombre: string | null;
  userNombre: string | null;
  aperturaAt: string;
  cierreAt: string | null;
  montoApertura: number;
  ingresos: number;
  egresos: number;
  sangrias: number;
  ventas: number;
  totalVendido: number;
  porMedio: Record<string, number>;
  efectivoEsperado: number;
  montoCierre: number | null;
  diferencia: number | null;
  generadoAt: string;
}

/** Arma el ticket ESC/POS de un corte de caja X o Z. */
export function buildCorte(c: CorteTicket, opts: { width?: number } = {}): Uint8Array {
  const width = opts.width ?? 48;
  const b = new Builder(width);

  b.init().align('c').bold(true).size(true);
  b.line('ATS SISGESVER');
  b.size(false);
  b.line(c.tipo === 'Z' ? 'CORTE Z (CIERRE)' : 'CORTE X (PARCIAL)');
  b.bold(false);
  if (c.terminal) b.line(c.terminal + (c.sucursalNombre ? ` - ${c.sucursalNombre}` : ''));
  else if (c.sucursalNombre) b.line(c.sucursalNombre);
  if (c.userNombre) b.line(`Cajero: ${c.userNombre}`);
  b.align('l').sep();

  b.line(`Apertura: ${new Date(c.aperturaAt).toLocaleString('es-UY')}`);
  b.line(`${c.tipo === 'Z' && c.cierreAt ? 'Cierre' : 'Emitido'}: ${new Date(c.cierreAt ?? c.generadoAt).toLocaleString('es-UY')}`);
  b.sep();

  b.cols('Fondo de apertura', formatMoney(c.montoApertura));
  b.cols(`Ventas (${c.ventas})`, formatMoney(c.totalVendido));
  if (c.ingresos > 0) b.cols('Ingresos', `+${formatMoney(c.ingresos)}`);
  if (c.egresos > 0) b.cols('Egresos', `-${formatMoney(c.egresos)}`);
  if (c.sangrias > 0) b.cols('Sangrias', `-${formatMoney(c.sangrias)}`);
  b.sep();

  b.bold(true).line('Por medio de pago').bold(false);
  const medios = Object.keys(c.porMedio);
  if (medios.length === 0) b.line('  (sin ventas)');
  for (const m of medios) b.cols(`  ${MEDIO_LABEL[m] ?? m}`, formatMoney(c.porMedio[m]));
  b.sep();

  b.bold(true).cols('Efectivo esperado', formatMoney(c.efectivoEsperado)).bold(false);
  if (c.tipo === 'Z' && c.montoCierre != null) {
    b.cols('Efectivo contado', formatMoney(c.montoCierre));
    const dif = c.diferencia ?? 0;
    b.bold(true).cols('Diferencia', `${dif > 0 ? '+' : ''}${formatMoney(dif)}`).bold(false);
  }

  b.sep().align('c');
  b.line(c.tipo === 'Z' ? 'Turno cerrado' : 'Corte parcial - la caja sigue abierta');
  b.feed(3).cut();
  return b.build();
}

/**
 * Arma la etiqueta de balanza como bytes ESC/POS, con el EAN-13 impreso por el
 * hardware (comando GS k). El código ya es un EAN-13 válido de 13 dígitos.
 */
export function buildLabel(d: LabelData, opts: { width?: number } = {}): Uint8Array {
  const width = opts.width ?? 48;
  const b = new Builder(width);

  b.init().align('c');
  if (d.negocio) b.line(d.negocio);
  b.bold(true).size(true).line(d.nombre).size(false).bold(false);
  b.align('l');
  b.cols('Peso', `${d.weightKg.toFixed(3)} kg`);
  b.cols('Precio/kg', formatMoney(d.precioKg));
  b.bold(true).size(true).align('c').line(formatMoney(d.total)).size(false).bold(false);

  // Código de barras EAN-13 impreso por la impresora.
  b.align('c');
  b.raw(GS, 0x48, 0x02); // HRI debajo del código
  b.raw(GS, 0x66, 0x00); // fuente HRI A
  b.raw(GS, 0x68, 0x50); // alto del código (80 puntos)
  b.raw(GS, 0x77, 0x03); // ancho del módulo
  // GS k 67 n d1..d13  (función B: EAN13, n = cantidad de bytes)
  b.raw(GS, 0x6b, 0x43, d.ean.length);
  for (const ch of d.ean) b.raw(ch.charCodeAt(0) & 0xff);

  b.align('l').cols(`PLU ${d.plu}`, d.fecha);
  b.feed(2).cut();
  return b.build();
}

// IVA incluido (evita importar format.ivaIncluido para no acoplar más de lo necesario).
const TASA: Record<string, number> = { EXENTO: 0, MINIMA: 0.1, BASICA: 0.22, SUSPENSO: 0 };
function ivaIncluidoLocal(totalConIva: number, indicador: string): number {
  const t = TASA[indicador] ?? 0;
  return t > 0 ? totalConIva - totalConIva / (1 + t) : 0;
}
