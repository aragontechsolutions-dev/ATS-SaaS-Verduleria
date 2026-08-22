// Seed de desarrollo: crea una verdulería demo con catálogo típico uruguayo,
// lista de precios de mostrador y la config CFE apuntando al RUT de test de FEU.
//
// Ejecutar: npm run seed -w @ats/database

import {
  PrismaClient,
  IvaIndicador,
  UnidadMedida,
  Role,
  RegimenFiscal,
  TipoListaPrecio,
  ModuleKey,
  SubscriptionStatus,
} from '../client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Catálogo de planes (editable). Los módulos se activan por plan.
const PLANES: Array<{
  code: string;
  nombre: string;
  descripcion: string;
  precioMensual: number;
  orden: number;
  modules: ModuleKey[];
  maxUsuarios: number | null;
  maxSucursales: number | null;
  maxProductos: number | null;
  maxDispositivosPos: number | null;
}> = [
  {
    code: 'BASICO',
    nombre: 'Básico',
    descripcion: 'POS offline, catálogo y facturación electrónica para arrancar.',
    precioMensual: 0,
    orden: 1,
    modules: [ModuleKey.POS, ModuleKey.CFE, ModuleKey.INVENTORY],
    maxUsuarios: 2,
    maxSucursales: 1,
    maxProductos: 500,
    maxDispositivosPos: 1,
  },
  {
    code: 'PRO',
    nombre: 'Pro',
    descripcion: 'Suma compras, listas de precios, reportes avanzados y cuenta corriente.',
    precioMensual: 0,
    orden: 2,
    modules: [
      ModuleKey.POS,
      ModuleKey.CFE,
      ModuleKey.INVENTORY,
      ModuleKey.PURCHASES,
      ModuleKey.PRICING,
      ModuleKey.REPORTS_ADVANCED,
      ModuleKey.WHOLESALE,
    ],
    maxUsuarios: 5,
    maxSucursales: 1,
    maxProductos: 2000,
    maxDispositivosPos: 3,
  },
  {
    code: 'FULL',
    nombre: 'Full',
    descripcion: 'Todo: reparto con app, multi-sucursal y balanza en vivo.',
    precioMensual: 0,
    orden: 3,
    modules: [
      ModuleKey.POS,
      ModuleKey.CFE,
      ModuleKey.INVENTORY,
      ModuleKey.PURCHASES,
      ModuleKey.PRICING,
      ModuleKey.REPORTS_ADVANCED,
      ModuleKey.WHOLESALE,
      ModuleKey.DELIVERY,
      ModuleKey.MULTI_SUCURSAL,
      ModuleKey.SCALE_LIVE,
    ],
    maxUsuarios: null,
    maxSucursales: null,
    maxProductos: null,
    maxDispositivosPos: null,
  },
];

// Catálogo base (estacionalidad hemisferio sur simplificada). precio = mostrador con IVA.
const CATALOGO: Array<{
  plu: number;
  nombre: string;
  categoria: string;
  unidadVenta: UnidadMedida;
  unidadCompra: UnidadMedida;
  factor: number;
  precio: number;
  pesable: boolean;
  iva?: IvaIndicador;
}> = [
  { plu: 1, nombre: 'Tomate perita', categoria: 'Verduras', unidadVenta: 'KG', unidadCompra: 'CAJON', factor: 18, precio: 89, pesable: true },
  { plu: 2, nombre: 'Papa lavada', categoria: 'Tubérculos', unidadVenta: 'KG', unidadCompra: 'BOLSA', factor: 25, precio: 52, pesable: true },
  { plu: 3, nombre: 'Cebolla', categoria: 'Verduras', unidadVenta: 'KG', unidadCompra: 'BOLSA', factor: 25, precio: 48, pesable: true },
  { plu: 4, nombre: 'Lechuga mantecosa', categoria: 'Hoja', unidadVenta: 'UNIDAD', unidadCompra: 'CAJON', factor: 24, precio: 45, pesable: false },
  { plu: 5, nombre: 'Acelga', categoria: 'Hoja', unidadVenta: 'ATADO', unidadCompra: 'CAJON', factor: 20, precio: 40, pesable: false },
  { plu: 6, nombre: 'Morrón rojo', categoria: 'Verduras', unidadVenta: 'KG', unidadCompra: 'CAJON', factor: 10, precio: 190, pesable: true },
  { plu: 7, nombre: 'Zanahoria', categoria: 'Tubérculos', unidadVenta: 'KG', unidadCompra: 'BOLSA', factor: 20, precio: 55, pesable: true },
  { plu: 8, nombre: 'Manzana roja', categoria: 'Frutas', unidadVenta: 'KG', unidadCompra: 'CAJON', factor: 18, precio: 98, pesable: true },
  { plu: 9, nombre: 'Banana', categoria: 'Frutas', unidadVenta: 'KG', unidadCompra: 'CAJON', factor: 20, precio: 72, pesable: true },
  { plu: 10, nombre: 'Naranja', categoria: 'Frutas', unidadVenta: 'KG', unidadCompra: 'BOLSA', factor: 20, precio: 60, pesable: true },
];

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-maldonado' },
    update: {},
    create: {
      nombre: 'Verdulería Demo Maldonado',
      slug: 'demo-maldonado',
      rut: '218617380010', // RUT de test de FEU
      razonSocial: 'ACME VERDULERIA SRL',
      regimenFiscal: RegimenFiscal.LITERAL_E,
      direccion: 'Av. Roosevelt, Maldonado',
      cfeConfig: {
        create: {
          provider: 'FEU',
          ambiente: 'test',
          emisorRut: '218617380010',
          sucursalDefault: 1,
          codMontosBrutos: 1,
        },
      },
      sucursales: {
        create: { nombre: 'Casa central', codigo: 1, direccion: 'Av. Roosevelt, Maldonado' },
      },
    },
  });

  const passwordHash = await bcrypt.hash('aragon1234', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.uy' },
    update: { passwordHash },
    create: { email: 'admin@demo.uy', nombre: 'Admin Demo', homeTenantId: tenant.id, passwordHash },
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: admin.id } },
    update: {},
    create: { tenantId: tenant.id, userId: admin.id, role: Role.ADMIN },
  });

  // Planes (catálogo de niveles) y suscripción demo (Full para probar todo).
  const planesById = new Map<string, string>();
  for (const p of PLANES) {
    const plan = await prisma.plan.upsert({
      where: { code: p.code },
      update: {
        nombre: p.nombre,
        descripcion: p.descripcion,
        precioMensual: p.precioMensual,
        orden: p.orden,
        modules: p.modules,
        maxUsuarios: p.maxUsuarios,
        maxSucursales: p.maxSucursales,
        maxProductos: p.maxProductos,
        maxDispositivosPos: p.maxDispositivosPos,
      },
      create: {
        code: p.code,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precioMensual: p.precioMensual,
        orden: p.orden,
        modules: p.modules,
        maxUsuarios: p.maxUsuarios,
        maxSucursales: p.maxSucursales,
        maxProductos: p.maxProductos,
        maxDispositivosPos: p.maxDispositivosPos,
      },
    });
    planesById.set(p.code, plan.id);
  }

  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: { planId: planesById.get('FULL')!, estado: SubscriptionStatus.ACTIVA },
    create: { tenantId: tenant.id, planId: planesById.get('FULL')!, estado: SubscriptionStatus.ACTIVA },
  });

  const priceList = await prisma.priceList.upsert({
    where: { id: tenant.id }, // placeholder id; real lookup below
    update: {},
    create: { tenantId: tenant.id, nombre: 'Mostrador', tipo: TipoListaPrecio.MOSTRADOR },
  }).catch(async () => {
    return prisma.priceList.create({
      data: { tenantId: tenant.id, nombre: 'Mostrador', tipo: TipoListaPrecio.MOSTRADOR },
    });
  });

  // Categorías default con su tasa de IVA (docs/CFE-IVA.md §4). El producto
  // hereda la tasa de su categoría; el contador la puede editar por excepción.
  const IVA_POR_CATEGORIA: Record<string, IvaIndicador> = {
    Verduras: IvaIndicador.MINIMA,
    Hoja: IvaIndicador.MINIMA,
    Tubérculos: IvaIndicador.MINIMA,
    Frutas: IvaIndicador.MINIMA,
    Cítricos: IvaIndicador.MINIMA,
    'Flores y plantas': IvaIndicador.MINIMA,
    'Almacén - primera necesidad': IvaIndicador.MINIMA,
    'Almacén - elaborados/envasados': IvaIndicador.BASICA,
    'Procesados / cuarta gama': IvaIndicador.BASICA,
    'Lácteos - leche': IvaIndicador.EXENTO,
    'Limpieza / varios': IvaIndicador.BASICA,
  };

  const categoriasCache = new Map<string, string>();
  async function getCategoria(nombre: string): Promise<string> {
    if (categoriasCache.has(nombre)) return categoriasCache.get(nombre)!;
    const ivaDefault = IVA_POR_CATEGORIA[nombre] ?? IvaIndicador.MINIMA;
    const cat = await prisma.categoria.upsert({
      where: { tenantId_nombre: { tenantId: tenant.id, nombre } },
      update: { ivaIndicadorDefault: ivaDefault },
      create: { tenantId: tenant.id, nombre, ivaIndicadorDefault: ivaDefault },
    });
    categoriasCache.set(nombre, cat.id);
    return cat.id;
  }

  for (const p of CATALOGO) {
    const categoriaId = await getCategoria(p.categoria);
    const product = await prisma.product.upsert({
      where: { tenantId_plu: { tenantId: tenant.id, plu: p.plu } },
      update: {},
      create: {
        tenantId: tenant.id,
        nombre: p.nombre,
        categoriaId,
        plu: p.plu,
        unidadVenta: p.unidadVenta,
        unidadCompra: p.unidadCompra,
        factorConversion: p.factor,
        esPesable: p.pesable,
        // Hereda la tasa de la categoría (todos frescos en estado natural).
        ivaIndicador: p.iva ?? IVA_POR_CATEGORIA[p.categoria] ?? IvaIndicador.MINIMA,
        esEstadoNatural: true,
        esImportado: false,
        mermaPct: 0.06,
      },
    });
    await prisma.priceListItem.upsert({
      where: { priceListId_productId: { priceListId: priceList.id, productId: product.id } },
      update: { precio: p.precio },
      create: { tenantId: tenant.id, priceListId: priceList.id, productId: product.id, precio: p.precio },
    });
  }

  console.log(
    `✓ Seed OK. Tenant=${tenant.slug}  productos=${CATALOGO.length}  planes=${PLANES.length}  (sub demo=FULL)`,
  );
  console.log('  Login demo → admin@demo.uy / aragon1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
