import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockMovementType, TipoListaPrecio } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import { costoUnitConMerma, margenPct, promedioPonderado } from '../common/money';
import { normalizeUyPhone } from '../landing/landing.types';
import type {
  CreatePurchaseDto,
  CreateSupplierDto,
  CreateWasteDto,
  StockAdjustDto,
  UpdateSupplierDto,
} from './purchases.dto';

const num = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : Number(v));

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Proveedores ----------------------------------------------------------

  async listSuppliers(tenantId: string) {
    return this.prisma.supplier.findMany({
      where: { tenantId },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    });
  }

  async createSupplier(tenantId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        tenantId,
        nombre: dto.nombre,
        rut: dto.rut,
        telefono: dto.telefono ? normalizeUyPhone(dto.telefono) : dto.telefono,
        esUam: dto.esUam ?? false,
      },
    });
  }

  async updateSupplier(tenantId: string, id: string, dto: UpdateSupplierDto) {
    const sup = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!sup) throw new NotFoundException('Proveedor no encontrado');
    return this.prisma.supplier.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        rut: dto.rut,
        telefono: dto.telefono !== undefined ? normalizeUyPhone(dto.telefono) : undefined,
        esUam: dto.esUam,
        activo: dto.activo,
      },
    });
  }

  // --- Compras --------------------------------------------------------------

  async listPurchases(tenantId: string, limit = 50) {
    const purchases = await this.prisma.purchase.findMany({
      where: { tenantId },
      orderBy: { fecha: 'desc' },
      take: limit,
      include: { supplier: true, _count: { select: { items: true } } },
    });
    return purchases.map((p) => ({
      id: p.id,
      fecha: p.fecha,
      supplierId: p.supplierId,
      supplierNombre: p.supplier?.nombre ?? null,
      total: num(p.total),
      lineas: p._count.items,
      notas: p.notas,
    }));
  }

  async getPurchase(tenantId: string, id: string) {
    const p = await this.prisma.purchase.findFirst({
      where: { id, tenantId },
      include: { supplier: true, items: { include: { product: true } } },
    });
    if (!p) throw new NotFoundException('Compra no encontrada');
    return {
      id: p.id,
      fecha: p.fecha,
      supplierId: p.supplierId,
      supplierNombre: p.supplier?.nombre ?? null,
      total: num(p.total),
      notas: p.notas,
      items: p.items.map((it) => {
        const rinde = num(it.rindeVenta) || num(it.cantidadCompra) * num(it.product.factorConversion);
        const costoLinea = num(it.cantidadCompra) * num(it.costoUnitCompra);
        return {
          productId: it.productId,
          nombre: it.product.nombre,
          unidadCompra: it.product.unidadCompra,
          unidadVenta: it.product.unidadVenta,
          cantidadCompra: num(it.cantidadCompra),
          costoUnitCompra: num(it.costoUnitCompra),
          rindeVenta: rinde,
          costoUnitVenta: rinde > 0 ? Number((costoLinea / rinde).toFixed(4)) : 0,
          subtotal: Number(costoLinea.toFixed(2)),
        };
      }),
    };
  }

  /**
   * Registra una compra: crea la Purchase + PurchaseItems, y por cada línea
   * incorpora el rinde al stock recalculando el costo promedio ponderado
   * (incluyendo la merma estimada del producto) y deja el movimiento de stock.
   */
  async createPurchase(tenantId: string, dto: CreatePurchaseDto) {
    if (dto.supplierId) {
      const sup = await this.prisma.supplier.findFirst({ where: { id: dto.supplierId, tenantId } });
      if (!sup) throw new BadRequestException('Proveedor inexistente');
    }

    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({ where: { tenantId, id: { in: productIds } } });
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const it of dto.items) {
      if (!byId.has(it.productId)) throw new BadRequestException('Producto inexistente en la compra');
    }

    const sucursalId = await this.resolveSucursalId(tenantId, dto.sucursalId);

    return this.prisma.$transaction(async (tx) => {
      let total = 0;
      const purchase = await tx.purchase.create({
        data: {
          tenantId,
          supplierId: dto.supplierId,
          fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
          notas: dto.notas,
          total: new Prisma.Decimal(0),
        },
      });

      for (const it of dto.items) {
        const prod = byId.get(it.productId)!;
        const factor = num(prod.factorConversion) || 1;
        const rinde = it.rindeVenta && it.rindeVenta > 0 ? it.rindeVenta : it.cantidadCompra * factor;
        if (rinde <= 0) throw new BadRequestException(`Rinde inválido para ${prod.nombre}`);

        const costoLinea = it.cantidadCompra * it.costoUnitCompra;
        total += costoLinea;

        const costoUnitVenta = costoUnitConMerma(costoLinea, rinde, num(prod.mermaPct));

        await tx.purchaseItem.create({
          data: {
            tenantId,
            purchaseId: purchase.id,
            productId: it.productId,
            cantidadCompra: new Prisma.Decimal(it.cantidadCompra),
            costoUnitCompra: new Prisma.Decimal(it.costoUnitCompra),
            rindeVenta: new Prisma.Decimal(rinde),
          },
        });

        // Stock: promedio ponderado sobre el stock físico existente.
        const stock = await tx.stock.findUnique({
          where: { productId_sucursalId: { productId: it.productId, sucursalId } },
        });
        const prevCant = num(stock?.cantidad);
        const prevCosto = num(stock?.costoPromedio);
        const nuevaCant = prevCant + rinde;
        const nuevoCosto = promedioPonderado(prevCant, prevCosto, rinde, costoUnitVenta);

        if (stock) {
          await tx.stock.update({
            where: { id: stock.id },
            data: { cantidad: new Prisma.Decimal(nuevaCant), costoPromedio: new Prisma.Decimal(nuevoCosto) },
          });
        } else {
          await tx.stock.create({
            data: {
              tenantId,
              productId: it.productId,
              sucursalId,
              cantidad: new Prisma.Decimal(nuevaCant),
              costoPromedio: new Prisma.Decimal(nuevoCosto),
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: it.productId,
            tipo: StockMovementType.COMPRA,
            cantidad: new Prisma.Decimal(rinde),
            costoUnit: new Prisma.Decimal(costoUnitVenta),
            motivo: 'Compra',
            refId: purchase.id,
          },
        });
      }

      const updated = await tx.purchase.update({
        where: { id: purchase.id },
        data: { total: new Prisma.Decimal(total) },
      });
      return { id: updated.id, total: num(updated.total) };
    });
  }

  // --- Stock ----------------------------------------------------------------

  async listStock(tenantId: string, sucursalId?: string) {
    const listId = await this.mostradorListId(tenantId);
    const products = await this.prisma.product.findMany({
      where: { tenantId, activo: true },
      orderBy: { nombre: 'asc' },
      include: {
        categoria: true,
        stockItems: sucursalId ? { where: { sucursalId } } : true,
        priceItems: { where: { priceListId: listId } },
      },
    });

    return products.map((p) => {
      const cantidad = p.stockItems.reduce((s, x) => s + num(x.cantidad), 0);
      // Costo promedio ponderado entre sucursales.
      const costoPeso = p.stockItems.reduce((s, x) => s + num(x.cantidad) * num(x.costoPromedio), 0);
      const costoPromedio = cantidad > 0 ? costoPeso / cantidad : num(p.stockItems[0]?.costoPromedio);
      const precio = num(p.priceItems[0]?.precio);
      const margen = costoPromedio > 0 ? margenPct(precio, costoPromedio) : null;
      return {
        productId: p.id,
        nombre: p.nombre,
        categoriaNombre: p.categoria?.nombre ?? null,
        unidadVenta: p.unidadVenta,
        cantidad: Number(cantidad.toFixed(3)),
        costoPromedio: Number(costoPromedio.toFixed(4)),
        precio,
        margenPct: margen == null ? null : Number(margen.toFixed(1)),
      };
    });
  }

  /** Ajuste manual de stock (delta). tipo = AJUSTE. */
  async adjustStock(tenantId: string, dto: StockAdjustDto) {
    const prod = await this.prisma.product.findFirst({ where: { id: dto.productId, tenantId } });
    if (!prod) throw new BadRequestException('Producto inexistente');
    if (dto.cantidad === 0) throw new BadRequestException('El ajuste no puede ser 0');

    const sucursalId = await this.resolveSucursalId(tenantId, dto.sucursalId);

    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.stock.findUnique({
        where: { productId_sucursalId: { productId: dto.productId, sucursalId } },
      });
      const prevCant = num(stock?.cantidad);
      const nuevaCant = prevCant + dto.cantidad;
      if (nuevaCant < 0) throw new BadRequestException('El ajuste dejaría stock negativo');

      if (stock) {
        await tx.stock.update({ where: { id: stock.id }, data: { cantidad: new Prisma.Decimal(nuevaCant) } });
      } else {
        await tx.stock.create({
          data: { tenantId, productId: dto.productId, sucursalId, cantidad: new Prisma.Decimal(nuevaCant) },
        });
      }

      await tx.stockMovement.create({
        data: {
          tenantId,
          productId: dto.productId,
          tipo: StockMovementType.AJUSTE,
          cantidad: new Prisma.Decimal(dto.cantidad),
          motivo: dto.motivo ?? 'Ajuste manual',
        },
      });
      return { productId: dto.productId, cantidad: Number(nuevaCant.toFixed(3)) };
    });
  }

  // --- Merma ----------------------------------------------------------------

  async listWaste(tenantId: string, limit = 50) {
    const rows = await this.prisma.waste.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { product: true },
    });
    return rows.map((w) => ({
      id: w.id,
      fecha: w.createdAt,
      productId: w.productId,
      nombre: w.product.nombre,
      unidadVenta: w.product.unidadVenta,
      cantidad: num(w.cantidad),
      costoUnit: num(w.costoUnit),
      costoTotal: Number((num(w.cantidad) * num(w.costoUnit)).toFixed(2)),
      motivo: w.motivo,
    }));
  }

  async createWaste(tenantId: string, dto: CreateWasteDto) {
    const prod = await this.prisma.product.findFirst({ where: { id: dto.productId, tenantId } });
    if (!prod) throw new BadRequestException('Producto inexistente');

    const sucursalId = await this.resolveSucursalId(tenantId, dto.sucursalId);

    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.stock.findUnique({
        where: { productId_sucursalId: { productId: dto.productId, sucursalId } },
      });
      const costoUnit = num(stock?.costoPromedio);
      const prevCant = num(stock?.cantidad);
      const nuevaCant = Math.max(0, prevCant - dto.cantidad);

      if (stock) {
        await tx.stock.update({ where: { id: stock.id }, data: { cantidad: new Prisma.Decimal(nuevaCant) } });
      }

      const waste = await tx.waste.create({
        data: {
          tenantId,
          productId: dto.productId,
          cantidad: new Prisma.Decimal(dto.cantidad),
          costoUnit: new Prisma.Decimal(costoUnit),
          motivo: dto.motivo,
        },
      });

      await tx.stockMovement.create({
        data: {
          tenantId,
          productId: dto.productId,
          tipo: StockMovementType.MERMA,
          cantidad: new Prisma.Decimal(-dto.cantidad),
          costoUnit: new Prisma.Decimal(costoUnit),
          motivo: dto.motivo ?? 'Merma',
          refId: waste.id,
        },
      });
      return { id: waste.id, costoTotal: Number((dto.cantidad * costoUnit).toFixed(2)) };
    });
  }

  // --- Helpers --------------------------------------------------------------

  /**
   * Resuelve la sucursal destino: si viene una, valida que sea del tenant; si
   * no, usa la principal (la crea si el tenant aún no tiene ninguna).
   */
  private async resolveSucursalId(tenantId: string, sucursalId?: string): Promise<string> {
    if (sucursalId) {
      const suc = await this.prisma.sucursal.findFirst({ where: { id: sucursalId, tenantId } });
      if (!suc) throw new BadRequestException('Sucursal inexistente');
      return suc.id;
    }
    const suc = await this.prisma.sucursal.findFirst({
      where: { tenantId, activo: true },
      orderBy: { codigo: 'asc' },
    });
    if (suc) return suc.id;
    const created = await this.prisma.sucursal.create({
      data: { tenantId, nombre: 'Casa central', codigo: 1 },
    });
    return created.id;
  }

  private async mostradorListId(tenantId: string): Promise<string> {
    const existing = await this.prisma.priceList.findFirst({
      where: { tenantId, tipo: TipoListaPrecio.MOSTRADOR },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing.id;
    const created = await this.prisma.priceList.create({
      data: { tenantId, nombre: 'Mostrador', tipo: TipoListaPrecio.MOSTRADOR },
    });
    return created.id;
  }
}
