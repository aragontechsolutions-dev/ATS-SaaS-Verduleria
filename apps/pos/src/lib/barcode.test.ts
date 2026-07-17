import { describe, expect, it } from 'vitest';
import { ean13CheckDigit, isValidEan13, parseScan } from './barcode';

// Construye un EAN-13 de peso variable válido: prefijo + plu(5) + valor(5) + K.
function buildWeightEan(prefix: string, plu: string, value: string): string {
  const first12 = prefix + plu + value;
  return first12 + String(ean13CheckDigit(first12));
}

describe('EAN-13 check digit', () => {
  it('calcula el dígito verificador conocido', () => {
    // 400638133393 → K=1 (ejemplo GS1 clásico 4006381333931)
    expect(ean13CheckDigit('400638133393')).toBe(1);
  });
  it('valida un EAN-13 completo', () => {
    expect(isValidEan13('4006381333931')).toBe(true);
    expect(isValidEan13('4006381333930')).toBe(false);
  });
});

describe('parseScan — peso variable', () => {
  it('parsea peso embebido (3 decimales → kg)', () => {
    // PLU 00007 (zanahoria), peso 01500 = 1.500 kg
    const code = buildWeightEan('20', '00007', '01500');
    const r = parseScan(code);
    expect(r.type).toBe('weight');
    if (r.type === 'weight') {
      expect(r.plu).toBe(7);
      expect(r.kind).toBe('weight');
      expect(r.weightKg).toBeCloseTo(1.5, 3);
    }
  });

  it('parsea importe embebido cuando embedded=price (2 decimales)', () => {
    // PLU 00001, importe 12345 = 123.45
    const code = buildWeightEan('21', '00001', '12345');
    const r = parseScan(code, { embedded: 'price' });
    expect(r.type).toBe('weight');
    if (r.type === 'weight') {
      expect(r.plu).toBe(1);
      expect(r.kind).toBe('price');
      expect(r.price).toBeCloseTo(123.45, 2);
    }
  });

  it('rechaza el código si el dígito verificador es inválido', () => {
    const code = buildWeightEan('20', '00007', '01500');
    const corrupto = code.slice(0, 12) + (code.charCodeAt(12) - 48 === 0 ? '1' : '0');
    expect(parseScan(corrupto).type).toBe('unknown');
  });
});

describe('parseScan — EAN normal y desconocidos', () => {
  it('un EAN-13 fuera del rango 20-29 se trata como código de producto', () => {
    const r = parseScan('7790895000997');
    expect(r.type).toBe('ean');
    if (r.type === 'ean') expect(r.code).toBe('7790895000997');
  });

  it('longitud incorrecta → unknown', () => {
    expect(parseScan('123').type).toBe('unknown');
  });
});
