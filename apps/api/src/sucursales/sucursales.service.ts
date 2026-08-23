import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockMovementType } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import type { CreateSucursalDto, TransferStockDto, UpdateSucursalDto } from './sucursales.dto';

const num = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : Number(v));

@Injectable()
export class SucursalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async list(tenantId: string) {
    const sucursales = await this.prisma.sucursal.findMany({
      where: { tenantId },
      orderBy: { codigo: 'asc' },
    });
    return sucursales.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      codigo: s.codigo,
      direccion: s.direccion,
      activo: s.activo,
    }));
  }

  async create(tenantId: string, dto: CreateSucursalDto) {
    const count = await this.prisma.sucursal.count({ where: { tenantId } });
    await this.entitlements.assertWithinLimit(tenantId, 'maxSucursales', count);

    const last = await this.prisma.sucursal.findFirst({
      where: { tenantId },
      orderBy: { codigo: 'desc' },
    });
    const codigo = (last?.codigo ?? 0) + 1;

    return this.prisma.sucursal.create({
      data: { tenantId, nombre: dto.nombre, direccion: dto.direccion, codigo },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateSucursalDto) {
    const suc = await this.prisma.sucursal.findFirst({ where: { id, tenantId } });
    if (!suc) throw new NotFoundException('Sucursal no encontrada');

    if (dto.activo === false) {
      const activas = await this.prisma.sucursal.count({ where: { tenantId, activo: true } });
      if (activas <= 1 && suc.activo) {
        throw new BadRequestException('Debe quedar al menos una sucursal activa');
      }
    }

    return this.prisma.sucursal.update({
      where: { id },
      data: { nombre: dto.nombre, direccion: dto.direccion, activo: dto.activo },
    });
  }

  /**
   * Transfiere stock de una sucursal a otra: descuenta en origen y suma en
   * destino recalculando el costo promedio ponderado del destino, y deja dos
   * movimientos de stock (TRANSFERENCIA) para trazabilidad.
   */
  async transfer(tenantId: string, dto: TransferStockDto) {
    if (dto.fromSucursalId === dto.toSucursalId) {
      throw new BadRequestException('El origen y el destino no pueden ser la misma sucursal');
    }
    const [from, to, prod] = await Promise.all([
      this.prisma.sucursal.findFirst({ where: { id: dto.fromSucursalId, tenantId } }),
      this.prisma.sucursal.findFirst({ where: { id: dto.toSucursalId, tenantId } }),
      this.prisma.product.findFirst({ where: { id: dto.productId, tenantId } }),
    ]);
    if (!from || !to) throw new BadRequestException('Sucursal inexistente');
    if (!prod) throw new BadRequestException('Producto inexistente');

    return this.prisma.$transaction(async (tx) => {
      const origen = await tx.stock.findUnique({
        where: { productId_sucursalId: { productId: dto.productId, sucursalId: dto.fromSucursalId } },
      });
      const dispon = num(origen?.cantidad);
      if (dispon < dto.cantidad) {
        throw new BadRequestException(`Stock insuficiente en ${from.nombre} (hay ${dispon})`);
      }
      const costoUnit = num(origen?.costoPromedio);

      // Origen: descuenta.
      await tx.stock.update({
        where: { id: origen!.id },
        data: { cantidad: new Prisma.Decimal(dispon - dto.cantidad) },
      });

      // Destino: promedio ponderado.
      const destino = await tx.stock.findUnique({
        where: { productId_sucursalId: { productId: dto.productId, sucursalId: dto.toSucursalId } },
      });
      const prevCant = num(destino?.cantidad);
      const prevCosto = num(destino?.costoPromedio);
      const nuevaCant = prevCant + dto.cantidad;
      const nuevoCosto = nuevaCant > 0 ? (prevCant * prevCosto + dto.cantidad * costoUnit) / nuevaCant : costoUnit;

      if (destino) {
        await tx.stock.update({
          where: { id: destino.id },
          data: { cantidad: new Prisma.Decimal(nuevaCant), costoPromedio: new Prisma.Decimal(nuevoCosto) },
        });
      } else {
        await tx.stock.create({
          data: {
            tenantId,
            productId: dto.productId,
            sucursalId: dto.toSucursalId,
            cantidad: new Prisma.Decimal(nuevaCant),
            costoPromedio: new Prisma.Decimal(nuevoCosto),
          },
        });
      }

      // Movimientos (el modelo StockMovement no lleva sucursal: se anota en el motivo).
      await tx.stockMovement.createMany({
        data: [
          {
            tenantId,
            productId: dto.productId,
            tipo: StockMovementType.TRANSFERENCIA,
            cantidad: new Prisma.Decimal(-dto.cantidad),
            costoUnit: new Prisma.Decimal(costoUnit),
            motivo: `Transferencia a ${to.nombre}`,
          },
          {
            tenantId,
            productId: dto.productId,
            tipo: StockMovementType.TRANSFERENCIA,
            cantidad: new Prisma.Decimal(dto.cantidad),
            costoUnit: new Prisma.Decimal(costoUnit),
            motivo: `Transferencia desde ${from.nombre}`,
          },
        ],
      });

      return {
        productId: dto.productId,
        from: { sucursalId: from.id, nombre: from.nombre, cantidad: Number((dispon - dto.cantidad).toFixed(3)) },
        to: { sucursalId: to.id, nombre: to.nombre, cantidad: Number(nuevaCant.toFixed(3)) },
      };
    });
  }
}
