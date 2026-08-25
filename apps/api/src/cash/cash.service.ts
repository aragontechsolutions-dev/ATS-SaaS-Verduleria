import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CashSessionStatus, MedioPago, Prisma } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import type { CloseCashDto, OpenCashDto } from './cash.dto';

export interface CashSummary {
  ventas: number;
  totalVendido: number;
  porMedio: Record<string, number>;
  efectivoEsperado: number; // apertura + ventas en efectivo
  montoApertura: number;
}

/** Conciliación de un medio de pago: lo esperado vs lo contado/liquidado. */
export interface ArqueoMedio {
  esperado: number;
  contado: number;
  diferencia: number;
}

@Injectable()
export class CashService {
  constructor(private readonly prisma: PrismaService) {}

  /** Abre una caja. Falla si ya hay una abierta para ese cajero. */
  async open(tenantId: string, userId: string | undefined, dto: OpenCashDto) {
    if (!userId) throw new BadRequestException('Falta el usuario (x-user-id) para abrir caja');

    const abierta = await this.prisma.cashSession.findFirst({
      where: { tenantId, userId, status: CashSessionStatus.ABIERTA },
    });
    if (abierta) throw new ConflictException('Ya tenés una caja abierta');

    return this.prisma.cashSession.create({
      data: {
        tenantId,
        userId,
        sucursalId: dto.sucursalId,
        status: CashSessionStatus.ABIERTA,
        montoApertura: new Prisma.Decimal(dto.montoApertura ?? 0),
      },
    });
  }

  /** Caja abierta actual del cajero (o null). */
  async current(tenantId: string, userId: string | undefined) {
    if (!userId) return null;
    return this.prisma.cashSession.findFirst({
      where: { tenantId, userId, status: CashSessionStatus.ABIERTA },
      orderBy: { aperturaAt: 'desc' },
    });
  }

  /** Resumen de la caja para el arqueo: ventas, total y desglose por medio. */
  async summary(tenantId: string, sessionId: string): Promise<CashSummary> {
    const session = await this.prisma.cashSession.findFirst({ where: { id: sessionId, tenantId } });
    if (!session) throw new NotFoundException('Caja no encontrada');

    const sales = await this.prisma.sale.findMany({
      where: { tenantId, cashSessionId: sessionId, status: { not: 'ANULADA' } },
      include: { payments: true },
    });

    const porMedio: Record<string, number> = {};
    let totalVendido = 0;
    for (const sale of sales) {
      totalVendido += Number(sale.total);
      for (const p of sale.payments) {
        porMedio[p.medio] = (porMedio[p.medio] ?? 0) + Number(p.monto);
      }
    }
    const efectivoVentas = porMedio[MedioPago.EFECTIVO] ?? 0;

    return {
      ventas: sales.length,
      totalVendido,
      porMedio,
      efectivoEsperado: Number(session.montoApertura) + efectivoVentas,
      montoApertura: Number(session.montoApertura),
    };
  }

  /** Cierra la caja: calcula el esperado y la diferencia del arqueo. */
  async close(tenantId: string, sessionId: string, dto: CloseCashDto) {
    const session = await this.prisma.cashSession.findFirst({ where: { id: sessionId, tenantId } });
    if (!session) throw new NotFoundException('Caja no encontrada');
    if (session.status === CashSessionStatus.CERRADA) throw new ConflictException('La caja ya está cerrada');

    const resumen = await this.summary(tenantId, sessionId);
    const diferencia = (dto.montoCierre ?? 0) - resumen.efectivoEsperado;

    // Conciliación por medio: efectivo (físico) + electrónicos (liquidación).
    const conteos = dto.conteos ?? {};
    const medios = new Set<string>([...Object.keys(resumen.porMedio), ...Object.keys(conteos)]);
    const arqueoDetalle: Record<string, ArqueoMedio> = {};
    for (const medio of medios) {
      const esEfectivo = medio === MedioPago.EFECTIVO;
      const esperado = esEfectivo ? resumen.efectivoEsperado : resumen.porMedio[medio] ?? 0;
      // Si no se ingresó conteo de un medio electrónico, se asume conciliado (=esperado).
      const contado = esEfectivo
        ? dto.montoCierre ?? 0
        : conteos[medio] != null
          ? Number(conteos[medio])
          : esperado;
      arqueoDetalle[medio] = {
        esperado: Number(esperado.toFixed(2)),
        contado: Number(contado.toFixed(2)),
        diferencia: Number((contado - esperado).toFixed(2)),
      };
    }

    const cerrada = await this.prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        status: CashSessionStatus.CERRADA,
        cierreAt: new Date(),
        montoCierre: new Prisma.Decimal(dto.montoCierre ?? 0),
        diferencia: new Prisma.Decimal(diferencia),
        arqueoDetalle: arqueoDetalle as unknown as Prisma.InputJsonValue,
        notas: dto.notas,
      },
    });
    return { session: cerrada, resumen, diferencia, arqueoDetalle };
  }

  async get(tenantId: string, sessionId: string) {
    const session = await this.prisma.cashSession.findFirst({ where: { id: sessionId, tenantId } });
    if (!session) throw new NotFoundException('Caja no encontrada');
    return session;
  }
}
