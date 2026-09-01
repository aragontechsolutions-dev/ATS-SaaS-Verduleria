// ============================================================================
// Etiqueta de balanza: el POS actúa como balanza etiquetadora. Toma un producto
// pesable + un peso y genera una etiqueta con el EAN-13 de peso variable, para
// pegar en la bolsa y escanear luego en la caja.
//
// El código se arma con buildWeightEan (lib/barcode.ts, contraparte de
// parseScan) usando la MISMA config de la balanza, así el mismo POS lo lee.
// El dibujo del código usa ean13Bars (patrón de barras) renderizado como SVG,
// que imprime nítido en cualquier impresora (térmica o común) desde el navegador.
// ============================================================================

import { buildWeightEan, ean13Bars } from './barcode';
import type { WeightBarcodeConfig } from './barcode';
import { formatMoney } from './format';

export interface LabelData {
  nombre: string;
  plu: number;
  ean: string;
  /** Precio por kg del catálogo. */
  precioKg: number;
  weightKg: number;
  total: number;
  fecha: string;
  negocio?: string;
}

/**
 * Arma los datos de una etiqueta para un producto pesable. Devuelve null si el
 * producto no tiene PLU o el código no se puede formar con la config actual.
 */
export function buildLabelData(
  p: { nombre: string; plu: number | null; precio: number },
  weightKg: number,
  cfg: Partial<WeightBarcodeConfig>,
  negocio?: string,
): LabelData | null {
  if (p.plu == null) return null;
  const embedded = cfg.embedded ?? 'weight';
  const total = weightKg * p.precio;
  // Si la balanza embebe importe, el código lleva el total; si embebe peso, el peso.
  const ean = buildWeightEan(p.plu, embedded === 'price' ? total : weightKg, cfg);
  if (!ean) return null;
  return {
    nombre: p.nombre,
    plu: p.plu,
    ean,
    precioKg: p.precio,
    weightKg,
    total,
    fecha: new Date().toLocaleDateString('es-UY'),
    negocio,
  };
}

/** Renderiza un EAN-13 como SVG (barras + dígitos legibles). Vacío si el código es inválido. */
export function ean13Svg(code: string, opts: { height?: number; module?: number } = {}): string {
  const bars = ean13Bars(code);
  if (!bars) return '';
  const m = opts.module ?? 2; // ancho de módulo en px
  const h = opts.height ?? 60;
  const quiet = 11 * m; // margen mudo a cada lado
  const width = bars.length * m + quiet * 2;
  const barsH = h; // alto de las barras
  const totalH = h + 16; // + dígitos

  let rects = '';
  for (let i = 0; i < bars.length; i++) {
    if (bars[i] === '1') {
      rects += `<rect x="${quiet + i * m}" y="0" width="${m}" height="${barsH}" />`;
    }
  }
  // Dígitos legibles bajo el código (agrupados 1 / 6 / 6 como el estándar).
  const g1 = code.slice(0, 1);
  const g2 = code.slice(1, 7);
  const g3 = code.slice(7, 13);
  const fs = 12;
  const y = totalH - 2;
  const texts =
    `<text x="0" y="${y}" font-family="monospace" font-size="${fs}">${g1}</text>` +
    `<text x="${quiet + 4 * m}" y="${y}" font-family="monospace" font-size="${fs}">${g2}</text>` +
    `<text x="${quiet + 50 * m}" y="${y}" font-family="monospace" font-size="${fs}">${g3}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}" fill="#000">${rects}${texts}</svg>`;
}

/** HTML de una etiqueta (~50mm de ancho) para imprimir/previsualizar. */
export function etiquetaHtml(d: LabelData): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Etiqueta · ${escapeHtml(d.nombre)}</title>
<style>
  * { font-family: 'Inter', Arial, sans-serif; box-sizing: border-box; }
  body { width: 200px; margin: 0 auto; color: #000; padding: 6px 8px; }
  .neg { text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }
  .nom { text-align: center; font-size: 15px; font-weight: 700; margin: 2px 0; line-height: 1.15; }
  .grid { display: flex; justify-content: space-between; font-size: 11px; margin: 4px 0; }
  .grid b { display: block; font-size: 13px; }
  .tot { text-align: center; font-size: 20px; font-weight: 800; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin: 4px 0; }
  .bc { text-align: center; margin-top: 4px; }
  .bc svg { max-width: 100%; height: auto; }
  .meta { display: flex; justify-content: space-between; font-size: 9px; color: #333; margin-top: 2px; }
</style></head><body>
  ${d.negocio ? `<div class="neg">${escapeHtml(d.negocio)}</div>` : ''}
  <div class="nom">${escapeHtml(d.nombre)}</div>
  <div class="grid">
    <span>Peso<b>${d.weightKg.toFixed(3)} kg</b></span>
    <span style="text-align:right">Precio/kg<b>${formatMoney(d.precioKg)}</b></span>
  </div>
  <div class="tot">${formatMoney(d.total)}</div>
  <div class="bc">${ean13Svg(d.ean, { height: 55, module: 2 })}</div>
  <div class="meta"><span>PLU ${d.plu}</span><span>${d.fecha}</span></div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));
}

/** Abre la etiqueta en una ventana e imprime. Devuelve false si fue bloqueada. */
export function printEtiquetaBrowser(d: LabelData): boolean {
  const w = window.open('', 'ATS_SISGESVER_Etiqueta', 'width=260,height=420');
  if (!w) return false;
  w.document.write(etiquetaHtml(d));
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 250);
  return true;
}
