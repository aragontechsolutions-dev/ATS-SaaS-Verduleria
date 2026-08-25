// ============================================================================
// Motor de clasificación de IVA (puro, testeable).
//
// Dado el NOMBRE de un producto y un conjunto de REGLAS (administradas por
// Aragon en la Consola), decide el tratamiento fiscal: indicador de IVA +
// si es de estado natural + si es importado. Así el tenant no tiene que saber
// a qué tasa va cada producto: el motor la asigna sola.
//
// Fuente de las reglas base: docs/CFE-IVA.md (nómina oficial DGI, Ley 19.407).
// ============================================================================

import type { IvaIndicador } from './types';

/** Regla de clasificación: un término del nombre → tratamiento fiscal. */
export interface IvaRule {
  /** Término a buscar en el nombre (se normaliza; tolera plural). */
  termino: string;
  ivaIndicador: IvaIndicador;
  esEstadoNatural: boolean;
  esImportado: boolean;
  /** Ante varios matches, gana la de mayor prioridad (luego, término más largo). */
  prioridad: number;
}

/** Resultado de clasificar un producto. */
export interface Clasificacion {
  ivaIndicador: IvaIndicador;
  esEstadoNatural: boolean;
  esImportado: boolean;
  /** Término de la regla que matcheó; null si se usó el fallback. */
  regla: string | null;
  /** true si matcheó una regla; false si cayó al default. */
  automatica: boolean;
}

/** Default para verdulería cuando ninguna regla matchea (fruta/verdura → 10%). */
export const IVA_FALLBACK: Clasificacion = {
  ivaIndicador: 'MINIMA',
  esEstadoNatural: true,
  esImportado: false,
  regla: null,
  automatica: false,
};

/** Normaliza texto: minúsculas, sin tildes, sin signos, espacios colapsados. */
export function normalizarTexto(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes/diacríticos
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Singular simple en español para tolerar plurales (naranjas→naranja). */
function singular(t: string): string {
  if (t.endsWith('es') && t.length > 4) return t.slice(0, -2);
  if (t.endsWith('s') && t.length > 3) return t.slice(0, -1);
  return t;
}

/** Tokens del nombre + su forma singular, para matchear por palabra. */
function tokenize(nombre: string): Set<string> {
  const set = new Set<string>();
  for (const t of normalizarTexto(nombre).split(' ').filter(Boolean)) {
    set.add(t);
    set.add(singular(t));
  }
  return set;
}

function coincide(nombreNorm: string, nombreTokens: Set<string>, termino: string): boolean {
  const term = normalizarTexto(termino);
  if (!term) return false;
  // Término de varias palabras → substring sobre el nombre completo.
  if (term.includes(' ')) return nombreNorm.includes(term);
  // Término de una palabra → match por token (tolerando plural en ambos lados).
  return nombreTokens.has(term) || nombreTokens.has(singular(term));
}

/**
 * Clasifica un producto por su nombre contra las reglas. Devuelve el mejor
 * match (mayor prioridad, luego término más específico) o el fallback.
 */
export function clasificarProducto(
  nombre: string,
  reglas: IvaRule[],
  fallback: Clasificacion = IVA_FALLBACK,
): Clasificacion {
  const nombreNorm = normalizarTexto(nombre);
  if (!nombreNorm) return fallback;
  const nombreTokens = tokenize(nombre);

  let mejor: IvaRule | null = null;
  for (const r of reglas) {
    if (!coincide(nombreNorm, nombreTokens, r.termino)) continue;
    if (
      !mejor ||
      r.prioridad > mejor.prioridad ||
      (r.prioridad === mejor.prioridad &&
        normalizarTexto(r.termino).length > normalizarTexto(mejor.termino).length)
    ) {
      mejor = r;
    }
  }

  if (!mejor) return fallback;
  return {
    ivaIndicador: mejor.ivaIndicador,
    esEstadoNatural: mejor.esEstadoNatural,
    esImportado: mejor.esImportado,
    regla: mejor.termino,
    automatica: true,
  };
}
