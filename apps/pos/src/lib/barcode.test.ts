import { describe, expect, it } from 'vitest';
import { buildWeightEan, ean13Bars, ean13CheckDigit, isValidEan13, parseScan } from './barcode';

// Construye un EAN-13 de peso variable válido: prefijo + plu(5) + valor(5) + K.
function makeWeightEan(prefix: string, plu: string, value: string): string {
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
    const code = makeWeightEan('20', '00007', '01500');
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
    const code = makeWeightEan('21', '00001', '12345');
    const r = parseScan(code, { embedded: 'price' });
    expect(r.type).toBe('weight');
    if (r.type === 'weight') {
      expect(r.plu).toBe(1);
      expect(r.kind).toBe('price');
      expect(r.price).toBeCloseTo(123.45, 2);
    }
  });

  it('rechaza el código si el dígito verificador es inválido', () => {
    const code = makeWeightEan('20', '00007', '01500');
    const corrupto = code.slice(0, 12) + (code.charCodeAt(12) - 48 === 0 ? '1' : '0');
    expect(parseScan(corrupto).type).toBe('unknown');
  });
});

describe('buildWeightEan — generación de etiqueta', () => {
  it('arma un EAN-13 válido con peso embebido', () => {
    // PLU 7, 1.5 kg → prefijo 20, plu 00007, peso 01500
    const ean = buildWeightEan(7, 1.5);
    expect(ean).not.toBeNull();
    expect(ean).toHaveLength(13);
    expect(isValidEan13(ean!)).toBe(true);
    // prefijo 20 + plu 00007 + peso 01500 = primeros 12 dígitos
    expect(ean!.slice(0, 12)).toBe('200000701500');
  });

  it('hace round-trip con parseScan (peso)', () => {
    const ean = buildWeightEan(123, 2.345)!;
    const r = parseScan(ean);
    expect(r.type).toBe('weight');
    if (r.type === 'weight') {
      expect(r.plu).toBe(123);
      expect(r.weightKg).toBeCloseTo(2.345, 3);
    }
  });

  it('hace round-trip con parseScan (importe) con la misma config', () => {
    const cfg = { embedded: 'price' as const };
    const ean = buildWeightEan(42, 199.9, cfg)!;
    const r = parseScan(ean, cfg);
    expect(r.type).toBe('weight');
    if (r.type === 'weight') {
      expect(r.plu).toBe(42);
      expect(r.price).toBeCloseTo(199.9, 2);
    }
  });

  it('devuelve null si el PLU no entra en los dígitos configurados', () => {
    expect(buildWeightEan(123456, 1)).toBeNull(); // 6 díg > pluDigits(5)
  });

  it('devuelve null con valores negativos', () => {
    expect(buildWeightEan(-1, 1)).toBeNull();
    expect(buildWeightEan(1, -1)).toBeNull();
  });
});

describe('ean13Bars — patrón de barras', () => {
  it('devuelve un patrón con guardas para un EAN válido', () => {
    const ean = buildWeightEan(7, 1.5)!;
    const bars = ean13Bars(ean);
    // 3 (inicio) + 6*7 + 5 (centro) + 6*7 + 3 (fin) = 95 módulos
    expect(bars).toHaveLength(95);
    expect(bars.startsWith('101')).toBe(true);
    expect(bars.endsWith('101')).toBe(true);
    expect(bars.slice(45, 50)).toBe('01010'); // guarda central
  });

  it('devuelve vacío para un código inválido', () => {
    expect(ean13Bars('123')).toBe('');
    expect(ean13Bars('4006381333930')).toBe('');
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
