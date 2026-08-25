// Reglas base del MOTOR DE IVA, sembradas desde la nómina oficial DGI
// (docs/CFE-IVA.md, Ley 19.407). Son GLOBALES: aplican a todas las verdulerías.
// Aragon las edita/extiende desde la Consola. El fallback del motor es
// MÍNIMA + estado natural, así que una fruta/verdura no listada igual va a 10%.
//
// prioridad: 0 = fruta/verdura/flor natural (default) · 5 = almacén 1ª necesidad
//            10 = elaborados / limpieza (ganan cuando el nombre mezcla términos)

import type { PrismaClient, IvaIndicador } from '../client';

interface RuleSeed {
  terminos: string[];
  ivaIndicador: IvaIndicador;
  esEstadoNatural: boolean;
  esImportado?: boolean;
  prioridad: number;
  nota: string;
}

const GRUPOS: RuleSeed[] = [
  {
    ivaIndicador: 'MINIMA', esEstadoNatural: true, prioridad: 0, nota: 'Hortalizas/verduras en estado natural (10%)',
    terminos: [
      'acelga', 'acedera', 'achicoria', 'radicha', 'radicheta', 'ajo', 'albahaca', 'alcaucil', 'alcachofa',
      'arveja', 'berenjena', 'berro', 'boniato', 'borraja', 'brocoli', 'cebolla', 'coliflor', 'chicharo',
      'escarola', 'esparrago', 'espinaca', 'garbanzo', 'grelo', 'haba', 'hinojo', 'hongo', 'seta', 'lechuga',
      'lenteja', 'maiz', 'choclo', 'nabo', 'oregano', 'papa', 'pepino', 'perejil', 'pimiento', 'aji', 'morron',
      'poroto', 'puerro', 'rabanito', 'rabano', 'remolacha', 'repollo', 'salsifi', 'tomate', 'zanahoria',
      'zapallito', 'zapallo', 'apio', 'rucula', 'chaucha', 'calabaza',
    ],
  },
  {
    ivaIndicador: 'MINIMA', esEstadoNatural: true, prioridad: 0, nota: 'Frutas en estado natural (10%)',
    terminos: [
      'anana', 'banana', 'platano', 'cereza', 'ciruela', 'damasco', 'durazno', 'frambuesa', 'frutilla',
      'granada', 'grosella', 'guayabo', 'higo', 'kiwi', 'mango', 'manzana', 'membrillo', 'palta', 'papaya',
      'pelon', 'pera', 'uva', 'sandia', 'melon', 'arandano', 'mora', 'coco', 'maracuya',
    ],
  },
  {
    ivaIndicador: 'MINIMA', esEstadoNatural: true, prioridad: 0, nota: 'Cítricos en estado natural (10%)',
    terminos: ['bergamota', 'kinoto', 'limon', 'lima', 'mandarina', 'naranja', 'pomelo'],
  },
  {
    ivaIndicador: 'MINIMA', esEstadoNatural: true, prioridad: 0, nota: 'Flores y plantas ornamentales (10%)',
    terminos: ['flor', 'ramo', 'planta', 'maceta', 'clavel', 'rosa', 'girasol', 'orquidea'],
  },
  {
    ivaIndicador: 'MINIMA', esEstadoNatural: false, prioridad: 5, nota: 'Almacén 1ª necesidad — tasa mínima por Título 10 (10%)',
    terminos: ['pan', 'arroz', 'fideo', 'pasta seca', 'aceite', 'azucar', 'yerba', 'cafe', 'sal', 'harina', 'carne', 'pollo', 'pescado'],
  },
  {
    ivaIndicador: 'EXENTO', esEstadoNatural: false, prioridad: 10, nota: 'Exentos de IVA',
    terminos: ['leche', 'libro', 'diario', 'revista'],
  },
  {
    ivaIndicador: 'BASICA', esEstadoNatural: false, prioridad: 10, nota: 'Elaborados/procesados — tasa básica (22%)',
    terminos: [
      'seco', 'pure', 'salsa', 'conserva', 'encurtido', 'mermelada', 'dulce', 'jalea', 'congelado', 'ensalada lista',
      'jugo', 'nectar', 'gaseosa', 'refresco', 'agua saborizada', 'snack', 'papas fritas', 'galleta', 'chocolate',
      'alfajor', 'cerveza', 'vino', 'fruto seco', 'mani', 'almendra', 'nuez', 'pasa de uva',
    ],
  },
  {
    ivaIndicador: 'BASICA', esEstadoNatural: false, prioridad: 10, nota: 'Limpieza / varios — tasa básica (22%)',
    terminos: ['detergente', 'jabon', 'lavandina', 'esponja', 'bolsa', 'papel higienico', 'servilleta', 'fosforo', 'vela'],
  },
];

/** Lista plana de reglas lista para insertar. */
export function ivaRulesSeed() {
  const out: Array<{ termino: string; ivaIndicador: IvaIndicador; esEstadoNatural: boolean; esImportado: boolean; prioridad: number; nota: string }> = [];
  for (const g of GRUPOS) {
    for (const termino of g.terminos) {
      out.push({
        termino,
        ivaIndicador: g.ivaIndicador,
        esEstadoNatural: g.esEstadoNatural,
        esImportado: g.esImportado ?? false,
        prioridad: g.prioridad,
        nota: g.nota,
      });
    }
  }
  return out;
}

/** Siembra/actualiza las reglas base (idempotente por término). */
export async function seedIvaRules(prisma: PrismaClient): Promise<number> {
  const reglas = ivaRulesSeed();
  for (const r of reglas) {
    await prisma.ivaRule.upsert({
      where: { termino: r.termino },
      update: { ivaIndicador: r.ivaIndicador, esEstadoNatural: r.esEstadoNatural, esImportado: r.esImportado, prioridad: r.prioridad, nota: r.nota },
      create: r,
    });
  }
  return reglas.length;
}
