// Seed de desarrollo: crea una verdulería demo con catálogo típico uruguayo,
// lista de precios de mostrador y la config CFE apuntando al RUT de test de FEU.
//
// Ejecutar: npm run seed -w @ats/database

import { PrismaClient, IvaIndicador, UnidadMedida, Role, RegimenFiscal, TipoListaPrecio } from '../client';

const prisma = new PrismaClient();

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

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.uy' },
    update: {},
    create: { email: 'admin@demo.uy', nombre: 'Admin Demo', homeTenantId: tenant.id },
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: admin.id } },
    update: {},
    create: { tenantId: tenant.id, userId: admin.id, role: Role.ADMIN },
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

  const categoriasCache = new Map<string, string>();
  async function getCategoria(nombre: string): Promise<string> {
    if (categoriasCache.has(nombre)) return categoriasCache.get(nombre)!;
    const cat = await prisma.categoria.upsert({
      where: { tenantId_nombre: { tenantId: tenant.id, nombre } },
      update: {},
      create: { tenantId: tenant.id, nombre },
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
        ivaIndicador: p.iva ?? IvaIndicador.MINIMA,
        mermaPct: 0.06,
      },
    });
    await prisma.priceListItem.upsert({
      where: { priceListId_productId: { priceListId: priceList.id, productId: product.id } },
      update: { precio: p.precio },
      create: { tenantId: tenant.id, priceListId: priceList.id, productId: product.id, precio: p.precio },
    });
  }

  console.log(`✓ Seed OK. Tenant=${tenant.slug}  productos=${CATALOGO.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
