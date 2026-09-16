import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RemitoEstado } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import type { CrearRemitoDto } from './remitos.dto';

const num = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : Number(v));

@Injectable()
export class RemitosService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(tenantId: string, dto: CrearRemitoDto) {
    // Snapshot del cliente (del customer si se pasa, o del nombre suelto).
    let clienteNombre = dto.clienteNombre?.trim() ?? '';
    let clienteDoc: string | null = null;
    if (dto.customerId) {
      const c = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, tenantId },
        select: { nombre: true, razonSocial: true, documento: true },
      });
      if (!c) throw new NotFoundException('Cliente no encontrado');
      clienteNombre = c.razonSocial?.trim() || c.nombre;
      clienteDoc = c.documento ?? null;
    }
    if (!clienteNombre) throw new BadRequestException('Falta el nombre del cliente.');

    const last = await this.prisma.remito.findFirst({
      where: { tenantId },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const numero = (last?.numero ?? 0) + 1;

    const remito = await this.prisma.remito.create({
      data: {
        tenantId,
        numero,
        customerId: dto.customerId,
        clienteNombre,
        clienteDoc,
        transportista: dto.transportista?.trim() || null,
        matricula: dto.matricula?.trim() || null,
        destino: dto.destino?.trim() || null,
        notas: dto.notas?.trim() || null,
        items: {
          create: dto.items.map((it) => ({
            tenantId,
            productId: it.productId,
            concepto: it.concepto,
            cantidad: new Prisma.Decimal(it.cantidad),
            unidad: it.unidad,
          })),
        },
      },
      select: { id: true, numero: true },
    });
    return remito;
  }

  /** Lista de remitos recientes (para la grilla). */
  async listar(tenantId: string, limit = 100) {
    const rows = await this.prisma.remito.findMany({
      where: { tenantId },
      orderBy: { fecha: 'desc' },
      take: limit,
      include: { _count: { select: { items: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      numero: r.numero,
      fecha: r.fecha.toISOString(),
      clienteNombre: r.clienteNombre,
      clienteDoc: r.clienteDoc,
      transportista: r.transportista,
      matricula: r.matricula,
      destino: r.destino,
      estado: r.estado,
      lineas: r._count.items,
    }));
  }

  /** Remito completo con ítems (para imprimir). */
  async get(tenantId: string, id: string) {
    const r = await this.prisma.remito.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!r) throw new NotFoundException('Remito no encontrado');
    return {
      id: r.id,
      numero: r.numero,
      fecha: r.fecha.toISOString(),
      clienteNombre: r.clienteNombre,
      clienteDoc: r.clienteDoc,
      transportista: r.transportista,
      matricula: r.matricula,
      destino: r.destino,
      notas: r.notas,
      estado: r.estado,
      items: r.items.map((it) => ({ concepto: it.concepto, cantidad: num(it.cantidad), unidad: it.unidad })),
    };
  }

  async setEstado(tenantId: string, id: string, estado: RemitoEstado) {
    const r = await this.prisma.remito.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!r) throw new NotFoundException('Remito no encontrado');
    await this.prisma.remito.update({ where: { id }, data: { estado } });
    return { ok: true, estado };
  }
}
