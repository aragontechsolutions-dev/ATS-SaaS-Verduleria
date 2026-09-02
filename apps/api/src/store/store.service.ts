import { Injectable, NotFoundException } from '@nestjs/common';
import { TipoListaPrecio } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import { categoriasDeProductos, disponibleDeStock } from './store.helpers';

/** Un producto tal como lo ve la tienda online pública. */
export interface StoreProduct {
  id: string;
  nombre: string;
  descripcionOnline: string | null;
  categoriaId: string | null;
  categoriaNombre: string | null;
  unidadVenta: string;
  esPesable: boolean;
  /** Precio de mostrador con IVA (por kg si es pesable). */
  precio: number;
  imagenUrl: string | null;
  /** Hay stock para pedir. Productos sin stock controlado siempre disponibles. */
  disponible: boolean;
}

export interface StoreCategory {
  id: string;
  nombre: string;
}

export interface StoreCatalog {
  nombre: string;
  slug: string;
  categorias: StoreCategory[];
  productos: StoreProduct[];
}

/**
 * Catálogo público de la tienda online (e-commerce del tenant). Solo expone los
 * productos marcados "visible online" y activos, con el precio de mostrador y un
 * flag de disponibilidad (nunca el stock exacto). Sin autenticación: lo consume
 * la web pública por slug.
 */
@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicCatalog(slug: string): Promise<StoreCatalog> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug, activo: true },
      select: { id: true, nombre: true, slug: true, tiendaOnlineActiva: true },
    });
    if (!tenant || !tenant.tiendaOnlineActiva) {
      throw new NotFoundException('Tienda no encontrada');
    }

    const lista = await this.prisma.priceList.findFirst({
      where: { tenantId: tenant.id, tipo: TipoListaPrecio.MOSTRADOR, activo: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    const productos = await this.prisma.product.findMany({
      where: { tenantId: tenant.id, activo: true, visibleOnline: true },
      include: {
        categoria: true,
        priceItems: lista ? { where: { priceListId: lista.id } } : false,
        stockItems: true,
      },
      orderBy: { nombre: 'asc' },
    });

    const items: StoreProduct[] = productos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      descripcionOnline: p.descripcionOnline,
      categoriaId: p.categoriaId,
      categoriaNombre: p.categoria?.nombre ?? null,
      unidadVenta: p.unidadVenta,
      esPesable: p.esPesable,
      precio: Number(p.priceItems?.[0]?.precio ?? 0),
      imagenUrl: p.imagenUrl,
      disponible: disponibleDeStock(p.stockItems),
    }));

    const categorias: StoreCategory[] = categoriasDeProductos(items);

    return { nombre: tenant.nombre, slug: tenant.slug, categorias, productos: items };
  }
}
