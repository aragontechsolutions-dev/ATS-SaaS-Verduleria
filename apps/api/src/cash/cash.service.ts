import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditEventTipo, CashSessionStatus, MedioPago, Prisma } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TerminalsService } from '../terminals/terminals.service';
import type { CloseCashDto, OpenCashDto } from './cash.dto';

export interface CashSummary {
  ventas: number;
  totalVendido: number;
  porMedio: Record<string, number>;
  efectivoEsperado: number; // apertura + ventas efectivo + ingresos − egresos
  montoApertura: number;
  ingresos: number;
  egresos: number;
}

/** Conciliación de un medio de pago: lo esperado vs lo contado/liquidado. */
export interface ArqueoMedio {
  esperado: number;
  contado: number;
  diferencia: number;
}

@Injectable()
export class CashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly terminals: TerminalsService,
  ) {}

  /** Abre una caja. Falla si ya hay una abierta para ese cajero. */
  async open(tenantId: string, userId: string | undefined, role: string | undefined, dto: OpenCashDto) {
    if (!userId) throw new BadRequestException('Falta el usuario (x-user-id) para abrir caja');

    const abierta = await this.prisma.cashSession.findFirst({
      where: { tenantId, userId, status: CashSessionStatus.ABIERTA },
    });
    if (abierta) throw new ConflictException('Ya tenés una caja abierta');

    // Caja gestionada (terminalId): valida permiso y toma el nombre como snapshot.
    // Sin terminalId, se admite un nombre libre (compatibilidad).
    let terminalId: string | undefined;
    let terminal: string | undefined;
    if (dto.terminalId) {
      const t = await this.terminals.resolveForOpen(tenantId, userId, role, dto.terminalId, dto.sucursalId);
      terminalId = t.id;
      terminal = t.nombre;
    } else {
      // Si el comercio ya definió cajas, no se permite abrir "sin caja": el
      // cajero debe abrir en una caja que tenga habilitada.
      if (await this.terminals.hasActiveTerminals(tenantId, dto.sucursalId)) {
        throw new ForbiddenException('No tenés una caja asignada. Pedile al administrador que te habilite una.');
      }
      terminal = dto.terminal?.trim() || undefined;
    }

    const sesion = await this.prisma.cashSession.create({
      data: {
        tenantId,
        userId,
        sucursalId: dto.sucursalId,
        terminal,
        terminalId,
        status: CashSessionStatus.ABIERTA,
        montoApertura: new Prisma.Decimal(dto.montoApertura ?? 0),
      },
    });
    await this.audit.log({
      tipo: AuditEventTipo.CAJA_ABIERTA,
      descripcion: terminal ? `Apertura de caja · ${terminal}` : 'Apertura de caja',
      monto: dto.montoApertura ?? 0,
      cashSessionId: sesion.id,
      sucursalId: dto.sucursalId,
      refId: sesion.id,
      meta: terminal ? { terminal } : undefined,
    });
    return sesion;
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

    const [sales, movimientos] = await Promise.all([
      this.prisma.sale.findMany({
        where: { tenantId, cashSessionId: sessionId, status: { not: 'ANULADA' } },
        include: { payments: true },
      }),
      this.prisma.cashMovement.findMany({ where: { tenantId, cashSessionId: sessionId } }),
    ]);

    const porMedio: Record<string, number> = {};
    let totalVendido = 0;
    for (const sale of sales) {
      totalVendido += Number(sale.total);
      for (const p of sale.payments) {
        porMedio[p.medio] = (porMedio[p.medio] ?? 0) + Number(p.monto);
      }
    }
    const efectivoVentas = porMedio[MedioPago.EFECTIVO] ?? 0;

    let ingresos = 0;
    let egresos = 0;
    for (const m of movimientos) {
      if (m.tipo === 'INGRESO') ingresos += Number(m.monto);
      else egresos += Number(m.monto);
    }

    return {
      ventas: sales.length,
      totalVendido,
      porMedio,
      efectivoEsperado: Number(session.montoApertura) + efectivoVentas + ingresos - egresos,
      montoApertura: Number(session.montoApertura),
      ingresos,
      egresos,
    };
  }

  /** Registra un movimiento de caja (ingreso/egreso de efectivo) del turno. */
  async addMovement(
    tenantId: string,
    userId: string | undefined,
    sessionId: string,
    dto: { tipo: 'INGRESO' | 'EGRESO'; monto: number; motivo?: string },
  ) {
    const session = await this.prisma.cashSession.findFirst({ where: { id: sessionId, tenantId } });
    if (!session) throw new NotFoundException('Caja no encontrada');
    if (session.status === CashSessionStatus.CERRADA) throw new ConflictException('La caja ya está cerrada');
    if (!(dto.monto > 0)) throw new BadRequestException('El monto debe ser mayor a 0');

    const mov = await this.prisma.cashMovement.create({
      data: {
        tenantId,
        cashSessionId: sessionId,
        userId,
        tipo: dto.tipo,
        monto: new Prisma.Decimal(dto.monto),
        motivo: dto.motivo,
      },
    });
    await this.audit.log({
      tipo: dto.tipo === 'INGRESO' ? AuditEventTipo.MOV_INGRESO : AuditEventTipo.MOV_EGRESO,
      descripcion: `${dto.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'} de efectivo${dto.motivo ? ` · ${dto.motivo}` : ''}`,
      monto: dto.monto,
      cashSessionId: sessionId,
      sucursalId: session.sucursalId ?? undefined,
      refId: mov.id,
    });
    return mov;
  }

  /** Movimientos (ingresos/egresos) de un turno. */
  listMovements(tenantId: string, sessionId: string) {
    return this.prisma.cashMovement.findMany({
      where: { tenantId, cashSessionId: sessionId },
      orderBy: { createdAt: 'desc' },
    });
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
    await this.audit.log({
      tipo: AuditEventTipo.CAJA_CERRADA,
      descripcion: `Cierre de caja${session.terminal ? ` · ${session.terminal}` : ''} · diferencia ${diferencia >= 0 ? '+' : ''}${diferencia.toFixed(2)}`,
      monto: dto.montoCierre ?? 0,
      cashSessionId: sessionId,
      sucursalId: session.sucursalId ?? undefined,
      refId: sessionId,
      meta: { diferencia, esperado: resumen.efectivoEsperado, notas: dto.notas ?? null, terminal: session.terminal ?? null },
    });
    return { session: cerrada, resumen, diferencia, arqueoDetalle };
  }

  async get(tenantId: string, sessionId: string) {
    const session = await this.prisma.cashSession.findFirst({ where: { id: sessionId, tenantId } });
    if (!session) throw new NotFoundException('Caja no encontrada');
    return session;
  }

  /**
   * Feed unificado de operaciones de caja para el Panel: aperturas, cierres,
   * ventas y movimientos (ingresos/egresos), con el usuario que la realizó.
   * Filtros: rango de fechas, usuario y sucursal. Ordenado del más nuevo al viejo.
   */
  async operations(
    tenantId: string,
    filtros: { from?: string; to?: string; userId?: string; sucursalId?: string; terminalId?: string; limit?: number },
  ): Promise<OperacionCaja[]> {
    const desde = filtros.from ? new Date(filtros.from) : undefined;
    const hasta = filtros.to ? new Date(filtros.to) : undefined;
    const rango = desde || hasta ? { gte: desde, lte: hasta } : undefined;
    const limit = Math.min(filtros.limit ?? 500, 2000);

    const [sales, sessions, movimientos] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          tenantId,
          status: { not: 'ANULADA' },
          ...(rango ? { fecha: rango } : {}),
          ...(filtros.userId ? { cajeroId: filtros.userId } : {}),
          ...(filtros.sucursalId ? { sucursalId: filtros.sucursalId } : {}),
          ...(filtros.terminalId ? { cashSession: { terminalId: filtros.terminalId } } : {}),
        },
        include: {
          payments: true,
          cajero: { select: { nombre: true } },
          cfeDocument: { select: { serie: true, numero: true } },
          cashSession: { select: { terminal: true } },
        },
        orderBy: { fecha: 'desc' },
        take: limit,
      }),
      this.prisma.cashSession.findMany({
        where: {
          tenantId,
          ...(filtros.userId ? { userId: filtros.userId } : {}),
          ...(filtros.sucursalId ? { sucursalId: filtros.sucursalId } : {}),
          ...(filtros.terminalId ? { terminalId: filtros.terminalId } : {}),
          ...(rango ? { aperturaAt: rango } : {}),
        },
        include: { user: { select: { nombre: true } } },
        orderBy: { aperturaAt: 'desc' },
        take: limit,
      }),
      this.prisma.cashMovement.findMany({
        where: {
          tenantId,
          ...(filtros.userId ? { userId: filtros.userId } : {}),
          ...(filtros.terminalId ? { cashSession: { terminalId: filtros.terminalId } } : {}),
          ...(rango ? { createdAt: rango } : {}),
        },
        include: { user: { select: { nombre: true } }, cashSession: { select: { terminal: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const ops: OperacionCaja[] = [];

    for (const s of sales) {
      const medios = [...new Set(s.payments.map((p) => p.medio))].join(', ');
      const comp = s.cfeDocument?.serie ? `${s.cfeDocument.serie}-${s.cfeDocument.numero}` : null;
      ops.push({
        id: `venta-${s.id}`,
        fecha: s.fecha.toISOString(),
        tipo: 'VENTA',
        descripcion: comp ? `Venta ${comp}` : 'Venta (ticket interno)',
        monto: Number(s.total),
        medio: medios || null,
        userId: s.cajeroId,
        userNombre: s.cajero?.nombre ?? null,
        sessionId: s.cashSessionId,
        terminal: s.cashSession?.terminal ?? null,
        comprobante: comp,
      });
    }

    for (const c of sessions) {
      ops.push({
        id: `apertura-${c.id}`,
        fecha: c.aperturaAt.toISOString(),
        tipo: 'APERTURA',
        descripcion: 'Apertura de caja',
        monto: Number(c.montoApertura),
        userId: c.userId,
        userNombre: c.user?.nombre ?? null,
        sessionId: c.id,
        terminal: c.terminal ?? null,
      });
      if (c.status === CashSessionStatus.CERRADA && c.cierreAt) {
        ops.push({
          id: `cierre-${c.id}`,
          fecha: c.cierreAt.toISOString(),
          tipo: 'CIERRE',
          descripcion: `Cierre de caja (dif. ${Number(c.diferencia ?? 0).toFixed(2)})`,
          monto: Number(c.montoCierre ?? 0),
          userId: c.userId,
          userNombre: c.user?.nombre ?? null,
          sessionId: c.id,
          terminal: c.terminal ?? null,
        });
      }
    }

    for (const m of movimientos) {
      ops.push({
        id: `mov-${m.id}`,
        fecha: m.createdAt.toISOString(),
        tipo: m.tipo,
        descripcion: m.motivo ?? (m.tipo === 'INGRESO' ? 'Ingreso de efectivo' : 'Egreso de efectivo'),
        monto: Number(m.monto),
        userId: m.userId,
        userNombre: m.user?.nombre ?? null,
        sessionId: m.cashSessionId,
        terminal: m.cashSession?.terminal ?? null,
      });
    }

    ops.sort((a, b) => b.fecha.localeCompare(a.fecha));
    return ops.slice(0, limit);
  }

  /**
   * Arqueos por turno de caja: una fila por sesión (abierta o cerrada) con su
   * caja, cajero, sucursal, fondo, total vendido, cierre y diferencia. Es el
   * reporte "por caja": se filtra por caja/cajero/sucursal y rango de fechas.
   */
  async arqueos(
    tenantId: string,
    filtros: { from?: string; to?: string; userId?: string; sucursalId?: string; terminalId?: string; limit?: number },
  ): Promise<ArqueoTurno[]> {
    const desde = filtros.from ? new Date(filtros.from) : undefined;
    const hasta = filtros.to ? new Date(filtros.to) : undefined;
    const rango = desde || hasta ? { gte: desde, lte: hasta } : undefined;
    const limit = Math.min(filtros.limit ?? 300, 1000);

    const sessions = await this.prisma.cashSession.findMany({
      where: {
        tenantId,
        ...(filtros.userId ? { userId: filtros.userId } : {}),
        ...(filtros.sucursalId ? { sucursalId: filtros.sucursalId } : {}),
        ...(filtros.terminalId ? { terminalId: filtros.terminalId } : {}),
        ...(rango ? { aperturaAt: rango } : {}),
      },
      include: {
        user: { select: { nombre: true } },
        sucursal: { select: { nombre: true } },
      },
      orderBy: { aperturaAt: 'desc' },
      take: limit,
    });

    // Total vendido y cantidad de ventas por sesión (una sola consulta agrupada).
    const ids = sessions.map((s) => s.id);
    const ventas = ids.length
      ? await this.prisma.sale.groupBy({
          by: ['cashSessionId'],
          where: { tenantId, cashSessionId: { in: ids }, status: { not: 'ANULADA' } },
          _sum: { total: true },
          _count: { _all: true },
        })
      : [];
    const vmap = new Map(ventas.map((v) => [v.cashSessionId, { total: Number(v._sum.total ?? 0), count: v._count._all }]));

    return sessions.map((s) => {
      const v = vmap.get(s.id);
      return {
        sessionId: s.id,
        fechaApertura: s.aperturaAt.toISOString(),
        fechaCierre: s.cierreAt?.toISOString() ?? null,
        abierta: s.status === CashSessionStatus.ABIERTA,
        terminal: s.terminal ?? null,
        sucursalNombre: s.sucursal?.nombre ?? null,
        userNombre: s.user?.nombre ?? null,
        montoApertura: Number(s.montoApertura),
        ventas: v?.count ?? 0,
        totalVendido: v?.total ?? 0,
        montoCierre: s.montoCierre != null ? Number(s.montoCierre) : null,
        diferencia: s.diferencia != null ? Number(s.diferencia) : null,
      };
    });
  }
}

export interface ArqueoTurno {
  sessionId: string;
  fechaApertura: string;
  fechaCierre: string | null;
  abierta: boolean;
  terminal: string | null;
  sucursalNombre: string | null;
  userNombre: string | null;
  montoApertura: number;
  ventas: number;
  totalVendido: number;
  montoCierre: number | null;
  diferencia: number | null;
}

export interface OperacionCaja {
  id: string;
  fecha: string;
  tipo: 'APERTURA' | 'CIERRE' | 'VENTA' | 'INGRESO' | 'EGRESO';
  descripcion: string;
  monto: number;
  medio?: string | null;
  userId?: string | null;
  userNombre?: string | null;
  sessionId?: string | null;
  terminal?: string | null;
  comprobante?: string | null;
}
