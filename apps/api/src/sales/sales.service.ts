import { BadRequestException, Injectable } from '@nestjs/common';
import { IvaIndicador, MedioPago, Prisma, SaleStatus, StockMovementType } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant-context';
import type { CreateSaleDto } from './sales.dto';

/** Tasa efectiva por indicador (para desglosar el IVA incluido en el precio). */
const TASA: Record<IvaIndicador, number> = {
  EXENTO: 0,
  MINIMA: 0.1,
  BASICA: 0.22,
  SUSPENSO: 0,
};

const num = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : Number(v));

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una venta de forma IDEMPOTENTE por idempotencyKey. Si el POS reintenta
   * (tras recuperar conexión) con la misma clave, devuelve la venta existente
   * sin duplicar. Esta clave es también el id_externo del CFE.
   */
  async createSale(tenantId: string, dto: CreateSaleDto) {
    if (!dto.idempotencyKey) throw new BadRequestException('Falta idempotencyKey');
    if (!dto.items?.length) throw new BadRequestException('La venta no tiene ítems');

    const existing = await this.prisma.sale.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: { items: true, payments: true, cfeDocument: true },
    });
    if (existing) {
      if (existing.tenantId !== tenantId) throw new BadRequestException('Clave de venta de otro tenant');
      return existing;
    }

    // Sucursal que descuenta stock: la de la venta, la de la caja abierta, o la principal.
    const sucursalId = await this.resolveSucursalId(tenantId, dto);

    // Costo real por producto en esa sucursal (para rentabilidad y descuento).
    const productIds = [...new Set(dto.items.map((it) => it.productId).filter((x): x is string => !!x))];
    const stockByProduct = new Map<string, { id: string; cantidad: number; costo: number }>();
    if (sucursalId && productIds.length) {
      const stocks = await this.prisma.stock.findMany({
        where: { tenantId, sucursalId, productId: { in: productIds } },
      });
      for (const s of stocks) {
        stockByProduct.set(s.productId, { id: s.id, cantidad: num(s.cantidad), costo: num(s.costoPromedio) });
      }
    }

    // Totales. Los precios vienen con IVA incluido.
    let subtotal = new Prisma.Decimal(0);
    let descuentoTotal = new Prisma.Decimal(0);
    let ivaTotal = new Prisma.Decimal(0);

    const items = dto.items.map((it) => {
      const bruto = new Prisma.Decimal(it.cantidad).mul(it.precioUnit);
      const desc = new Prisma.Decimal(it.descuento ?? 0);
      const lineaTotal = bruto.minus(desc);
      const tasa = TASA[it.ivaIndicador] ?? 0;
      const ivaLinea = tasa > 0 ? lineaTotal.minus(lineaTotal.div(1 + tasa)) : new Prisma.Decimal(0);

      subtotal = subtotal.plus(bruto);
      descuentoTotal = descuentoTotal.plus(desc);
      ivaTotal = ivaTotal.plus(ivaLinea);

      const stock = it.productId ? stockByProduct.get(it.productId) : undefined;

      return {
        tenantId,
        productId: it.productId,
        concepto: it.concepto,
        unidad: it.unidad,
        cantidad: new Prisma.Decimal(it.cantidad),
        precioUnit: new Prisma.Decimal(it.precioUnit),
        descuento: desc,
        ivaIndicador: it.ivaIndicador,
        costoUnit: stock ? new Prisma.Decimal(stock.costo) : null,
        total: lineaTotal,
      };
    });

    const total = subtotal.minus(descuentoTotal);

    const payments = (dto.payments ?? []).map((p) => ({
      tenantId,
      medio: p.medio,
      monto: new Prisma.Decimal(p.monto),
      referencia: p.referencia,
    }));

    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          tenantId,
          sucursalId: dto.sucursalId,
          cashSessionId: dto.cashSessionId,
          cajeroId: getTenantContext()?.userId,
          customerId: dto.customerId,
          status: SaleStatus.COMPLETADA,
          idempotencyKey: dto.idempotencyKey,
          fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
          subtotal,
          descuento: descuentoTotal,
          ivaTotal,
          total,
          items: { create: items },
          payments: { create: payments },
        },
        include: { items: true, payments: true, cfeDocument: true },
      });

      // Descuento de stock por sucursal (solo productos que ya se están
      // controlando: si no hay fila de stock, no se crea una en negativo).
      if (sucursalId) {
        // Sumamos cantidades por producto (una venta puede repetir el mismo).
        const vendidoPorProducto = new Map<string, number>();
        for (const it of dto.items) {
          if (!it.productId) continue;
          vendidoPorProducto.set(it.productId, (vendidoPorProducto.get(it.productId) ?? 0) + it.cantidad);
        }
        for (const [productId, cantidad] of vendidoPorProducto) {
          const stock = stockByProduct.get(productId);
          if (!stock || cantidad <= 0) continue;
          await tx.stock.update({
            where: { id: stock.id },
            data: { cantidad: new Prisma.Decimal(stock.cantidad - cantidad) },
          });
          await tx.stockMovement.create({
            data: {
              tenantId,
              productId,
              tipo: StockMovementType.VENTA,
              cantidad: new Prisma.Decimal(-cantidad),
              costoUnit: new Prisma.Decimal(stock.costo),
              motivo: 'Venta',
              refId: sale.id,
            },
          });
        }
      }

      // Fiado: si hay cliente y una parte se pagó con CUENTA_CORRIENTE, se carga
      // a su cuenta corriente (crea la cuenta si no existía) y queda trazado.
      if (dto.customerId) {
        const credito = (dto.payments ?? [])
          .filter((p) => p.medio === MedioPago.CUENTA_CORRIENTE)
          .reduce((s, p) => s + Number(p.monto), 0);
        if (credito > 0) {
          const account =
            (await tx.accountReceivable.findUnique({ where: { customerId: dto.customerId } })) ??
            (await tx.accountReceivable.create({ data: { tenantId, customerId: dto.customerId, saldo: new Prisma.Decimal(0) } }));
          await tx.accountReceivable.update({
            where: { id: account.id },
            data: { saldo: new Prisma.Decimal(Number(account.saldo) + credito) },
          });
          await tx.accountMovement.create({
            data: { tenantId, accountId: account.id, monto: new Prisma.Decimal(credito), concepto: 'Venta a cuenta', refId: sale.id },
          });
        }
      }

      return sale;
    });
  }

  /**
   * Sucursal para descontar el stock, en orden de prioridad:
   * 1) la explícita de la venta; 2) la de la caja donde se abrió el turno;
   * 3) la principal activa del tenant.
   */
  private async resolveSucursalId(tenantId: string, dto: CreateSaleDto): Promise<string | null> {
    if (dto.sucursalId) {
      const suc = await this.prisma.sucursal.findFirst({ where: { id: dto.sucursalId, tenantId } });
      if (suc) return suc.id;
    }
    if (dto.cashSessionId) {
      const cash = await this.prisma.cashSession.findFirst({
        where: { id: dto.cashSessionId, tenantId },
        select: { sucursalId: true },
      });
      if (cash?.sucursalId) return cash.sucursalId;
    }
    const suc = await this.prisma.sucursal.findFirst({
      where: { tenantId, activo: true },
      orderBy: { codigo: 'asc' },
    });
    return suc?.id ?? null;
  }

  async getSale(tenantId: string, id: string) {
    return this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: { items: true, payments: true, cfeDocument: true },
    });
  }
}
