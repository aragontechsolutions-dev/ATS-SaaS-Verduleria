import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MedioPago, OnlineOrderEstado, PaymentEstado, PaymentProviderKind, Prisma } from '@ats/database';
import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsConfigService } from './payments.config.service';
import { mpCrearPreferencia, mpGetPago, mpReembolsar } from './mercadopago.client';
import { extraerPagoId } from './payments.webhook';

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class PaymentsGatewayService {
  private readonly logger = new Logger(PaymentsGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly cfg: PaymentsConfigService,
  ) {}

  /**
   * Inicia el pago online de un pedido: crea la preferencia de Checkout Pro en
   * la cuenta MP del comercio y devuelve la URL a la que redirigir al cliente.
   */
  async iniciarCheckout(slug: string, codigo: string): Promise<{ checkoutUrl: string }> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug, tiendaOnlineActiva: true },
      select: { id: true, slug: true, nombre: true },
    });
    if (!tenant) throw new NotFoundException('Tienda no encontrada');

    const order = await this.prisma.onlineOrder.findFirst({
      where: { tenantId: tenant.id, codigo: codigo.trim().toUpperCase() },
      include: { items: true, payments: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.estado === OnlineOrderEstado.CANCELADO) throw new BadRequestException('El pedido está cancelado.');

    const total = Number(order.total);
    const pagado = order.payments
      .filter((p) => p.estado === PaymentEstado.APROBADO)
      .reduce((s, p) => s + Number(p.monto), 0);
    if (pagado >= total) throw new BadRequestException('El pedido ya está pagado.');

    const cred = await this.cfg.credencialesActivas(tenant.id);
    if (!cred) throw new BadRequestException('Este comercio no tiene el cobro online activo.');

    const apiBase = this.config.get('apiPublicUrl', { infer: true });
    const webBase = this.config.get('webUrl', { infer: true });

    const items = order.items.map((i) => ({
      // 1 ítem por línea con cantidad 1 (los pesables tienen cantidad decimal,
      // que MP no acepta): el precio de la línea ya es el subtotal. Mandamos id,
      // descripción y categoría para mejorar la calidad de la integración en MP.
      id: i.productId ?? undefined,
      title: i.concepto.slice(0, 250),
      description: i.esPesable ? `${Number(i.cantidad)} ${i.unidad}` : `${Number(i.cantidad)} x ${i.unidad}`,
      category_id: 'food',
      quantity: 1,
      unit_price: round2(Number(i.subtotal)),
      currency_id: 'UYU',
    }));
    if (Number(order.costoEnvio) > 0) {
      items.push({ id: 'envio', title: 'Envío', description: 'Costo de envío', category_id: 'services', quantity: 1, unit_price: round2(Number(order.costoEnvio)), currency_id: 'UYU' });
    }

    // Datos del pagador (mejoran la calidad de la integración y la aprobación).
    const nombre = (order.clienteNombre ?? '').trim();
    const espacio = nombre.indexOf(' ');
    const telDigits = (order.clienteTelefono ?? '').replace(/\D/g, '').replace(/^598/, '');
    const payer = {
      name: espacio > 0 ? nombre.slice(0, espacio) : nombre || undefined,
      surname: espacio > 0 ? nombre.slice(espacio + 1) : undefined,
      phone: telDigits ? { area_code: '598', number: telDigits } : undefined,
    };

    // back_urls solo si tenemos dominio web absoluto (MP exige URL absoluta y,
    // con auto_return, que exista back_urls.success). Sin WEB_URL, se omiten.
    const backUrl = webBase ? `${webBase}/v/${encodeURIComponent(tenant.slug)}/tienda?codigo=${order.codigo}` : '';
    const pref = await mpCrearPreferencia(cred.accessToken, {
      items,
      payer,
      external_reference: order.id,
      notification_url:
        apiBase && cred.webhookSecret ? `${apiBase}/api/public/pagos/mp/${cred.webhookSecret}` : undefined,
      ...(backUrl
        ? { back_urls: { success: backUrl, failure: backUrl, pending: backUrl }, auto_return: 'approved' as const }
        : {}),
      metadata: { onlineOrderId: order.id, tenantId: tenant.id },
      statement_descriptor: tenant.nombre.slice(0, 22),
    });

    // Deja un único pago PENDIENTE por pedido (limpia intentos anteriores).
    await this.prisma.payment.deleteMany({
      where: { tenantId: tenant.id, onlineOrderId: order.id, provider: PaymentProviderKind.MERCADO_PAGO, estado: PaymentEstado.PENDIENTE },
    });
    await this.prisma.payment.create({
      data: {
        tenantId: tenant.id,
        onlineOrderId: order.id,
        provider: PaymentProviderKind.MERCADO_PAGO,
        medio: MedioPago.MERCADO_PAGO,
        monto: order.total,
        estado: PaymentEstado.PENDIENTE,
        externo: false,
        referencia: pref.id,
      },
    });

    const checkoutUrl = cred.ambiente === 'produccion' ? pref.init_point : pref.sandbox_init_point;
    return { checkoutUrl };
  }

  /**
   * Reembolsa (total) el pago online aprobado de un pedido, en la cuenta MP del
   * comercio. Marca el pago como REEMBOLSADO. Sirve incluso si el cobro online
   * fue desactivado luego.
   */
  async reembolsar(tenantId: string, onlineOrderId: string): Promise<{ ok: true }> {
    const pago = await this.prisma.payment.findFirst({
      where: {
        tenantId,
        onlineOrderId,
        provider: PaymentProviderKind.MERCADO_PAGO,
        estado: PaymentEstado.APROBADO,
        externo: false,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, referencia: true },
    });
    if (!pago?.referencia) throw new NotFoundException('No hay un pago online aprobado para reembolsar.');

    const token = await this.cfg.accessTokenDe(tenantId);
    if (!token) throw new BadRequestException('La cuenta de Mercado Pago no está conectada.');

    await mpReembolsar(token, pago.referencia);
    await this.prisma.payment.update({ where: { id: pago.id }, data: { estado: PaymentEstado.REEMBOLSADO } });
    return { ok: true };
  }

  /**
   * Webhook de Mercado Pago. Verifica el estado del pago contra la API de MP
   * (con el token del tenant dueño del webhookSecret) y, si está aprobado, marca
   * el pedido como pagado. Siempre responde 200 para que MP no reintente en loop.
   */
  async webhook(
    secret: string,
    body: Record<string, unknown> | undefined,
    query: Record<string, unknown> | undefined,
  ): Promise<{ ok: true }> {
    try {
      const cred = await this.cfg.porWebhookSecret(secret);
      if (!cred) return { ok: true };
      const pagoId = extraerPagoId(body, query);
      if (!pagoId) return { ok: true };

      const pago = await mpGetPago(cred.accessToken, pagoId);
      const orderId = pago?.external_reference;
      if (!pago || !orderId) return { ok: true };

      const order = await this.prisma.onlineOrder.findFirst({
        where: { id: orderId, tenantId: cred.tenantId },
        select: { id: true, tenantId: true, total: true, estado: true },
      });
      if (!order) return { ok: true };

      if (pago.status === 'approved') {
        await this.marcarPagado(order, pagoId, pago.transaction_amount, pago);
      } else if (pago.status === 'rejected' || pago.status === 'cancelled') {
        await this.prisma.payment.updateMany({
          where: { tenantId: order.tenantId, onlineOrderId: order.id, provider: PaymentProviderKind.MERCADO_PAGO, estado: PaymentEstado.PENDIENTE },
          data: { estado: PaymentEstado.RECHAZADO, referencia: pagoId, raw: pago as unknown as Prisma.InputJsonValue },
        });
      } else if (pago.status === 'pending' || pago.status === 'in_process' || pago.status === 'in_mediation') {
        // Pago pendiente de acreditación (ej. efectivo en Abitab/RedPagos, o en revisión).
        // Se marca el rastro (raw) para diferenciarlo de "checkout apenas iniciado".
        await this.prisma.payment.updateMany({
          where: { tenantId: order.tenantId, onlineOrderId: order.id, provider: PaymentProviderKind.MERCADO_PAGO, estado: PaymentEstado.PENDIENTE },
          data: { referencia: pagoId, raw: pago as unknown as Prisma.InputJsonValue },
        });
      }
    } catch (e) {
      // No propagamos: MP solo necesita un 200. Dejamos rastro para diagnóstico.
      this.logger.error(`Webhook MP falló: ${e instanceof Error ? e.message : e}`);
    }
    return { ok: true };
  }

  private async marcarPagado(
    order: { id: string; tenantId: string; total: Prisma.Decimal; estado: OnlineOrderEstado },
    pagoId: string,
    monto: number | undefined,
    raw: unknown,
  ): Promise<void> {
    // Idempotencia: si ya registramos este pago aprobado, no duplicamos.
    const ya = await this.prisma.payment.findFirst({
      where: { tenantId: order.tenantId, onlineOrderId: order.id, referencia: pagoId, estado: PaymentEstado.APROBADO },
      select: { id: true },
    });
    if (ya) return;

    const montoFinal = new Prisma.Decimal(monto != null ? round2(monto) : Number(order.total));
    const rawJson = raw as Prisma.InputJsonValue;

    const pendiente = await this.prisma.payment.findFirst({
      where: { tenantId: order.tenantId, onlineOrderId: order.id, provider: PaymentProviderKind.MERCADO_PAGO, estado: PaymentEstado.PENDIENTE },
      select: { id: true },
    });
    if (pendiente) {
      await this.prisma.payment.update({
        where: { id: pendiente.id },
        data: { estado: PaymentEstado.APROBADO, referencia: pagoId, monto: montoFinal, raw: rawJson },
      });
    } else {
      await this.prisma.payment.create({
        data: {
          tenantId: order.tenantId,
          onlineOrderId: order.id,
          provider: PaymentProviderKind.MERCADO_PAGO,
          medio: MedioPago.MERCADO_PAGO,
          monto: montoFinal,
          estado: PaymentEstado.APROBADO,
          externo: false,
          referencia: pagoId,
          raw: rawJson,
        },
      });
    }

    // Al confirmarse el pago, el pedido pasa de NUEVO a CONFIRMADO (no pisa estados posteriores).
    if (order.estado === OnlineOrderEstado.NUEVO) {
      await this.prisma.onlineOrder.update({ where: { id: order.id }, data: { estado: OnlineOrderEstado.CONFIRMADO } });
    }
  }
}
