// ============================================================================
// Balanza: modos de operación y parsing de tramas de peso.
//
// Cada cliente tiene una balanza distinta, así que el modo se configura POR
// DISPOSITIVO (se guarda en localStorage del POS, no en la base):
//
//   • manual   → la balanza solo muestra el peso; el cajero lo escribe.
//   • barcode  → balanza etiquetadora; imprime un EAN con el peso embebido y
//                el cajero lo escanea (ver barcode.ts). No habla con el POS.
//   • serial   → balanza EN VIVO por puerto COM/USB (Web Serial API). El POS
//                lee el flujo continuo de peso y lo autocompleta.
//   • network  → balanza con salida de red (UTP). El navegador no abre TCP
//                crudo, así que se conecta por WebSocket a un pequeño puente
//                local (agente) que expone la balanza. Reusa el mismo parser.
//
// `parseScaleFrame` convierte una línea de la balanza en un peso. Es pura y
// está cubierta por tests (scale.test.ts).
// ============================================================================

export type ScaleMode = 'manual' | 'barcode' | 'serial' | 'network';

/** Protocolo de la trama de texto que emite la balanza en vivo. */
export type ScaleProtocol = 'toledo' | 'generic';

export interface ScaleConfig {
  mode: ScaleMode;
  protocol: ScaleProtocol;
  /** Velocidad del puerto serie (modo serial). */
  baudRate: number;
  /** URL del puente WebSocket (modo network), ej. ws://localhost:8787. */
  networkUrl: string;
}

export interface ScaleReading {
  /** Peso en kilogramos. */
  weightKg: number;
  /** true si la balanza marca lectura estable (no en movimiento). */
  stable: boolean;
  raw: string;
}

export const DEFAULT_SCALE_CONFIG: ScaleConfig = {
  mode: 'manual',
  protocol: 'generic',
  baudRate: 9600,
  networkUrl: '',
};

const STORE_KEY = 'ats.pos.scale';

export function loadScaleConfig(): ScaleConfig {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULT_SCALE_CONFIG };
    return { ...DEFAULT_SCALE_CONFIG, ...(JSON.parse(raw) as Partial<ScaleConfig>) };
  } catch {
    return { ...DEFAULT_SCALE_CONFIG };
  }
}

export function saveScaleConfig(cfg: ScaleConfig): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(cfg));
  } catch {
    // localStorage no disponible: no es crítico.
  }
}

const NUMBER_RE = /[+-]?\d+(?:[.,]\d+)?/;

/** ¿La línea expresa gramos (y no kilogramos)? */
function esGramos(texto: string): boolean {
  if (/kg/i.test(texto)) return false;
  return /(^|[^a-z])g(r|rs|ramos)?\b/i.test(texto);
}

/**
 * Parsea una línea/trama de la balanza a un peso en kg. Devuelve null si la
 * línea no contiene una lectura válida (frames parciales, ruido, etc.).
 *
 * - toledo: tramas separadas por coma tipo `ST,GS,+001.234kg` (ST=estable,
 *   US=inestable). Es el formato de Mettler-Toledo y compatibles.
 * - generic: cualquier línea con un número; detecta kg/g y marca inestable si
 *   aparece "US". Sirve para balanzas Systel/Kretz y similares en modo texto.
 */
export function parseScaleFrame(line: string, protocol: ScaleProtocol): ScaleReading | null {
  const raw = line;
  const texto = line.trim();
  if (!texto) return null;

  if (protocol === 'toledo') {
    const parts = texto.split(',').map((s) => s.trim());
    if (parts.length < 3 || !/^(ST|US)$/i.test(parts[0])) return null;
    const stable = /^ST$/i.test(parts[0]);
    const campo = parts[parts.length - 1];
    const num = campo.match(NUMBER_RE);
    if (!num) return null;
    let weightKg = parseFloat(num[0].replace(',', '.'));
    if (esGramos(campo)) weightKg /= 1000;
    if (!Number.isFinite(weightKg)) return null;
    return { weightKg, stable, raw };
  }

  // generic
  const num = texto.match(NUMBER_RE);
  if (!num) return null;
  let weightKg = parseFloat(num[0].replace(',', '.'));
  if (esGramos(texto)) weightKg /= 1000;
  if (!Number.isFinite(weightKg)) return null;
  const stable = !/\b(US|UNSTABLE|MOV|MOVING)\b/i.test(texto);
  return { weightKg, stable, raw };
}
