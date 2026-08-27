import { describe, expect, it } from 'vitest';
import { buildPayments, computeSplit, type PaymentLine } from './payment';

const sum = (ps: { monto: number }[]) => ps.reduce((s, p) => s + p.monto, 0);

describe('computeSplit', () => {
  it('efectivo justo: pago exacto, sin vuelto', () => {
    const r = computeSplit([{ medio: 'EFECTIVO', monto: 850 }], 850);
    expect(r.cubierto).toBe(true);
    expect(r.vuelto).toBe(0);
    expect(r.efectivoAplicado).toBe(850);
    expect(r.puedeCobrar).toBe(true);
  });

  it('efectivo de más: calcula el vuelto', () => {
    const r = computeSplit([{ medio: 'EFECTIVO', monto: 1000 }], 850);
    expect(r.cubierto).toBe(true);
    expect(r.vuelto).toBe(150);
    expect(r.efectivoAplicado).toBe(850);
  });

  it('falta plata: no se puede cobrar', () => {
    const r = computeSplit([{ medio: 'EFECTIVO', monto: 500 }], 850);
    expect(r.cubierto).toBe(false);
    expect(r.restante).toBe(350);
    expect(r.puedeCobrar).toBe(false);
  });

  it('mixto tarjeta + efectivo exacto', () => {
    const lines: PaymentLine[] = [
      { medio: 'DEBITO', monto: 500 },
      { medio: 'EFECTIVO', monto: 350 },
    ];
    const r = computeSplit(lines, 850);
    expect(r.noEfectivo).toBe(500);
    expect(r.efectivoAplicado).toBe(350);
    expect(r.vuelto).toBe(0);
    expect(r.puedeCobrar).toBe(true);
  });

  it('mixto tarjeta + efectivo con vuelto', () => {
    const lines: PaymentLine[] = [
      { medio: 'DEBITO', monto: 500 },
      { medio: 'EFECTIVO', monto: 500 },
    ];
    const r = computeSplit(lines, 850);
    expect(r.efectivoAplicado).toBe(350); // total − tarjeta
    expect(r.vuelto).toBe(150); // 500 recibido − 350 aplicado
    expect(r.puedeCobrar).toBe(true);
  });

  it('los medios electrónicos no pueden superar el total', () => {
    const lines: PaymentLine[] = [
      { medio: 'DEBITO', monto: 600 },
      { medio: 'CREDITO', monto: 400 },
    ];
    const r = computeSplit(lines, 850);
    expect(r.excedeNoEfectivo).toBe(true);
    expect(r.puedeCobrar).toBe(false);
  });

  it('solo tarjeta por el total exacto', () => {
    const r = computeSplit([{ medio: 'DEBITO', monto: 850 }], 850);
    expect(r.puedeCobrar).toBe(true);
    expect(r.efectivoAplicado).toBe(0);
    expect(r.vuelto).toBe(0);
  });

  it('tolera redondeo de centavos', () => {
    const lines: PaymentLine[] = [
      { medio: 'DEBITO', monto: 33.33 },
      { medio: 'EFECTIVO', monto: 66.67 },
    ];
    const r = computeSplit(lines, 100);
    expect(r.cubierto).toBe(true);
    expect(r.vuelto).toBe(0);
  });
});

describe('buildPayments', () => {
  it('los payments suman EXACTO el total (efectivo con vuelto)', () => {
    const lines: PaymentLine[] = [
      { medio: 'DEBITO', monto: 500 },
      { medio: 'EFECTIVO', monto: 500 },
    ];
    const { payments, vuelto } = buildPayments(lines, 850);
    expect(sum(payments)).toBeCloseTo(850, 2);
    expect(vuelto).toBe(150);
    const efec = payments.find((p) => p.medio === 'EFECTIVO');
    expect(efec?.monto).toBe(350); // aplicado, no lo recibido
  });

  it('solo efectivo: registra el aplicado, no lo recibido', () => {
    const { payments, vuelto } = buildPayments([{ medio: 'EFECTIVO', monto: 1000 }], 850);
    expect(sum(payments)).toBe(850);
    expect(vuelto).toBe(150);
  });

  it('conserva la referencia de medios electrónicos', () => {
    const { payments } = buildPayments(
      [{ medio: 'TRANSFERENCIA', monto: 850, referencia: 'OP-123' }],
      850,
    );
    expect(payments[0].referencia).toBe('OP-123');
  });

  it('descarta líneas en cero', () => {
    const lines: PaymentLine[] = [
      { medio: 'DEBITO', monto: 0 },
      { medio: 'EFECTIVO', monto: 850 },
    ];
    const { payments } = buildPayments(lines, 850);
    expect(payments).toHaveLength(1);
    expect(payments[0].medio).toBe('EFECTIVO');
  });
});
