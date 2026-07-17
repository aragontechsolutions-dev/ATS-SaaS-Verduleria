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
