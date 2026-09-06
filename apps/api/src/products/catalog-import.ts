// ============================================================================
// Parseo de filas del importador de catálogo (CSV/Excel). Funciones PURAS y
// testeables: no tocan Prisma. La UI del panel parsea el archivo y manda filas;
// acá se normalizan precio, unidad y "pesable" tolerando los formatos uruguayos.
// ============================================================================

import type { UnidadMedida } from '@ats/database';

/**
 * Parsea un precio escrito por un humano a número. Tolera separadores UY:
 * "89", "89,50", "1.234,50", "$ 1.234,50", "89.50". Si aparece coma, se asume
 * coma decimal y punto de miles (convención uruguaya). Devuelve null si inválido.
 */
export function parsePrecio(raw: string | number | undefined | null): number | null {
  if (typeof raw === 'number') return isFinite(raw) && raw >= 0 ? raw : null;
  let s = (raw ?? '').toString().trim().replace(/[^\d.,-]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,50 → 1234.50
  const n = Number(s);
  return isFinite(n) && n >= 0 ? n : null;
}

const UNIDADES: Record<string, UnidadMedida> = {
  kg: 'KG', kilo: 'KG', kilos: 'KG', kilogramo: 'KG', kilogramos: 'KG',
  g: 'GRAMO', gr: 'GRAMO', gramo: 'GRAMO', gramos: 'GRAMO',
  un: 'UNIDAD', u: 'UNIDAD', unidad: 'UNIDAD', unidades: 'UNIDAD', c_u: 'UNIDAD',
  atado: 'ATADO', atados: 'ATADO', mazo: 'ATADO',
  doc: 'DOCENA', docena: 'DOCENA', docenas: 'DOCENA',
  cajon: 'CAJON', 'cajón': 'CAJON', caja: 'CAJON',
  bolsa: 'BOLSA', arpillera: 'BOLSA',
  bandeja: 'BANDEJA',
  bin: 'BIN',
  bulto: 'BULTO',
};

/** Normaliza el texto de unidad a UnidadMedida, o null si no la reconoce. */
export function parseUnidad(raw: string | undefined | null): UnidadMedida | null {
  const k = (raw ?? '').toString().trim().toLowerCase().replace(/\.$/, '');
  if (!k) return null;
  return UNIDADES[k] ?? null;
}

const VERDADERO = new Set(['si', 'sí', 'true', '1', 'x', 'y', 'yes', 'verdadero', 'pesable']);
const FALSO = new Set(['no', 'false', '0', 'n', '', 'falso']);

/**
 * Determina si el producto es pesable. Si la columna trae un valor explícito, se
 * respeta; si no, se deriva de la unidad (KG y GRAMO son pesables).
 */
export function parsePesable(raw: string | undefined | null, unidad: UnidadMedida | null): boolean {
  const k = (raw ?? '').toString().trim().toLowerCase();
  if (VERDADERO.has(k)) return true;
  if (FALSO.has(k)) return unidad === 'KG' || unidad === 'GRAMO' ? k === '' : false;
  return unidad === 'KG' || unidad === 'GRAMO';
}

/** Normaliza un nombre para comparar/deduplicar (sin acentos, minúsculas, sin dobles espacios). */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface FilaImport {
  nombre?: string;
  precio?: string | number;
  categoria?: string;
  unidad?: string;
  pesable?: string;
  plu?: string | number;
  codigoBarras?: string;
  visibleOnline?: string;
}

export interface FilaNormalizada {
  nombre: string;
  precio: number;
  categoria: string | null;
  unidad: UnidadMedida;
  pesable: boolean;
  plu: number | null;
  codigoBarras: string | null;
  visibleOnline: boolean;
}

export type ResultadoFila =
  | { ok: true; fila: FilaNormalizada }
  | { ok: false; motivo: string };

/** Valida y normaliza una fila cruda. Unidad por defecto: UNIDAD. */
export function normalizarFila(f: FilaImport): ResultadoFila {
  const nombre = (f.nombre ?? '').toString().trim();
  if (nombre.length < 2) return { ok: false, motivo: 'Falta el nombre del producto' };

  const precio = parsePrecio(f.precio);
  if (precio == null) return { ok: false, motivo: 'Precio inválido' };

  const unidad = parseUnidad(f.unidad) ?? 'UNIDAD';
  const pesable = parsePesable(f.pesable, parseUnidad(f.unidad));

  let plu: number | null = null;
  if (f.plu != null && f.plu.toString().trim() !== '') {
    const n = Number(f.plu.toString().trim());
    if (!Number.isInteger(n) || n <= 0) return { ok: false, motivo: 'PLU inválido' };
    plu = n;
  }

  const vo = (f.visibleOnline ?? '').toString().trim().toLowerCase();
  const visibleOnline = VERDADERO.has(vo);

  return {
    ok: true,
    fila: {
      nombre,
      precio,
      categoria: (f.categoria ?? '').toString().trim() || null,
      unidad,
      pesable,
      plu,
      codigoBarras: (f.codigoBarras ?? '').toString().trim() || null,
      visibleOnline,
    },
  };
}
