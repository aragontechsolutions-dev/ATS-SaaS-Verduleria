import { BadRequestException, Injectable } from '@nestjs/common';
import { IvaIndicador, Prisma, SaleStatus } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSaleDto } from './sales.dto';

/** Tasa efectiva por indicador (para desglosar el IVA incluido en el precio). */
const TASA: Record<IvaIndicador, number> = {
  EXENTO: 0,
  MINIMA: 0.1,
  BASICA: 0.22,
  SUSPENSO: 0,
};

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

      return {
        tenantId,
        productId: it.productId,
        concepto: it.concepto,
        unidad: it.unidad,
        cantidad: new Prisma.Decimal(it.cantidad),
        precioUnit: new Prisma.Decimal(it.precioUnit),
        descuento: desc,
        ivaIndicador: it.ivaIndicador,
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

    return this.prisma.sale.create({
      data: {
        tenantId,
        sucursalId: dto.sucursalId,
        cashSessionId: dto.cashSessionId,
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
  }

  async getSale(tenantId: string, id: string) {
    return this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: { items: true, payments: true, cfeDocument: true },
    });
  }
}
