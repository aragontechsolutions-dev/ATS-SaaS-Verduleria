import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditEventTipo, IvaIndicador, LoyaltyMovementTipo, MedioPago, Prisma, SaleStatus, StockMovementType } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { getTenantContext } from '../tenant/tenant-context';
import type { CreateDevolucionDto, CreateSaleDto } from './sales.dto';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

    const creada = await this.prisma.$transaction(async (tx) => {
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

      // Fidelización: canje de puntos usados como pago + puntos ganados por la compra.
      if (dto.customerId) {
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: { loyaltyActivo: true, loyaltyAcumulaCada: true, loyaltyValorPunto: true },
        });
        if (tenant?.loyaltyActivo) {
          const customer = await tx.customer.findFirst({ where: { id: dto.customerId, tenantId }, select: { puntos: true } });
          if (customer) {
            let saldo = customer.puntos;
            const valorPunto = Number(tenant.loyaltyValorPunto);
            const montoPuntos = (dto.payments ?? [])
              .filter((p) => p.medio === MedioPago.PUNTOS)
              .reduce((s, p) => s + Number(p.monto), 0);

            if (montoPuntos > 0) {
              if (!(valorPunto > 0)) throw new BadRequestException('El canje de puntos no está configurado');
              const puntosCanje = Math.round(montoPuntos / valorPunto);
              if (puntosCanje > saldo) throw new BadRequestException('El cliente no tiene puntos suficientes para el canje');
              saldo -= puntosCanje;
              await tx.loyaltyMovement.create({
                data: { tenantId, customerId: dto.customerId, tipo: LoyaltyMovementTipo.CANJEADOS, puntos: -puntosCanje, saldo, saleId: sale.id, descripcion: 'Canje en compra' },
              });
            }

            const acumulaCada = Number(tenant.loyaltyAcumulaCada);
            if (acumulaCada > 0) {
              // Se gana sobre lo efectivamente pagado (excluye lo cubierto con puntos).
              const baseGana = Math.max(0, Number(total) - montoPuntos);
              const ganados = Math.floor(baseGana / acumulaCada);
              if (ganados > 0) {
                saldo += ganados;
                await tx.loyaltyMovement.create({
                  data: { tenantId, customerId: dto.customerId, tipo: LoyaltyMovementTipo.GANADOS, puntos: ganados, saldo, saleId: sale.id, descripcion: 'Compra' },
                });
              }
            }

            if (saldo !== customer.puntos) {
              await tx.customer.update({ where: { id: dto.customerId }, data: { puntos: saldo } });
            }
          }
        }
      }

      return sale;
    });

    await this.audit.log({
      tipo: AuditEventTipo.VENTA,
      descripcion: 'Venta',
      monto: Number(creada.total),
      cashSessionId: creada.cashSessionId ?? undefined,
      sucursalId: creada.sucursalId ?? undefined,
      refId: creada.id,
    });
    return creada;
  }

  /**
   * Crea una DEVOLUCIÓN (nota de crédito) de una venta. Es idempotente por
   * idempotencyKey. La devolución se guarda como una venta con importes y pagos
   * NEGATIVOS y `esDevolucion=true`, referenciando la venta original; así netea
   * en caja y reportes, restaura el stock y permite emitir la NC (con el CFE
   * original como referencia). Valida que no se devuelva más de lo vendido.
   */
  async createDevolucion(tenantId: string, dto: CreateDevolucionDto) {
    if (!dto.idempotencyKey) throw new BadRequestException('Falta idempotencyKey');
    if (!dto.items?.length) throw new BadRequestException('La devolución no tiene ítems');

    const existing = await this.prisma.sale.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: { items: true, payments: true, cfeDocument: true },
    });
    if (existing) {
      if (existing.tenantId !== tenantId) throw new BadRequestException('Clave de otro tenant');
      return existing;
    }

    const original = await this.prisma.sale.findFirst({
      where: { id: dto.originalSaleId, tenantId },
      include: { items: true },
    });
    if (!original) throw new BadRequestException('Venta original no encontrada');
    if (original.esDevolucion) throw new BadRequestException('No se puede devolver una devolución');

    // Clave por producto (o por concepto si no tiene productId).
    const keyOf = (x: { productId?: string | null; concepto: string }) => x.productId ?? `c:${x.concepto}`;

    // Vendido y ya devuelto por producto, para no devolver de más.
    const vendido = new Map<string, number>();
    for (const it of original.items) vendido.set(keyOf(it), (vendido.get(keyOf(it)) ?? 0) + num(it.cantidad));

    const previas = await this.prisma.saleItem.findMany({
      where: { tenantId, sale: { is: { referenciaSaleId: original.id, esDevolucion: true } } },
      select: { productId: true, concepto: true, cantidad: true },
    });
    const devuelto = new Map<string, number>();
    for (const it of previas) devuelto.set(keyOf(it), (devuelto.get(keyOf(it)) ?? 0) + Math.abs(num(it.cantidad)));

    const pedido = new Map<string, number>();
    for (const it of dto.items) pedido.set(keyOf(it), (pedido.get(keyOf(it)) ?? 0) + it.cantidad);
    for (const [k, req] of pedido) {
      const disponible = (vendido.get(k) ?? 0) - (devuelto.get(k) ?? 0);
      if (req > disponible + 1e-6) {
        throw new BadRequestException('La cantidad a devolver supera lo disponible de la venta original');
      }
    }

    // Ítems de la devolución: cantidades e importes NEGATIVOS.
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

      // Costo real de la línea original (para rentabilidad).
      const orig = original.items.find((o) => keyOf(o) === keyOf(it));

      return {
        tenantId,
        productId: it.productId,
        concepto: it.concepto,
        unidad: it.unidad,
        cantidad: new Prisma.Decimal(-it.cantidad),
        precioUnit: new Prisma.Decimal(it.precioUnit),
        descuento: desc,
        ivaIndicador: it.ivaIndicador,
        costoUnit: orig?.costoUnit ?? null,
        total: lineaTotal.negated(),
      };
    });

    const totalPos = subtotal.minus(descuentoTotal);

    const sucursalId = original.sucursalId ?? (await this.resolveSucursalId(tenantId, { cashSessionId: dto.cashSessionId } as CreateSaleDto));

    // Stock de los productos devueltos en esa sucursal (para reponer).
    const productIds = [...new Set(dto.items.map((it) => it.productId).filter((x): x is string => !!x))];
    const stockByProduct = new Map<string, { id: string; cantidad: number; costo: number }>();
    if (sucursalId && productIds.length) {
      const stocks = await this.prisma.stock.findMany({ where: { tenantId, sucursalId, productId: { in: productIds } } });
      for (const s of stocks) stockByProduct.set(s.productId, { id: s.id, cantidad: num(s.cantidad), costo: num(s.costoPromedio) });
    }

    const devuelta = await this.prisma.$transaction(async (tx) => {
      const devolucion = await tx.sale.create({
        data: {
          tenantId,
          sucursalId: sucursalId ?? undefined,
          cashSessionId: dto.cashSessionId,
          cajeroId: getTenantContext()?.userId,
          customerId: original.customerId,
          status: SaleStatus.COMPLETADA,
          esDevolucion: true,
          referenciaSaleId: original.id,
          idempotencyKey: dto.idempotencyKey,
          fecha: new Date(),
          subtotal: subtotal.negated(),
          descuento: descuentoTotal.negated(),
          ivaTotal: ivaTotal.negated(),
          total: totalPos.negated(),
          items: { create: items },
          payments: { create: [{ tenantId, medio: dto.medio, monto: totalPos.negated(), referencia: dto.motivo }] },
        },
        include: { items: true, payments: true, cfeDocument: true },
      });

      // Reposición de stock (solo productos con stock controlado).
      const porProducto = new Map<string, number>();
      for (const it of dto.items) {
        if (!it.productId) continue;
        porProducto.set(it.productId, (porProducto.get(it.productId) ?? 0) + it.cantidad);
      }
      for (const [productId, cantidad] of porProducto) {
        const stock = stockByProduct.get(productId);
        if (!stock || cantidad <= 0) continue;
        await tx.stock.update({
          where: { id: stock.id },
          data: { cantidad: new Prisma.Decimal(stock.cantidad + cantidad) },
        });
        await tx.stockMovement.create({
          data: {
            tenantId,
            productId,
            tipo: StockMovementType.DEVOLUCION,
            cantidad: new Prisma.Decimal(cantidad),
            costoUnit: new Prisma.Decimal(stock.costo),
            motivo: dto.motivo || 'Devolución',
            refId: devolucion.id,
          },
        });
      }

      // Si se reintegra a cuenta corriente, baja el saldo del cliente.
      if (original.customerId && dto.medio === MedioPago.CUENTA_CORRIENTE) {
        const credito = Number(totalPos);
        const account = await tx.accountReceivable.findUnique({ where: { customerId: original.customerId } });
        if (account && credito > 0) {
          await tx.accountReceivable.update({
            where: { id: account.id },
            data: { saldo: new Prisma.Decimal(Number(account.saldo) - credito) },
          });
          await tx.accountMovement.create({
            data: { tenantId, accountId: account.id, monto: new Prisma.Decimal(-credito), concepto: 'Devolución', refId: devolucion.id },
          });
        }
      }

      return devolucion;
    });

    await this.audit.log({
      tipo: AuditEventTipo.DEVOLUCION,
      descripcion: `Devolución${dto.motivo ? ` · ${dto.motivo}` : ''}`,
      monto: Math.abs(Number(devuelta.total)),
      cashSessionId: devuelta.cashSessionId ?? undefined,
      sucursalId: devuelta.sucursalId ?? undefined,
      refId: devuelta.id,
      meta: { originalSaleId: dto.originalSaleId, medio: dto.medio },
    });
    return devuelta;
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
