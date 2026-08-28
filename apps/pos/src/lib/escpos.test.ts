import { describe, expect, it } from 'vitest';
import { ascii, twoCol, drawerKick, buildReceipt } from './escpos';
import type { OutboxSale } from './types';

describe('ascii', () => {
  it('translitera acentos y ñ a ASCII', () => {
    expect(ascii('Morrón')).toBe('Morron');
    expect(ascii('Piña Ñandú')).toBe('Pina Nandu');
  });
  it('quita símbolos no imprimibles', () => {
    expect(ascii('café☕')).toBe('cafe');
  });
});

describe('twoCol', () => {
  it('alinea izquierda y derecha al ancho', () => {
    const r = twoCol('Total', '$100', 20);
    expect(r).toHaveLength(20);
    expect(r.startsWith('Total')).toBe(true);
    expect(r.endsWith('$100')).toBe(true);
  });
  it('recorta el texto largo sin exceder el ancho', () => {
    const r = twoCol('Nombre larguísimo de producto', '$9999', 24);
    expect(r.length).toBeLessThanOrEqual(24);
  });
});

describe('drawerKick', () => {
  it('es el comando ESC p 0 25 250', () => {
    expect([...drawerKick()]).toEqual([0x1b, 0x70, 0x00, 0x19, 0xfa]);
  });
});

const saleBase: OutboxSale = {
  id: 'x',
  fecha: '2026-01-01T10:00:00Z',
  items: [{ concepto: 'Morrón', unidad: 'KG', cantidad: 1, precioUnit: 100, ivaIndicador: 'MINIMA', esPesable: true }],
  payments: [{ medio: 'EFECTIVO', monto: 100 }],
  total: 100,
  status: 'synced',
  intentos: 0,
  createdAt: 0,
};

describe('buildReceipt', () => {
  it('empieza con init (ESC @) y termina con corte', () => {
    const bytes = [...buildReceipt(saleBase, { width: 48 })];
    expect(bytes.slice(0, 2)).toEqual([0x1b, 0x40]);
    // contiene el corte GS V 1
    const s = bytes.join(',');
    expect(s).toContain([0x1d, 0x56, 0x01].join(','));
  });

  it('agrega el kick del cajón si openDrawer', () => {
    const con = [...buildReceipt(saleBase, { width: 48, openDrawer: true })];
    const sin = [...buildReceipt(saleBase, { width: 48, openDrawer: false })];
    expect(con.slice(-5)).toEqual([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    expect(sin.slice(-5)).not.toEqual([0x1b, 0x70, 0x00, 0x19, 0xfa]);
  });

  it('imprime NOTA DE CREDITO en devoluciones', () => {
    const bytes = buildReceipt({ ...saleBase, esDevolucion: true, total: -100 }, { width: 48 });
    const texto = new TextDecoder().decode(bytes);
    expect(texto).toContain('NOTA DE CREDITO');
  });
});
