import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';

/** Tiempo de inactividad tras el cual, al entrar un visitante nuevo, se limpia la demo. */
const TTL_MS = 30 * 60 * 1000;

interface Snapshot {
  categorias: any[];
  suppliers: any[];
  products: any[];
  stock: any[];
  precios: any[];
  memberships: { userId: string; role: string; activo: boolean }[];
}

// Mapeos explícitos (el snapshot pasa por JSONB: Decimals → string, fechas → ISO).
const mapCategoria = (c: any): any => ({
  id: c.id, tenantId: c.tenantId, nombre: c.nombre, orden: c.orden ?? 0,
  color: c.color ?? null, ivaIndicadorDefault: c.ivaIndicadorDefault,
});
const mapSupplier = (s: any): any => ({
  id: s.id, tenantId: s.tenantId, nombre: s.nombre, rut: s.rut ?? null,
  telefono: s.telefono ?? null, esUam: !!s.esUam, activo: s.activo ?? true,
});
const mapProduct = (p: any): any => ({
  id: p.id, tenantId: p.tenantId, nombre: p.nombre, categoriaId: p.categoriaId ?? null,
  plu: p.plu ?? null, codigoBarras: p.codigoBarras ?? null, imagenUrl: p.imagenUrl ?? null,
  unidadCompra: p.unidadCompra, unidadVenta: p.unidadVenta, factorConversion: p.factorConversion,
  esPesable: p.esPesable, visibleOnline: p.visibleOnline, descripcionOnline: p.descripcionOnline ?? null,
  ivaIndicador: p.ivaIndicador, esEstadoNatural: p.esEstadoNatural, esImportado: p.esImportado,
  ivaOverride: p.ivaOverride, ivaRegla: p.ivaRegla ?? null, mermaPct: p.mermaPct,
  proveedorId: p.proveedorId ?? null, stockMinimo: p.stockMinimo ?? null, activo: p.activo,
  createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
});
const mapStock = (s: any): any => ({
  id: s.id, tenantId: s.tenantId, productId: s.productId, sucursalId: s.sucursalId ?? null,
  cantidad: s.cantidad, costoPromedio: s.costoPromedio,
});
const mapPrecio = (p: any): any => ({
  id: p.id, tenantId: p.tenantId, priceListId: p.priceListId, productId: p.productId, precio: p.precio,
});

@Injectable()
export class DemoService {
  private readonly log = new Logger('DemoService');

  constructor(private readonly prisma: PrismaService) {}

  async estado(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { esDemo: true, demoActividadAt: true, demoSnapshot: true },
    });
    return { esDemo: !!t?.esDemo, tieneBase: !!t?.demoSnapshot, demoActividadAt: t?.demoActividadAt ?? null };
  }

  /** ¿El tenant está marcado como demo? (para guards de otras partes). */
  async esDemo(tenantId?: string | null): Promise<boolean> {
    if (!tenantId) return false;
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { esDemo: true } });
    return !!t?.esDemo;
  }

  /** Guarda la "foto" actual (catálogo + usuarios) como base a restaurar. */
  async guardarBase(tenantId: string) {
    const [categorias, suppliers, products, stock, precios, memberships] = await Promise.all([
      this.prisma.categoria.findMany({ where: { tenantId } }),
      this.prisma.supplier.findMany({ where: { tenantId } }),
      this.prisma.product.findMany({ where: { tenantId } }),
      this.prisma.stock.findMany({ where: { tenantId } }),
      this.prisma.priceListItem.findMany({ where: { tenantId } }),
      this.prisma.membership.findMany({ where: { tenantId }, select: { userId: true, role: true, activo: true } }),
    ]);
    const snapshot: Snapshot = {
      categorias, suppliers, products, stock, precios,
      memberships: memberships.map((m) => ({ userId: m.userId, role: m.role, activo: m.activo })),
    };
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        esDemo: true,
        demoSnapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
        demoActividadAt: new Date(),
      },
    });
    return { ok: true, productos: products.length, categorias: categorias.length, usuarios: memberships.length };
  }

  async desmarcar(tenantId: string) {
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { esDemo: false } });
    return { ok: true };
  }

  /** Marca actividad reciente (evita limpiar mientras alguien está usando la demo). */
  async touch(tenantId: string) {
    await this.prisma.tenant
      .update({ where: { id: tenantId }, data: { demoActividadAt: new Date() } })
      .catch(() => undefined);
  }

  /** Si es demo, tiene base y pasó el tiempo de inactividad, restaura. Devuelve si limpió. */
  async resetSiVencio(tenantId: string): Promise<boolean> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { esDemo: true, demoActividadAt: true, demoSnapshot: true },
    });
    if (!t?.esDemo || !t.demoSnapshot) return false;
    const ultima = t.demoActividadAt ? t.demoActividadAt.getTime() : 0;
    if (Date.now() - ultima < TTL_MS) return false;
    await this.restaurar(tenantId, t.demoSnapshot as unknown as Snapshot);
    return true;
  }

  /** Restaura la demo a la base guardada (borra lo que cargó un visitante). */
  async restaurar(tenantId: string, snap?: Snapshot) {
    let s = snap;
    if (!s) {
      const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { demoSnapshot: true } });
      s = (t?.demoSnapshot as unknown as Snapshot) ?? undefined;
    }
    if (!s) throw new Error('La demo no tiene una base guardada.');
    const base = s;

    await this.prisma.$transaction(
      async (tx) => {
        // 1) Borra transaccional + catálogo. Las tablas hijas caen por cascada;
        //    los cruces entre "padres" son SetNull, así que este orden es seguro.
        await tx.sale.deleteMany({ where: { tenantId } });
        await tx.onlineOrder.deleteMany({ where: { tenantId } });
        await tx.deliveryOrder.deleteMany({ where: { tenantId } });
        await tx.route.deleteMany({ where: { tenantId } });
        await tx.repartidorEstado.deleteMany({ where: { tenantId } });
        await tx.purchase.deleteMany({ where: { tenantId } });
        await tx.cashSession.deleteMany({ where: { tenantId } });
        await tx.customer.deleteMany({ where: { tenantId } });
        await tx.terminal.deleteMany({ where: { tenantId } });
        await tx.cfeDocument.deleteMany({ where: { tenantId } });
        await tx.auditEvent.deleteMany({ where: { tenantId } });
        // Product cascada: stock, movimientos, precios, promos, merma, vencimientos.
        await tx.product.deleteMany({ where: { tenantId } });
        await tx.categoria.deleteMany({ where: { tenantId } });
        await tx.supplier.deleteMany({ where: { tenantId } });

        // 2) Restaura el catálogo con los ids originales.
        if (base.categorias?.length) await tx.categoria.createMany({ data: base.categorias.map(mapCategoria) });
        if (base.suppliers?.length) await tx.supplier.createMany({ data: base.suppliers.map(mapSupplier) });
        if (base.products?.length) await tx.product.createMany({ data: base.products.map(mapProduct) });
        if (base.stock?.length) await tx.stock.createMany({ data: base.stock.map(mapStock) });
        if (base.precios?.length) await tx.priceListItem.createMany({ data: base.precios.map(mapPrecio) });

        // 3) Usuarios: elimina los que agregó un visitante y restaura los de la base
        //    (activos y desbloqueados).
        const ids = base.memberships.map((m) => m.userId);
        await tx.membership.deleteMany({ where: { tenantId, userId: { notIn: ids.length ? ids : ['00000000-0000-0000-0000-000000000000'] } } });
        for (const m of base.memberships) {
          await tx.membership.updateMany({ where: { tenantId, userId: m.userId }, data: { activo: true, role: m.role as any } });
          await tx.user.update({ where: { id: m.userId }, data: { bloqueado: false, failedLoginAttempts: 0 } }).catch(() => undefined);
        }

        await tx.tenant.update({ where: { id: tenantId }, data: { demoActividadAt: new Date() } });
      },
      { timeout: 30000, maxWait: 15000 },
    );

    this.log.log(`Demo ${tenantId} restaurada a la base.`);
  }
}
