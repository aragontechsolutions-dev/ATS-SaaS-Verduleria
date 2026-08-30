import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTerminalDto, SetOperadoresDto, UpdateTerminalDto } from './terminals.dto';

/** Roles que pueden operar cualquier caja sin necesidad de asignación explícita. */
const SUPERVISORES: string[] = [Role.ADMIN, Role.ENCARGADO];

@Injectable()
export class TerminalsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Listado para gestión (Panel): cajas con su sucursal y operadores asignados. */
  async list(tenantId: string) {
    const terminals = await this.prisma.terminal.findMany({
      where: { tenantId },
      orderBy: [{ sucursal: { codigo: 'asc' } }, { nombre: 'asc' }],
      include: {
        sucursal: { select: { id: true, nombre: true } },
        operadores: { select: { userId: true } },
      },
    });
    return terminals.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      activo: t.activo,
      sucursalId: t.sucursalId,
      sucursalNombre: t.sucursal.nombre,
      operadorIds: t.operadores.map((o) => o.userId),
    }));
  }

  async create(tenantId: string, dto: CreateTerminalDto) {
    const suc = await this.prisma.sucursal.findFirst({ where: { id: dto.sucursalId, tenantId } });
    if (!suc) throw new BadRequestException('Sucursal inexistente');

    const nombre = dto.nombre.trim();
    if (!nombre) throw new BadRequestException('El nombre de la caja es obligatorio');

    const dup = await this.prisma.terminal.findFirst({ where: { tenantId, sucursalId: dto.sucursalId, nombre } });
    if (dup) throw new ConflictException('Ya existe una caja con ese nombre en la sucursal');

    return this.prisma.terminal.create({ data: { tenantId, sucursalId: dto.sucursalId, nombre } });
  }

  async update(tenantId: string, id: string, dto: UpdateTerminalDto) {
    const term = await this.prisma.terminal.findFirst({ where: { id, tenantId } });
    if (!term) throw new NotFoundException('Caja no encontrada');

    const nombre = dto.nombre?.trim();
    if (nombre && nombre !== term.nombre) {
      const dup = await this.prisma.terminal.findFirst({
        where: { tenantId, sucursalId: term.sucursalId, nombre, id: { not: id } },
      });
      if (dup) throw new ConflictException('Ya existe una caja con ese nombre en la sucursal');
    }

    return this.prisma.terminal.update({
      where: { id },
      data: { nombre: nombre ?? undefined, activo: dto.activo },
    });
  }

  /** Elimina la caja. Si tiene turnos históricos, se desactiva en vez de borrar. */
  async remove(tenantId: string, id: string) {
    const term = await this.prisma.terminal.findFirst({ where: { id, tenantId } });
    if (!term) throw new NotFoundException('Caja no encontrada');

    const usos = await this.prisma.cashSession.count({ where: { tenantId, terminalId: id } });
    if (usos > 0) {
      // Hay arqueos que la referencian: la baja lógica preserva el histórico.
      await this.prisma.terminal.update({ where: { id }, data: { activo: false } });
      return { deleted: false, deactivated: true };
    }
    await this.prisma.terminal.delete({ where: { id } });
    return { deleted: true, deactivated: false };
  }

  /** Reemplaza la lista de cajeros habilitados para la caja (asignación). */
  async setOperadores(tenantId: string, id: string, dto: SetOperadoresDto) {
    const term = await this.prisma.terminal.findFirst({ where: { id, tenantId } });
    if (!term) throw new NotFoundException('Caja no encontrada');

    const userIds = [...new Set(dto.userIds)];
    if (userIds.length > 0) {
      // Solo usuarios que son miembros del tenant.
      const miembros = await this.prisma.membership.findMany({
        where: { tenantId, userId: { in: userIds } },
        select: { userId: true },
      });
      const validos = new Set(miembros.map((m) => m.userId));
      const invalidos = userIds.filter((u) => !validos.has(u));
      if (invalidos.length > 0) throw new BadRequestException('Algún cajero no pertenece a esta verdulería');
    }

    await this.prisma.$transaction([
      this.prisma.terminalOperador.deleteMany({ where: { terminalId: id } }),
      ...(userIds.length > 0
        ? [this.prisma.terminalOperador.createMany({ data: userIds.map((userId) => ({ tenantId, terminalId: id, userId })) })]
        : []),
    ]);
    return { terminalId: id, operadorIds: userIds };
  }

  /**
   * Cajas que el usuario puede operar (para el POS). Filtra por sucursal si se
   * indica. Una caja sin operadores asignados la puede abrir cualquiera; con
   * operadores, solo los asignados (los supervisores pueden operar todas).
   */
  async mine(tenantId: string, userId: string | undefined, role: string | undefined, sucursalId?: string) {
    if (!userId) return [];
    const terminals = await this.prisma.terminal.findMany({
      where: { tenantId, activo: true, ...(sucursalId ? { sucursalId } : {}) },
      orderBy: [{ sucursal: { codigo: 'asc' } }, { nombre: 'asc' }],
      include: {
        sucursal: { select: { id: true, nombre: true } },
        operadores: { select: { userId: true } },
      },
    });
    const esSupervisor = role != null && SUPERVISORES.includes(role);
    return terminals
      .filter((t) => esSupervisor || t.operadores.length === 0 || t.operadores.some((o) => o.userId === userId))
      .map((t) => ({ id: t.id, nombre: t.nombre, sucursalId: t.sucursalId, sucursalNombre: t.sucursal.nombre }));
  }

  /**
   * Valida que el usuario pueda abrir turno en la caja indicada y devuelve su
   * nombre (snapshot). Lo usa la apertura de caja. Lanza si no está permitido.
   */
  async resolveForOpen(
    tenantId: string,
    userId: string,
    role: string | undefined,
    terminalId: string,
    sucursalId?: string,
  ): Promise<{ id: string; nombre: string }> {
    const term = await this.prisma.terminal.findFirst({
      where: { id: terminalId, tenantId },
      include: { operadores: { select: { userId: true } } },
    });
    if (!term) throw new BadRequestException('La caja seleccionada no existe');
    if (!term.activo) throw new BadRequestException('La caja seleccionada está inactiva');
    if (sucursalId && term.sucursalId !== sucursalId) {
      throw new BadRequestException('La caja no pertenece a la sucursal seleccionada');
    }
    const esSupervisor = role != null && SUPERVISORES.includes(role);
    const habilitado = esSupervisor || term.operadores.length === 0 || term.operadores.some((o) => o.userId === userId);
    if (!habilitado) throw new ForbiddenException('No tenés permiso para operar esta caja');
    return { id: term.id, nombre: term.nombre };
  }

  /** ¿El tenant tiene alguna caja gestionada? (para decidir el flujo del POS). */
  async count(tenantId: string): Promise<number> {
    return this.prisma.terminal.count({ where: { tenantId } });
  }
}
