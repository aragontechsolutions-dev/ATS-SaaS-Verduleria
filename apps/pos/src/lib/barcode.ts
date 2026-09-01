// ============================================================================
// Parsing de código de barras de peso variable (EAN-13) para balanza.
//
// La balanza etiquetadora (Systel/Kretz/…) pesa e imprime un EAN-13 con
// prefijo 20-29 (rango de distribución restringida GS1) que embebe el PLU del
// producto y el peso o el importe. El POS lee con un lector común y parsea el
// código SIN hablar con la balanza (docs/ARCHITECTURE.md, opción A del MVP).
//
// Formato típico (configurable): PP CCCCC VVVVV K
//   PP    = prefijo (2 díg, 20-29)
//   CCCCC = código de producto / PLU (5 díg)
//   VVVVV = peso o importe embebido (5 díg, con decimales implícitos)
//   K     = dígito verificador (13º)
// ============================================================================

export type EmbeddedKind = 'weight' | 'price';

export interface WeightBarcodeConfig {
  /** Prefijos de 2 dígitos que indican peso variable. Default 20..29. */
  prefixes: string[];
  /** Dígitos del código de producto/PLU. Default 5. */
  pluDigits: number;
  /** Dígitos del valor embebido (peso o importe). Default 5. */
  valueDigits: number;
  /** Qué embebe la balanza: peso (recalcula precio con el catálogo) o importe. */
  embedded: EmbeddedKind;
  /** Decimales implícitos del peso (3 → 01500 = 1.500 kg). */
  weightDecimals: number;
  /** Decimales implícitos del importe (2 → 12345 = 123.45). */
  priceDecimals: number;
  /** Validar el dígito verificador EAN-13. */
  validateCheckDigit: boolean;
}

export const DEFAULT_WEIGHT_CONFIG: WeightBarcodeConfig = {
  prefixes: Array.from({ length: 10 }, (_, i) => String(20 + i)), // 20..29
  pluDigits: 5,
  valueDigits: 5,
  embedded: 'weight',
  weightDecimals: 3,
  priceDecimals: 2,
  validateCheckDigit: true,
};

export type ScanResult =
  | {
      type: 'weight';
      plu: number;
      kind: EmbeddedKind;
      /** kg cuando kind='weight'. */
      weightKg?: number;
      /** importe cuando kind='price'. */
      price?: number;
      raw: string;
    }
  | { type: 'ean'; code: string }
  | { type: 'unknown'; code: string };

const onlyDigits = (s: string): boolean => /^\d+$/.test(s);

/** Dígito verificador EAN-13 (módulo 10, pesos 1/3). */
export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = first12.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  if (code.length !== 13 || !onlyDigits(code)) return false;
  return ean13CheckDigit(code.slice(0, 12)) === code.charCodeAt(12) - 48;
}

/**
 * Interpreta un escaneo. Devuelve:
 *  - 'weight' si es un EAN-13 de peso variable (con PLU + peso/importe),
 *  - 'ean' si es un EAN-13 normal (buscar por código de barras),
 *  - 'unknown' en cualquier otro caso.
 */
export function parseScan(raw: string, config: Partial<WeightBarcodeConfig> = {}): ScanResult {
  const cfg = { ...DEFAULT_WEIGHT_CONFIG, ...config };
  const code = raw.trim();

  if (code.length !== 13 || !onlyDigits(code)) {
    return { type: 'unknown', code };
  }

  const prefix = code.slice(0, 2);
  const esPesoVariable = cfg.prefixes.includes(prefix);

  if (!esPesoVariable) {
    // EAN-13 común (producto empaquetado). Validamos y devolvemos el código.
    return { type: 'ean', code };
  }

  if (cfg.validateCheckDigit && !isValidEan13(code)) {
    return { type: 'unknown', code };
  }

  const pluStr = code.slice(2, 2 + cfg.pluDigits);
  const valueStr = code.slice(2 + cfg.pluDigits, 2 + cfg.pluDigits + cfg.valueDigits);
  const plu = parseInt(pluStr, 10);
  const valueInt = parseInt(valueStr, 10);

  if (cfg.embedded === 'weight') {
    return { type: 'weight', plu, kind: 'weight', weightKg: valueInt / 10 ** cfg.weightDecimals, raw: code };
  }
  return { type: 'weight', plu, kind: 'price', price: valueInt / 10 ** cfg.priceDecimals, raw: code };
}

// ============================================================================
// Generación (contraparte de parseScan): arma el EAN-13 de peso variable que
// la verdulería imprime en la etiqueta de la balanza. Es puro y testeable, y
// hace round-trip con parseScan usando la misma config.
// ============================================================================

/**
 * Arma un EAN-13 de peso variable a partir del PLU y el valor embebido (peso en
 * kg o importe según `embedded`). Devuelve el código de 13 dígitos, o null si el
 * PLU o el valor no entran en la cantidad de dígitos configurada (o el layout no
 * forma un EAN-13 válido). Es la contraparte exacta de `parseScan`.
 */
export function buildWeightEan(plu: number, value: number, config: Partial<WeightBarcodeConfig> = {}): string | null {
  const cfg = { ...DEFAULT_WEIGHT_CONFIG, ...config };
  const prefix = cfg.prefixes.find((p) => /^\d{2}$/.test(p)) ?? '20';

  if (!Number.isFinite(plu) || plu < 0 || !Number.isFinite(value) || value < 0) return null;

  const decimals = cfg.embedded === 'weight' ? cfg.weightDecimals : cfg.priceDecimals;
  const valueInt = Math.round(value * 10 ** decimals);

  const pluStr = String(Math.trunc(plu));
  const valueStr = String(valueInt);
  if (pluStr.length > cfg.pluDigits || valueStr.length > cfg.valueDigits) return null; // no entra

  // Layout: prefijo(2) + PLU + valor, rellenado a 12 díg (posición 12 = verificador).
  let body = prefix + pluStr.padStart(cfg.pluDigits, '0') + valueStr.padStart(cfg.valueDigits, '0');
  if (body.length > 12) return null; // el formato configurado no forma un EAN-13
  body = body.padEnd(12, '0');

  return body + ean13CheckDigit(body);
}

// Tablas de codificación EAN-13 (para dibujar el código, no para parsear).
const L_CODES = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G_CODES = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const R_CODES = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
// Paridad del grupo izquierdo según el primer dígito (A=L, B=G).
const PARITY = ['AAAAAA','AABABB','AABBAB','AABBBA','ABAABB','ABBAAB','ABBBAA','ABABAB','ABABBA','ABBABA'];

/**
 * Devuelve el patrón de barras de un EAN-13 como cadena de 0/1 (1 = barra
 * negra), incluyendo guardas de inicio/centro/fin. Útil para renderizar la
 * etiqueta (SVG/canvas). Devuelve '' si el código no es un EAN-13 válido.
 */
export function ean13Bars(code: string): string {
  if (!isValidEan13(code)) return '';
  const first = code.charCodeAt(0) - 48;
  const left = code.slice(1, 7);
  const right = code.slice(7, 13);
  const pattern = PARITY[first];

  let bars = '101'; // guarda inicial
  for (let i = 0; i < 6; i++) {
    const d = left.charCodeAt(i) - 48;
    bars += pattern[i] === 'A' ? L_CODES[d] : G_CODES[d];
  }
  bars += '01010'; // guarda central
  for (let i = 0; i < 6; i++) {
    bars += R_CODES[right.charCodeAt(i) - 48];
  }
  bars += '101'; // guarda final
  return bars;
}
