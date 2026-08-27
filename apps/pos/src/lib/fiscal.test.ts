import { describe, expect, it } from 'vitest';
import { requiereIdentificacion, UMBRAL_IDENTIFICACION_UYU } from './fiscal';

describe('requiereIdentificacion', () => {
  it('no exige identificación por debajo del umbral', () => {
    expect(requiereIdentificacion(UMBRAL_IDENTIFICACION_UYU - 0.01)).toBe(false);
  });

  it('exige identificación en el umbral o por encima', () => {
    expect(requiereIdentificacion(UMBRAL_IDENTIFICACION_UYU)).toBe(true);
    expect(requiereIdentificacion(UMBRAL_IDENTIFICACION_UYU + 1000)).toBe(true);
  });

  it('el umbral por defecto es positivo', () => {
    expect(UMBRAL_IDENTIFICACION_UYU).toBeGreaterThan(0);
  });
});
