import { describe, expect, it } from 'vitest';
import { DEFAULT_SCALE_CONFIG, parseScaleFrame } from './scale';

describe('parseScaleFrame — protocolo toledo', () => {
  it('lee una trama estable en kg', () => {
    const r = parseScaleFrame('ST,GS,+001.234kg', 'toledo');
    expect(r).not.toBeNull();
    expect(r!.weightKg).toBeCloseTo(1.234, 3);
    expect(r!.stable).toBe(true);
  });

  it('marca inestable con US', () => {
    const r = parseScaleFrame('US,GS,+000.850kg', 'toledo');
    expect(r!.stable).toBe(false);
    expect(r!.weightKg).toBeCloseTo(0.85, 3);
  });

  it('convierte gramos a kg', () => {
    const r = parseScaleFrame('ST,GS,+750g', 'toledo');
    expect(r!.weightKg).toBeCloseTo(0.75, 3);
  });

  it('tolera espacios entre campos', () => {
    const r = parseScaleFrame(' ST , GS , 2.500 kg ', 'toledo');
    expect(r!.weightKg).toBeCloseTo(2.5, 3);
    expect(r!.stable).toBe(true);
  });

  it('devuelve null en una trama que no es toledo', () => {
    expect(parseScaleFrame('hola mundo', 'toledo')).toBeNull();
    expect(parseScaleFrame('1.234 kg', 'toledo')).toBeNull();
  });
});

describe('parseScaleFrame — protocolo generic', () => {
  it('lee un número con unidad kg', () => {
    const r = parseScaleFrame('1.234 kg', 'generic');
    expect(r!.weightKg).toBeCloseTo(1.234, 3);
    expect(r!.stable).toBe(true);
  });

  it('acepta coma decimal', () => {
    const r = parseScaleFrame('0,750 kg', 'generic');
    expect(r!.weightKg).toBeCloseTo(0.75, 3);
  });

  it('convierte gramos', () => {
    const r = parseScaleFrame('1500 g', 'generic');
    expect(r!.weightKg).toBeCloseTo(1.5, 3);
  });

  it('no confunde "kg" con gramos', () => {
    const r = parseScaleFrame('3.000 kg', 'generic');
    expect(r!.weightKg).toBeCloseTo(3.0, 3);
  });

  it('marca inestable si la línea trae US', () => {
    const r = parseScaleFrame('US 1.100 kg', 'generic');
    expect(r!.stable).toBe(false);
  });

  it('devuelve null cuando no hay número', () => {
    expect(parseScaleFrame('---', 'generic')).toBeNull();
    expect(parseScaleFrame('   ', 'generic')).toBeNull();
  });
});

describe('config por defecto', () => {
  it('arranca en modo manual', () => {
    expect(DEFAULT_SCALE_CONFIG.mode).toBe('manual');
    expect(DEFAULT_SCALE_CONFIG.baudRate).toBe(9600);
  });
});
