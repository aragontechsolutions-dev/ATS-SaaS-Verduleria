import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentEstado, PaymentProviderKind, Prisma } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import type { RegistrarPagoDto } from './payments.dto';
import { estaPagado, saldoPendiente, sumaAprobados } from './payments.util';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra a mano un pago cobrado por una vía NO integrada (Getnet, Handy,
   * Scanntech, Fiserv, transferencia, efectivo…). Queda como externo/APROBADO.
   */
  async registrarPago(tenantId: string, dto: RegistrarPagoDto) {
    if (!dto.saleId && !dto.onlineOrderId) {
      throw new BadRequestException('Indicá a qué venta o pedido corresponde el pago.');
    }

    // Verifica pertenencia al tenant.
    if (dto.saleId) {
      const s = await this.prisma.sale.findFirst({ where: { id: dto.saleId, tenantId }, select: { id: true } });
      if (!s) throw new NotFoundException('Venta no encontrada');
    }
    if (dto.onlineOrderId) {
      const o = await this.prisma.onlineOrder.findFirst({ where: { id: dto.onlineOrderId, tenantId }, select: { id: true } });
      if (!o) throw new NotFoundException('Pedido no encontrado');
    }

    await this.prisma.payment.create({
      data: {
        tenantId,
        saleId: dto.saleId ?? null,
        onlineOrderId: dto.onlineOrderId ?? null,
        provider: dto.provider ?? PaymentProviderKind.MANUAL,
        medio: dto.medio,
        monto: new Prisma.Decimal(dto.monto),
        estado: PaymentEstado.APROBADO,
        externo: true,
        referencia: dto.referencia?.trim() || null,
        nota: dto.nota?.trim() || null,
      },
    });

    return dto.onlineOrderId
      ? this.resumenPedido(tenantId, dto.onlineOrderId)
      : { pagos: await this.listar(tenantId, { saleId: dto.saleId }) };
  }

  /** Lista los pagos de una venta o un pedido. */
  async listar(tenantId: string, filtro: { saleId?: string; onlineOrderId?: string }) {
    const pagos = await this.prisma.payment.findMany({
      where: { tenantId, ...(filtro.saleId ? { saleId: filtro.saleId } : {}), ...(filtro.onlineOrderId ? { onlineOrderId: filtro.onlineOrderId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return pagos.map((p) => ({
      id: p.id,
      medio: p.medio,
      provider: p.provider,
      monto: Number(p.monto),
      estado: p.estado,
      externo: p.externo,
      referencia: p.referencia,
      nota: p.nota,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  /** Pagos + total + saldo de un pedido online (para el panel). */
  async resumenPedido(tenantId: string, onlineOrderId: string) {
    const order = await this.prisma.onlineOrder.findFirst({
      where: { id: onlineOrderId, tenantId },
      select: { total: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    const pagos = await this.listar(tenantId, { onlineOrderId });
    const total = Number(order.total);
    return {
      total,
      pagado: sumaAprobados(pagos),
      saldo: saldoPendiente(total, pagos),
      cubierto: estaPagado(total, pagos),
      pagos,
    };
  }

  /** Elimina un pago mal cargado (corrección manual). */
  async eliminar(tenantId: string, id: string) {
    const p = await this.prisma.payment.findFirst({ where: { id, tenantId }, select: { id: true, onlineOrderId: true } });
    if (!p) throw new NotFoundException('Pago no encontrado');
    await this.prisma.payment.delete({ where: { id } });
    return p.onlineOrderId ? this.resumenPedido(tenantId, p.onlineOrderId) : { ok: true };
  }
}
