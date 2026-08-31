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
  efectivoEsperado: number; // apertura + ventas efectivo + ingresos − egresos − sangrías
  montoApertura: number;
  ingresos: number;
  egresos: number;
  /** Total retirado por sangrías en el turno. */
  sangrias: number;
  /** Límite de efectivo en cajón (config del tenant; null = sin límite). */
  limiteEfectivo: number | null;
  /** true si el efectivo esperado supera el límite (conviene una sangría). */
  superaLimite: boolean;
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
      // Una caja física no puede tener dos turnos abiertos a la vez.
      const abiertaEnCaja = await this.prisma.cashSession.findFirst({
        where: { tenantId, terminalId, status: CashSessionStatus.ABIERTA },
      });
      if (abiertaEnCaja) {
        throw new ConflictException('Esa caja ya tiene un turno abierto. Usá el relevo para cambiar de cajero.');
      }
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

    const [sales, movimientos, tenant] = await Promise.all([
      this.prisma.sale.findMany({
        where: { tenantId, cashSessionId: sessionId, status: { not: 'ANULADA' } },
        include: { payments: true },
      }),
      this.prisma.cashMovement.findMany({ where: { tenantId, cashSessionId: sessionId } }),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { limiteEfectivoCaja: true } }),
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
    let sangrias = 0;
    for (const m of movimientos) {
      if (m.tipo === 'INGRESO') ingresos += Number(m.monto);
      else if (m.tipo === 'SANGRIA') sangrias += Number(m.monto);
      else egresos += Number(m.monto);
    }

    const efectivoEsperado = Number(session.montoApertura) + efectivoVentas + ingresos - egresos - sangrias;
    const limiteEfectivo = tenant?.limiteEfectivoCaja != null ? Number(tenant.limiteEfectivoCaja) : null;

    return {
      ventas: sales.length,
      totalVendido,
      porMedio,
      efectivoEsperado,
      montoApertura: Number(session.montoApertura),
      ingresos,
      egresos,
      sangrias,
      limiteEfectivo,
      superaLimite: limiteEfectivo != null && limiteEfectivo > 0 && efectivoEsperado > limiteEfectivo,
    };
  }

  /** Registra un movimiento de caja (ingreso/egreso de efectivo) del turno. */
  async addMovement(
    tenantId: string,
    userId: string | undefined,
    sessionId: string,
    dto: { tipo: 'INGRESO' | 'EGRESO' | 'SANGRIA'; monto: number; motivo?: string },
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
    // La sangría es un egreso de efectivo (sale del cajón hacia la caja fuerte).
    const esIngreso = dto.tipo === 'INGRESO';
    const label = dto.tipo === 'INGRESO' ? 'Ingreso' : dto.tipo === 'SANGRIA' ? 'Sangría (retiro a caja fuerte)' : 'Egreso';
    await this.audit.log({
      tipo: esIngreso ? AuditEventTipo.MOV_INGRESO : AuditEventTipo.MOV_EGRESO,
      descripcion: `${label} de efectivo${dto.motivo ? ` · ${dto.motivo}` : ''}`,
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
   * Relevo de cajero: cambio de turno SIN interrumpir la caja física. El cajero
   * saliente cuenta el efectivo (arqueo ciego) y elige al entrante; el sistema
   * cierra su turno con ese conteo y abre uno nuevo para el entrante en la misma
   * caja, con el efectivo contado como fondo. Cada cajero queda con su arqueo.
   */
  async relevo(
    tenantId: string,
    fromUserId: string | undefined,
    _fromRole: string | undefined,
    dto: { toUserId: string; montoContado: number; notas?: string },
  ) {
    if (!fromUserId) throw new BadRequestException('Falta el usuario para el relevo');
    if (!(dto.montoContado >= 0)) throw new BadRequestException('Ingresá el efectivo contado');

    const prev = await this.prisma.cashSession.findFirst({
      where: { tenantId, userId: fromUserId, status: CashSessionStatus.ABIERTA },
      orderBy: { aperturaAt: 'desc' },
    });
    if (!prev) throw new NotFoundException('No tenés una caja abierta para relevar');
    if (!prev.terminalId) {
      throw new BadRequestException('El relevo requiere una caja gestionada. Cerrá la caja normalmente.');
    }
    if (dto.toUserId === fromUserId) throw new BadRequestException('Elegí un cajero distinto para el relevo');

    // El entrante debe pertenecer al tenant, poder operar la caja y no tener otra abierta.
    const memEntrante = await this.prisma.membership.findFirst({
      where: { tenantId, userId: dto.toUserId, activo: true },
      include: { user: { select: { nombre: true, activo: true } } },
    });
    if (!memEntrante || memEntrante.user.activo === false) {
      throw new BadRequestException('El cajero entrante no es un usuario activo de la verdulería');
    }
    await this.terminals.resolveForOpen(tenantId, dto.toUserId, memEntrante.role, prev.terminalId, prev.sucursalId ?? undefined);
    const yaAbierta = await this.prisma.cashSession.findFirst({
      where: { tenantId, userId: dto.toUserId, status: CashSessionStatus.ABIERTA },
    });
    if (yaAbierta) throw new ConflictException('El cajero entrante ya tiene una caja abierta');

    const saliente = await this.prisma.user.findUnique({ where: { id: fromUserId }, select: { nombre: true } });
    const nombreSaliente = saliente?.nombre ?? 'cajero saliente';
    const nombreEntrante = memEntrante.user.nombre;
    const nota = `Relevo: ${nombreSaliente} → ${nombreEntrante}${dto.notas ? ` · ${dto.notas}` : ''}`;

    // Cierre ciego del turno saliente (el conteo es el efectivo del cajón).
    const cierre = await this.close(tenantId, prev.id, { montoCierre: dto.montoContado, notas: nota });
    // Apertura del turno entrante en la misma caja, con el conteo como fondo.
    const nueva = await this.open(tenantId, dto.toUserId, memEntrante.role, {
      montoApertura: dto.montoContado,
      sucursalId: prev.sucursalId ?? undefined,
      terminalId: prev.terminalId,
    });

    return {
      diferencia: cierre.diferencia,
      terminal: prev.terminal,
      entrante: nombreEntrante,
      nuevaSessionId: nueva.id,
      cerradaSessionId: prev.id,
    };
  }

  /**
   * Corte de caja X (parcial, con la caja abierta) o Z (definitivo, con la caja
   * cerrada). Es el resumen del turno por cajero/caja: fondo, ventas, desglose
   * por medio de pago, ingresos/egresos y —si cerró— cierre y diferencia.
   */
  async corte(tenantId: string, sessionId: string): Promise<CortePayload> {
    const session = await this.prisma.cashSession.findFirst({
      where: { id: sessionId, tenantId },
      include: { user: { select: { nombre: true } }, sucursal: { select: { nombre: true } } },
    });
    if (!session) throw new NotFoundException('Caja no encontrada');

    const resumen = await this.summary(tenantId, sessionId);
    const cerrada = session.status === CashSessionStatus.CERRADA;

    return {
      tipo: cerrada ? 'Z' : 'X',
      sessionId: session.id,
      terminal: session.terminal ?? null,
      sucursalNombre: session.sucursal?.nombre ?? null,
      userNombre: session.user?.nombre ?? null,
      aperturaAt: session.aperturaAt.toISOString(),
      cierreAt: session.cierreAt?.toISOString() ?? null,
      montoApertura: resumen.montoApertura,
      ingresos: resumen.ingresos,
      egresos: resumen.egresos,
      sangrias: resumen.sangrias,
      ventas: resumen.ventas,
      totalVendido: resumen.totalVendido,
      porMedio: resumen.porMedio,
      efectivoEsperado: resumen.efectivoEsperado,
      montoCierre: session.montoCierre != null ? Number(session.montoCierre) : null,
      diferencia: session.diferencia != null ? Number(session.diferencia) : null,
      arqueoDetalle: (session.arqueoDetalle as Record<string, ArqueoMedio> | null) ?? null,
      generadoAt: new Date().toISOString(),
    };
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
        descripcion: m.motivo ?? (m.tipo === 'INGRESO' ? 'Ingreso de efectivo' : m.tipo === 'SANGRIA' ? 'Sangría (retiro a caja fuerte)' : 'Egreso de efectivo'),
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
        esRelevo: (s.notas ?? '').startsWith('Relevo:'),
      };
    });
  }
}

export interface CortePayload {
  tipo: 'X' | 'Z';
  sessionId: string;
  terminal: string | null;
  sucursalNombre: string | null;
  userNombre: string | null;
  aperturaAt: string;
  cierreAt: string | null;
  montoApertura: number;
  ingresos: number;
  egresos: number;
  sangrias: number;
  ventas: number;
  totalVendido: number;
  porMedio: Record<string, number>;
  efectivoEsperado: number;
  montoCierre: number | null;
  diferencia: number | null;
  arqueoDetalle: Record<string, ArqueoMedio> | null;
  generadoAt: string;
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
  esRelevo: boolean;
}

export interface OperacionCaja {
  id: string;
  fecha: string;
  tipo: 'APERTURA' | 'CIERRE' | 'VENTA' | 'INGRESO' | 'EGRESO' | 'SANGRIA';
  descripcion: string;
  monto: number;
  medio?: string | null;
  userId?: string | null;
  userNombre?: string | null;
  sessionId?: string | null;
  terminal?: string | null;
  comprobante?: string | null;
}
