// Reglas base del MOTOR DE IVA, sembradas desde la nómina oficial DGI
// (docs/CFE-IVA.md, Ley 19.407 + Título 10 Arts. 28/34/36). Son GLOBALES:
// aplican a todas las verdulerías. Aragon las edita/extiende desde la Consola.
// El fallback del motor es MÍNIMA + estado natural, así que una fruta/verdura no
// listada igual va a 10%.
//
// prioridad: 0 = fruta/verdura/flor/fruto seco natural · 5 = canasta Art. 36 ·
//            10 = elaborados / limpieza (ganan cuando el nombre mezcla términos) ·
//            20 = específicos que ganan al genérico (jabón común 10%, dulce de leche 22%)

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
      // ampliación catálogo verdulería
      'cilantro', 'ciboulette', 'laurel', 'romero', 'tomillo', 'menta', 'hierbabuena', 'jengibre',
      'zapallo kabutia', 'zapallo criollo', 'calabacin', 'endivia', 'diente de leon', 'brotes', 'germinado',
      'cebolla de verdeo', 'cebolla morada', 'papa criolla', 'batata',
    ],
  },
  {
    ivaIndicador: 'MINIMA', esEstadoNatural: true, prioridad: 0, nota: 'Frutas en estado natural (10%)',
    terminos: [
      'anana', 'banana', 'platano', 'cereza', 'ciruela', 'damasco', 'durazno', 'frambuesa', 'frutilla',
      'granada', 'grosella', 'guayabo', 'higo', 'kiwi', 'mango', 'manzana', 'membrillo', 'palta', 'papaya',
      'pelon', 'pera', 'uva', 'sandia', 'melon', 'arandano', 'mora', 'coco', 'maracuya',
      // ampliación
      'nectarin', 'caqui', 'tuna', 'chirimoya', 'zarzamora', 'physalis', 'granadilla', 'durazno blanco',
    ],
  },
  {
    ivaIndicador: 'MINIMA', esEstadoNatural: true, prioridad: 0, nota: 'Cítricos en estado natural (10%)',
    terminos: ['bergamota', 'kinoto', 'limon', 'lima', 'mandarina', 'naranja', 'pomelo'],
  },
  {
    ivaIndicador: 'MINIMA', esEstadoNatural: true, prioridad: 0, nota: 'Flores y plantas ornamentales (10%)',
    terminos: ['flor', 'ramo', 'planta', 'maceta', 'plantin', 'clavel', 'rosa', 'girasol', 'orquidea', 'crisantemo'],
  },
  {
    // Frutos secos y desecados A GRANEL / estado natural → 10% (agropecuario natural).
    // Envasados o procesados van a 22%: el contador lo ajusta por producto (override).
    ivaIndicador: 'MINIMA', esEstadoNatural: true, prioridad: 0, nota: 'Frutos secos a granel en estado natural (10%). Envasado/procesado → override 22%.',
    terminos: ['mani', 'nuez', 'almendra', 'castana', 'avellana', 'pistacho', 'pasa de uva', 'pasa', 'ciruela pasa', 'orejon'],
  },
  {
    ivaIndicador: 'MINIMA', esEstadoNatural: false, prioridad: 5, nota: 'Canasta tasa mínima — Título 10 Art. 36 (10%)',
    terminos: [
      'pan', 'arroz', 'fideo', 'pasta seca', 'aceite', 'azucar', 'yerba', 'cafe', 'te', 'sal', 'harina',
      'carne', 'pollo', 'pescado', 'menudencia', 'grasa comestible',
    ],
  },
  {
    // Específicos "común/de campaña" del Art. 36: ganan sobre el genérico (jabón/galleta 22%).
    ivaIndicador: 'MINIMA', esEstadoNatural: false, prioridad: 20, nota: 'Art. 36 específico — jabón común / galleta de campaña (10%)',
    terminos: ['jabon comun', 'jabon blanco', 'galleta de campana', 'galleta de campaña'],
  },
  {
    ivaIndicador: 'EXENTO', esEstadoNatural: false, prioridad: 10, nota: 'Exentos de IVA (huevos, leche, miel, libros/diarios)',
    terminos: ['leche', 'huevo', 'miel', 'libro', 'diario', 'revista'],
  },
  {
    // Procesados lácteos que contienen "leche" pero NO son exentos: ganan al exento.
    ivaIndicador: 'BASICA', esEstadoNatural: false, prioridad: 20, nota: 'Derivados procesados de leche — 22%',
    terminos: ['dulce de leche', 'leche condensada', 'leche en polvo'],
  },
  {
    // Nota: congelar/enfriar es CONSERVACIÓN → mantiene estado natural. Carne,
    // pescado y verdura simplemente congelados siguen a 10% (Art. 36 / Art. 28),
    // por eso NO se lista "congelado" como básica. Solo lo transformado va a 22%.
    ivaIndicador: 'BASICA', esEstadoNatural: false, prioridad: 10, nota: 'Elaborados/procesados — tasa básica (22%). No es "estado natural".',
    terminos: [
      'tomate seco', 'pure', 'salsa', 'conserva', 'encurtido', 'mermelada', 'dulce', 'jalea', 'ensalada lista',
      'triturado', 'enlatado', 'en lata', 'deshidratado', 'almibar', 'rallado', 'pickle', 'aceituna', 'milanesa', 'prefrito',
      'jugo', 'nectar', 'gaseosa', 'refresco', 'agua saborizada', 'agua mineral', 'snack', 'papas fritas', 'galleta', 'chocolate',
      'alfajor', 'cerveza', 'vino', 'golosina', 'caramelo', 'helado', 'yogur', 'queso', 'fiambre', 'embutido',
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
