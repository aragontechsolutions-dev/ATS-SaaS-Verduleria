import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import { defaultLanding, normalizeLanding, type LandingConfig } from './landing.types';

@Injectable()
export class LandingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Config de edición del tenant (crea el borrador por defecto si no existe). */
  async getForAdmin(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { nombre: true, slug: true, direccion: true, landing: true },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    let landing = tenant.landing;
    if (!landing) {
      const draft = defaultLanding(tenant.nombre, tenant.direccion);
      landing = await this.prisma.tenantLanding.create({
        data: { tenantId, draft: draft as unknown as Prisma.InputJsonValue },
      });
    }

    return {
      slug: tenant.slug,
      estaPublicado: landing.estaPublicado,
      draft: normalizeLanding(landing.draft, tenant.nombre),
    };
  }

  /** Guarda el borrador (normalizado). */
  async saveDraft(tenantId: string, raw: unknown) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { nombre: true } });
    const config: LandingConfig = normalizeLanding(raw, tenant?.nombre);
    await this.prisma.tenantLanding.upsert({
      where: { tenantId },
      create: { tenantId, draft: config as unknown as Prisma.InputJsonValue },
      update: { draft: config as unknown as Prisma.InputJsonValue },
    });
    return { draft: config };
  }

  /** Publica: copia el borrador al snapshot público. */
  async publish(tenantId: string) {
    const existing = await this.prisma.tenantLanding.findUnique({ where: { tenantId } });
    const draft = existing?.draft ?? (defaultLanding('Mi verdulería') as unknown as Prisma.JsonValue);
    await this.prisma.tenantLanding.upsert({
      where: { tenantId },
      create: {
        tenantId,
        draft: draft as unknown as Prisma.InputJsonValue,
        publicado: draft as unknown as Prisma.InputJsonValue,
        estaPublicado: true,
      },
      update: { publicado: draft as unknown as Prisma.InputJsonValue, estaPublicado: true },
    });
    return { estaPublicado: true };
  }

  /** Baja de publicación (deja de mostrarse al público). */
  async unpublish(tenantId: string) {
    await this.prisma.tenantLanding.updateMany({ where: { tenantId }, data: { estaPublicado: false } });
    return { estaPublicado: false };
  }

  /** Vista pública por slug (solo si está publicada). Sin auth. */
  async getPublic(slug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug, activo: true },
      select: { id: true, nombre: true, telefono: true, landing: true },
    });
    if (!tenant || !tenant.landing || !tenant.landing.estaPublicado || !tenant.landing.publicado) {
      throw new NotFoundException('Página no encontrada');
    }
    const config = normalizeLanding(tenant.landing.publicado, tenant.nombre);

    // Productos elegidos del catálogo → resuelve foto/precio y filtra por stock.
    if (config.productos.productIds.length) {
      const items = await this.resolveProductos(tenant.id, config.productos.productIds);
      config.productos = { ...config.productos, items };
    }

    return { nombre: tenant.nombre, config };
  }

  /**
   * Resuelve una lista de productos del catálogo a items para la web: nombre,
   * precio de mostrador formateado y foto actuales. Solo devuelve los que
   * tienen stock (> 0), preservando el orden elegido.
   */
  private async resolveProductos(tenantId: string, ids: string[]) {
    const listId = await this.mostradorListId(tenantId);
    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: ids }, activo: true },
      include: { priceItems: { where: { priceListId: listId } }, stockItems: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const out: Array<{ nombre: string; precio: string; imagenUrl: string }> = [];
    for (const id of ids) {
      const p = byId.get(id);
      if (!p) continue;
      const stock = p.stockItems.reduce((s, x) => s + Number(x.cantidad), 0);
      if (stock <= 0) continue; // sin stock → no se publica
      const precio = Number(p.priceItems[0]?.precio ?? 0);
      out.push({ nombre: p.nombre, precio: formatPrecio(precio, p.unidadVenta), imagenUrl: p.imagenUrl ?? '' });
    }
    return out;
  }

  private async mostradorListId(tenantId: string): Promise<string> {
    const list = await this.prisma.priceList.findFirst({
      where: { tenantId, tipo: 'MOSTRADOR' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return list?.id ?? '';
  }
}

const UNIDAD_CORTA: Record<string, string> = {
  KG: 'kg', GRAMO: 'g', UNIDAD: 'un', ATADO: 'atado', DOCENA: 'docena', BANDEJA: 'bandeja',
  CAJON: 'cajón', BOLSA: 'bolsa', BIN: 'bin', BULTO: 'bulto',
};

function formatPrecio(precio: number, unidad: string): string {
  if (precio <= 0) return '';
  const monto = precio.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const u = UNIDAD_CORTA[unidad] ?? unidad.toLowerCase();
  return `$${monto} /${u}`;
}
