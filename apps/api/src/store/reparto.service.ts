import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnlineOrderEstado, RepartidorEstadoTipo, TipoEntrega } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import { StoreService } from './store.service';
import { elegirRepartidor, type Punto } from './dispatch';
import type { LocalUbicacionDto, PresenciaDto } from './reparto.dto';

/** Estados de un pedido que aún está en manos del reparto (no terminado). */
const EN_CURSO: OnlineOrderEstado[] = [OnlineOrderEstado.PREPARANDO, OnlineOrderEstado.EN_CAMINO];

@Injectable()
export class RepartoService {
  private readonly logger = new Logger(RepartoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly store: StoreService,
  ) {}

  // ---- Repartidor (PWA) -----------------------------------------------------

  /** Heartbeat de presencia + ubicación. Al quedar DISPONIBLE, procesa la cola. */
  async presencia(tenantId: string, userId: string, dto: PresenciaDto) {
    // Si tiene un pedido encima, su estado real es EN_ENTREGA (no se puede liberar solo).
    const activos = await this.prisma.onlineOrder.count({
      where: { tenantId, repartidorId: userId, estado: { in: EN_CURSO } },
    });
    const estado = activos > 0 ? RepartidorEstadoTipo.EN_ENTREGA : (dto.estado as RepartidorEstadoTipo);
    const tieneUbic = dto.lat != null && dto.lng != null;

    await this.prisma.repartidorEstado.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      update: { estado, ...(tieneUbic ? { lat: dto.lat, lng: dto.lng, ubicacionAt: new Date() } : {}) },
      create: {
        tenantId, userId, estado,
        lat: tieneUbic ? dto.lat : null,
        lng: tieneUbic ? dto.lng : null,
        ubicacionAt: tieneUbic ? new Date() : null,
      },
    });

    if (estado === RepartidorEstadoTipo.DISPONIBLE) await this.procesarCola(tenantId);
    return { estado, pedidos: await this.misPedidos(tenantId, userId) };
  }

  /** Pedidos en curso asignados a este repartidor (su cola de trabajo). */
  async misPedidos(tenantId: string, userId: string) {
    const orders = await this.prisma.onlineOrder.findMany({
      where: { tenantId, repartidorId: userId, estado: { in: EN_CURSO } },
      include: { items: true },
      orderBy: { asignadoAt: 'asc' },
    });
    return orders.map((o) => ({
      id: o.id,
      numero: o.numero,
      codigo: o.codigo,
      estado: o.estado,
      cliente: o.clienteNombre,
      telefono: o.clienteTelefono,
      direccion: o.direccion,
      // Punto exacto marcado en el mapa (si el cliente lo marcó): para navegar preciso.
      lat: o.entregaLat != null ? Number(o.entregaLat) : null,
      lng: o.entregaLng != null ? Number(o.entregaLng) : null,
      notas: o.notas,
      total: Number(o.total),
      items: o.items.map((it) => ({
        concepto: it.concepto,
        cantidad: Number(it.cantidadReal ?? it.cantidad),
        unidad: it.unidad,
      })),
    }));
  }

  /** El repartidor arranca el reparto de un pedido asignado (PREPARANDO → EN_CAMINO). */
  async marcarEnCamino(tenantId: string, userId: string, orderId: string) {
    const o = await this.pedidoPropio(tenantId, userId, orderId);
    if (o.estado !== OnlineOrderEstado.PREPARANDO) {
      throw new NotFoundException('El pedido no está listo para salir');
    }
    await this.store.setEstado(tenantId, orderId, { estado: OnlineOrderEstado.EN_CAMINO });
    return this.misPedidos(tenantId, userId);
  }

  /** Entrega efectiva: factura + emite CFE, libera al repartidor y sigue la cola. */
  async marcarEntregado(tenantId: string, userId: string, orderId: string) {
    await this.pedidoPropio(tenantId, userId, orderId);
    // Reutiliza el flujo del negocio: ENTREGADO genera venta (stock/reportes) + CFE.
    await this.store.setEstado(tenantId, orderId, { estado: OnlineOrderEstado.ENTREGADO });
    await this.prisma.onlineOrder.update({ where: { id: orderId }, data: { entregadoAt: new Date() } });

    // Libera al repartidor (si no le queda otro pedido encima) y procesa la cola.
    const quedan = await this.prisma.onlineOrder.count({
      where: { tenantId, repartidorId: userId, estado: { in: EN_CURSO } },
    });
    await this.prisma.repartidorEstado.updateMany({
      where: { tenantId, userId },
      data: { estado: quedan > 0 ? RepartidorEstadoTipo.EN_ENTREGA : RepartidorEstadoTipo.DISPONIBLE },
    });
    await this.procesarCola(tenantId);
    return this.misPedidos(tenantId, userId);
  }

  private async pedidoPropio(tenantId: string, userId: string, orderId: string) {
    const o = await this.prisma.onlineOrder.findFirst({ where: { id: orderId, tenantId, repartidorId: userId } });
    if (!o) throw new NotFoundException('Pedido no encontrado o no asignado a vos');
    return o;
  }

  // ---- Negocio (panel admin) ------------------------------------------------

  /** Despacha un pedido: lo pone en cola y dispara la asignación automática. */
  async despachar(tenantId: string, orderId: string) {
    const o = await this.prisma.onlineOrder.findFirst({ where: { id: orderId, tenantId } });
    if (!o) throw new NotFoundException('Pedido no encontrado');
    if (o.tipoEntrega !== TipoEntrega.DELIVERY) throw new NotFoundException('El pedido es para retiro, no para reparto');
    if (o.estado === OnlineOrderEstado.ENTREGADO || o.estado === OnlineOrderEstado.CANCELADO) {
      throw new NotFoundException('El pedido ya está cerrado');
    }
    await this.prisma.onlineOrder.update({
      where: { id: orderId },
      data: {
        listoParaRepartir: true,
        // Al despachar, el pedido queda "listo para salir" (PREPARANDO): así entra
        // en la ventana de asignación (EN_CURSO) y el repartidor lo puede arrancar.
        // Sin esto, un pedido despachado en CONFIRMADO quedaba invisible al motor.
        ...(o.estado === OnlineOrderEstado.NUEVO || o.estado === OnlineOrderEstado.CONFIRMADO
          ? { estado: OnlineOrderEstado.PREPARANDO }
          : {}),
      },
    });
    await this.procesarCola(tenantId);
    return this.estado(tenantId);
  }

  /** Ubica el local (coordenadas) para el cálculo de cercanía. */
  async setLocal(tenantId: string, dto: LocalUbicacionDto) {
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { lat: dto.lat, lng: dto.lng } });
    return this.estado(tenantId);
  }

  /** Panorama de reparto para el panel: repartidores, sus estados y la cola. */
  async estado(tenantId: string) {
    const [tenant, repartidores, enCola, asignados] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { lat: true, lng: true } }),
      this.prisma.repartidorEstado.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.onlineOrder.findMany({
        where: { tenantId, listoParaRepartir: true, repartidorId: null, estado: { in: EN_CURSO } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.onlineOrder.findMany({
        where: { tenantId, repartidorId: { not: null }, estado: { in: EN_CURSO } },
      }),
    ]);
    // Nombres de repartidores (modelo sin relación directa a User).
    const ids = repartidores.map((r) => r.userId);
    const users = ids.length
      ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true, email: true } })
      : [];
    const nombre = new Map(users.map((u) => [u.id, u.nombre || u.email]));
    const cargaPorRep = new Map<string, number>();
    for (const a of asignados) if (a.repartidorId) cargaPorRep.set(a.repartidorId, (cargaPorRep.get(a.repartidorId) ?? 0) + 1);

    return {
      local: tenant?.lat != null && tenant?.lng != null ? { lat: Number(tenant.lat), lng: Number(tenant.lng) } : null,
      repartidores: repartidores.map((r) => ({
        userId: r.userId,
        nombre: nombre.get(r.userId) ?? 'Repartidor',
        estado: r.estado,
        lat: r.lat != null ? Number(r.lat) : null,
        lng: r.lng != null ? Number(r.lng) : null,
        ubicacionAt: r.ubicacionAt,
        pedidosEncima: cargaPorRep.get(r.userId) ?? 0,
      })),
      enCola: enCola.map((o) => ({ id: o.id, numero: o.numero, cliente: o.clienteNombre, direccion: o.direccion, total: Number(o.total) })),
    };
  }

  // ---- Motor de asignación --------------------------------------------------

  /**
   * Asigna tantos pedidos en cola como repartidores libres haya, eligiendo para
   * cada pedido al repartidor libre más cercano al local. FIFO por pedido.
   */
  private async procesarCola(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { lat: true, lng: true } });
    const local: Punto | null = tenant?.lat != null && tenant?.lng != null ? { lat: Number(tenant.lat), lng: Number(tenant.lng) } : null;

    // Bucle acotado: cada iteración asigna 1 pedido; corta cuando se acaba cola o libres.
    for (let guardia = 0; guardia < 500; guardia++) {
      const siguiente = await this.prisma.onlineOrder.findFirst({
        where: { tenantId, listoParaRepartir: true, repartidorId: null, estado: { in: EN_CURSO } },
        orderBy: { createdAt: 'asc' },
      });
      if (!siguiente) return;

      const libres = await this.prisma.repartidorEstado.findMany({
        where: { tenantId, estado: RepartidorEstadoTipo.DISPONIBLE },
        orderBy: { ubicacionAt: 'asc' }, // desempate: el que hace más rato está libre
      });
      if (libres.length === 0) return;

      const elegido = elegirRepartidor(
        libres.map((r) => ({ userId: r.userId, lat: r.lat != null ? Number(r.lat) : null, lng: r.lng != null ? Number(r.lng) : null })),
        local,
      );
      if (!elegido) return;

      await this.prisma.$transaction([
        this.prisma.onlineOrder.update({
          where: { id: siguiente.id },
          data: { repartidorId: elegido, asignadoAt: new Date(), listoParaRepartir: false },
        }),
        this.prisma.repartidorEstado.update({
          where: { tenantId_userId: { tenantId, userId: elegido } },
          data: { estado: RepartidorEstadoTipo.EN_ENTREGA },
        }),
      ]);
      this.logger.log(`Pedido #${siguiente.numero} asignado al repartidor ${elegido}`);
    }
  }
}
