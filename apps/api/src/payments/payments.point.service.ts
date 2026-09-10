import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsConfigService } from './payments.config.service';
import {
  mpPointCancelarIntent,
  mpPointCrearIntent,
  mpPointDispositivos,
  mpPointGetIntent,
  mpPointModo,
} from './mercadopago.client';

export interface PointEstado {
  conectado: boolean; // hay cuenta MP conectada
  deviceId: string | null; // lector elegido
}

@Injectable()
export class PaymentsPointService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: PaymentsConfigService,
  ) {}

  private async token(tenantId: string): Promise<string> {
    const t = await this.cfg.accessTokenDe(tenantId);
    if (!t) throw new BadRequestException('La cuenta de Mercado Pago no está conectada.');
    return t;
  }

  /** Estado de Point para un tenant (para Consola/POS). */
  async estado(tenantId: string): Promise<PointEstado> {
    const cfg = await this.prisma.tenantPaymentConfig.findUnique({
      where: { tenantId },
      select: { accessTokenEnc: true, pointDeviceId: true },
    });
    return { conectado: !!cfg?.accessTokenEnc, deviceId: cfg?.pointDeviceId ?? null };
  }

  /** Lista los lectores de la cuenta (para elegir en la Consola). */
  async dispositivos(tenantId: string): Promise<Array<{ id: string; modo: string | null }>> {
    const token = await this.token(tenantId);
    const devs = await mpPointDispositivos(token);
    return devs.map((d) => ({ id: d.id, modo: d.operating_mode ?? null }));
  }

  /** Elige un lector y lo pone en modo integrado (PDV). */
  async seleccionar(tenantId: string, deviceId: string): Promise<PointEstado> {
    const token = await this.token(tenantId);
    await mpPointModo(token, deviceId, 'PDV');
    await this.prisma.tenantPaymentConfig.update({ where: { tenantId }, data: { pointDeviceId: deviceId } });
    return this.estado(tenantId);
  }

  /** Quita el lector configurado. */
  async quitar(tenantId: string): Promise<PointEstado> {
    await this.prisma.tenantPaymentConfig.updateMany({ where: { tenantId }, data: { pointDeviceId: null } });
    return this.estado(tenantId);
  }

  /** Envía un cobro al lector (monto en pesos). Devuelve el id de la intención. */
  async cobrar(tenantId: string, monto: number, referencia: string): Promise<{ intentId: string }> {
    if (!(monto > 0)) throw new BadRequestException('Monto inválido.');
    const cfg = await this.prisma.tenantPaymentConfig.findUnique({
      where: { tenantId },
      select: { pointDeviceId: true },
    });
    if (!cfg?.pointDeviceId) throw new BadRequestException('No hay un lector Point configurado. Configuralo desde la Consola.');
    const token = await this.token(tenantId);
    const cents = Math.round(monto * 100);
    const intent = await mpPointCrearIntent(token, cfg.pointDeviceId, cents, referencia);
    return { intentId: intent.id };
  }

  /** Estado de una intención de cobro (el POS lo consulta mientras espera). */
  async estadoIntent(
    tenantId: string,
    intentId: string,
  ): Promise<{ state: string; aprobado: boolean; pagoId: string | null }> {
    const token = await this.token(tenantId);
    const intent = await mpPointGetIntent(token, intentId);
    if (!intent) return { state: 'ERROR', aprobado: false, pagoId: null };
    return {
      state: intent.state ?? 'UNKNOWN',
      aprobado: intent.payment?.status === 'approved',
      pagoId: intent.payment?.id != null ? String(intent.payment.id) : null,
    };
  }

  /** Cancela un cobro pendiente en el lector. */
  async cancelar(tenantId: string, intentId: string): Promise<{ ok: true }> {
    const cfg = await this.prisma.tenantPaymentConfig.findUnique({
      where: { tenantId },
      select: { pointDeviceId: true },
    });
    if (cfg?.pointDeviceId) {
      const token = await this.token(tenantId);
      await mpPointCancelarIntent(token, cfg.pointDeviceId, intentId);
    }
    return { ok: true };
  }
}
