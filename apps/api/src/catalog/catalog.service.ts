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

export interface CatalogResponse {
  updatedAt: string;
  listaPrecio: string | null;
  products: CatalogProduct[];
}

/**
 * Catálogo para el POS offline: productos activos con su precio de mostrador.
 * El POS lo cachea en IndexedDB para vender sin conexión.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getCatalog(tenantId: string): Promise<CatalogResponse> {
    const lista = await this.prisma.priceList.findFirst({
      where: { tenantId, tipo: TipoListaPrecio.MOSTRADOR, activo: true },
      orderBy: { createdAt: 'asc' },
    });

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

    return {
      updatedAt: new Date().toISOString(),
      listaPrecio: lista?.nombre ?? null,
      products,
    };
  }
}
