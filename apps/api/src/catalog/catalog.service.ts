import { Injectable } from '@nestjs/common';
import { TipoListaPrecio } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';

export interface CatalogProduct {
  id: string;
  nombre: string;
  plu: number | null;
  codigoBarras: string | null;
  categoriaId: string | null;
  categoriaNombre: string | null;
  unidadVenta: string;
  esPesable: boolean;
  ivaIndicador: string;
  precio: number; // precio de mostrador (con IVA)
  imagenUrl: string | null; // foto del producto (para las cards del POS)
  /** Stock disponible (suma de sucursales). null = producto sin stock controlado. */
  stock: number | null;
}

export interface CatalogPromo {
  id: string;
  productId: string;
  nombre: string;
  tipo: string; // 'NXM' | 'CANTIDAD'
  llevaN: number;
  pagaM: number | null;
  precioTotal: number | null;
}

export interface CatalogResponse {
  updatedAt: string;
  listaPrecio: string | null;
  products: CatalogProduct[];
  promos: CatalogPromo[];
  /** Límite de efectivo en cajón (config del tenant; null = sin límite). */
  limiteEfectivoCaja: number | null;
  /** Fidelización: config de puntos para el canje en el POS. */
  loyalty: { activo: boolean; acumulaCada: number; valorPunto: number };
  /** Seguridad de caja (PIN centralizado): hash + puertas. El POS lo cachea y exige offline. */
  security: { pinHash: string | null; gates: Record<string, boolean> };
}

/**
 * Catálogo para el POS offline: productos activos con su precio de mostrador.
 * El POS lo cachea en IndexedDB para vender sin conexión.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getCatalog(tenantId: string): Promise<CatalogResponse> {
    const [lista, tenant] = await Promise.all([
      this.prisma.priceList.findFirst({
        where: { tenantId, tipo: TipoListaPrecio.MOSTRADOR, activo: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          limiteEfectivoCaja: true, loyaltyActivo: true, loyaltyAcumulaCada: true, loyaltyValorPunto: true,
          cajaPinHash: true, cajaGates: true,
        },
      }),
    ]);

    const productos = await this.prisma.product.findMany({
      where: { tenantId, activo: true },
      include: {
        categoria: true,
        priceItems: lista ? { where: { priceListId: lista.id } } : false,
        stockItems: true,
      },
      orderBy: { nombre: 'asc' },
    });

    const products: CatalogProduct[] = productos.map((p) => {
      const stockItems = (p as { stockItems?: Array<{ cantidad: unknown }> }).stockItems ?? [];
      // Sin filas de stock → producto no controlado (stock null = se vende sin límite).
      const stock = stockItems.length
        ? stockItems.reduce((s, x) => s + Number(x.cantidad), 0)
        : null;
      return {
        id: p.id,
        nombre: p.nombre,
        plu: p.plu,
        codigoBarras: p.codigoBarras,
        categoriaId: p.categoriaId,
        categoriaNombre: p.categoria?.nombre ?? null,
        unidadVenta: p.unidadVenta,
        esPesable: p.esPesable,
        ivaIndicador: p.ivaIndicador,
        precio: Number((p as { priceItems?: Array<{ precio: unknown }> }).priceItems?.[0]?.precio ?? 0),
        imagenUrl: p.imagenUrl,
        stock: stock == null ? null : Number(stock.toFixed(3)),
      };
    });

    // Promos activas y vigentes (dentro de desde/hasta si están definidas).
    const ahora = new Date();
    const promosRaw = await this.prisma.promo.findMany({
      where: {
        tenantId,
        activo: true,
        AND: [
          { OR: [{ desde: null }, { desde: { lte: ahora } }] },
          { OR: [{ hasta: null }, { hasta: { gte: ahora } }] },
        ],
      },
    });
    const promos: CatalogPromo[] = promosRaw.map((p) => ({
      id: p.id,
      productId: p.productId,
      nombre: p.nombre,
      tipo: p.tipo,
      llevaN: p.llevaN,
      pagaM: p.pagaM,
      precioTotal: p.precioTotal != null ? Number(p.precioTotal) : null,
    }));

    return {
      updatedAt: new Date().toISOString(),
      listaPrecio: lista?.nombre ?? null,
      products,
      promos,
      limiteEfectivoCaja: tenant?.limiteEfectivoCaja != null ? Number(tenant.limiteEfectivoCaja) : null,
      loyalty: {
        activo: tenant?.loyaltyActivo ?? false,
        acumulaCada: Number(tenant?.loyaltyAcumulaCada ?? 0),
        valorPunto: Number(tenant?.loyaltyValorPunto ?? 0),
      },
      security: {
        pinHash: tenant?.cajaPinHash ?? null,
        gates: normalizeCajaGates(tenant?.cajaGates),
      },
    };
  }
}

/** Normaliza las puertas de seguridad a los 4 flags conocidos. */
function normalizeCajaGates(raw: unknown): Record<string, boolean> {
  const src = (raw ?? {}) as Record<string, unknown>;
  return {
    discount: !!src.discount,
    price: !!src.price,
    void: !!src.void,
    return: !!src.return,
  };
}
