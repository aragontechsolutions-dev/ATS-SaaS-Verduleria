import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IvaIndicador, MedioPago, OnlineOrderEstado, Prisma, TipoEntrega, TipoListaPrecio, UnidadMedida } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from '../sales/sales.service';
import { CfeService } from '../cfe/cfe.service';
import { TelegramService } from './telegram.service';
import {
  calcLine,
  cantidadEfectiva,
  categoriasDeProductos,
  disponibleDeStock,
  puedeCambiarEstado,
  randomCodigo,
  recomputeOrder,
  round2,
  telegramNewOrderText,
  type OrderLineCalc,
} from './store.helpers';
import type {
  CreateOrderDto,
  CreateZoneDto,
  PesajeDto,
  SaveStoreConfigDto,
  SetEstadoDto,
  UpdateZoneDto,
} from './store.dto';

/** Un producto tal como lo ve la tienda online pública. */
export interface StoreProduct {
  id: string;
  nombre: string;
  descripcionOnline: string | null;
  categoriaId: string | null;
  categoriaNombre: string | null;
  unidadVenta: string;
  esPesable: boolean;
  /** Precio de mostrador con IVA (por kg si es pesable). */
  precio: number;
  imagenUrl: string | null;
  /** Hay stock para pedir. Productos sin stock controlado siempre disponibles. */
  disponible: boolean;
}

export interface StoreCategory {
  id: string;
  nombre: string;
}

export interface StoreZone {
  id: string;
  nombre: string;
  costoEnvio: number;
  pedidoMinimo: number;
}

export interface StorePublicConfig {
  deliveryActivo: boolean;
  pickupActivo: boolean;
  franjas: string[];
  notaCheckout: string | null;
}

export interface StoreCatalog {
  nombre: string;
  slug: string;
  config: StorePublicConfig;
  zonas: StoreZone[];
  categorias: StoreCategory[];
  productos: StoreProduct[];
}

const DEFAULT_CONFIG: StorePublicConfig = {
  deliveryActivo: true,
  pickupActivo: true,
  franjas: [],
  notaCheckout: null,
};

/** Include estándar de un pedido para la vista de administración. */
const ORDER_INCLUDE = { items: true, sale: { include: { cfeDocument: true } } } as const;

/**
 * Tienda online (e-commerce del tenant). Catálogo público, checkout de invitado
 * (crea el pedido recalculando precios con el catálogo, nunca confía en el
 * cliente) y gestión de config/zonas para el Admin.
 */
@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sales: SalesService,
    private readonly cfe: CfeService,
    private readonly telegram: TelegramService,
  ) {}

  /** Resuelve el tenant de una tienda activa por slug, o 404. */
  private async tiendaActiva(slug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug, activo: true },
      select: { id: true, nombre: true, slug: true, tiendaOnlineActiva: true },
    });
    if (!tenant || !tenant.tiendaOnlineActiva) throw new NotFoundException('Tienda no encontrada');
    return tenant;
  }

  private franjasFromJson(raw: unknown): string[] {
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  }

  // --- Público --------------------------------------------------------------

  async getPublicCatalog(slug: string): Promise<StoreCatalog> {
    const tenant = await this.tiendaActiva(slug);

    const [lista, cfg, zonas, productos] = await Promise.all([
      this.prisma.priceList.findFirst({
        where: { tenantId: tenant.id, tipo: TipoListaPrecio.MOSTRADOR, activo: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      }),
      this.prisma.storeConfig.findUnique({ where: { tenantId: tenant.id } }),
      this.prisma.deliveryZone.findMany({
        where: { tenantId: tenant.id, activo: true },
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      }),
      this.prisma.product.findMany({
        where: { tenantId: tenant.id, activo: true, visibleOnline: true },
        include: { categoria: true, stockItems: true },
        orderBy: { nombre: 'asc' },
      }),
    ]);

    const precios = lista
      ? await this.prisma.priceListItem.findMany({
          where: { priceListId: lista.id, productId: { in: productos.map((p) => p.id) } },
        })
      : [];
    const precioById = new Map(precios.map((pi) => [pi.productId, Number(pi.precio)]));

    const items: StoreProduct[] = productos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      descripcionOnline: p.descripcionOnline,
      categoriaId: p.categoriaId,
      categoriaNombre: p.categoria?.nombre ?? null,
      unidadVenta: p.unidadVenta,
      esPesable: p.esPesable,
      precio: precioById.get(p.id) ?? 0,
      imagenUrl: p.imagenUrl,
      disponible: disponibleDeStock(p.stockItems),
    }));

    const config: StorePublicConfig = cfg
      ? {
          deliveryActivo: cfg.deliveryActivo,
          pickupActivo: cfg.pickupActivo,
          franjas: this.franjasFromJson(cfg.franjas),
          notaCheckout: cfg.notaCheckout,
        }
      : DEFAULT_CONFIG;

    return {
      nombre: tenant.nombre,
      slug: tenant.slug,
      config,
      zonas: zonas.map((z) => ({
        id: z.id,
        nombre: z.nombre,
        costoEnvio: Number(z.costoEnvio),
        pedidoMinimo: Number(z.pedidoMinimo),
      })),
      categorias: categoriasDeProductos(items),
      productos: items,
    };
  }

  /** Crea un pedido de la tienda online (checkout de invitado). */
  async createOrder(slug: string, dto: CreateOrderDto) {
    const tenant = await this.tiendaActiva(slug);
    const cfg = await this.prisma.storeConfig.findUnique({ where: { tenantId: tenant.id } });
    const deliveryActivo = cfg?.deliveryActivo ?? DEFAULT_CONFIG.deliveryActivo;
    const pickupActivo = cfg?.pickupActivo ?? DEFAULT_CONFIG.pickupActivo;
    const franjas = this.franjasFromJson(cfg?.franjas);

    // Modo de entrega habilitado.
    if (dto.tipoEntrega === TipoEntrega.DELIVERY && !deliveryActivo) {
      throw new BadRequestException('El envío a domicilio no está disponible.');
    }
    if (dto.tipoEntrega === TipoEntrega.PICKUP && !pickupActivo) {
      throw new BadRequestException('El retiro en el local no está disponible.');
    }

    // Franja: si hay franjas configuradas, exigir una válida.
    if (franjas.length && (!dto.franja || !franjas.includes(dto.franja))) {
      throw new BadRequestException('Elegí una franja horaria válida.');
    }

    // Recalcula las líneas con el catálogo (nunca confía en el precio del cliente).
    const lines = await this.resolveLines(tenant.id, dto.items);
    const subtotal = round2(lines.reduce((s, l) => s + l.subtotal, 0));

    // Entrega: zona + costo + mínimo (delivery) o pickup sin costo.
    let zonaId: string | null = null;
    let zonaNombre: string | null = null;
    let costoEnvio = 0;
    if (dto.tipoEntrega === TipoEntrega.DELIVERY) {
      if (!dto.direccion?.trim()) throw new BadRequestException('Ingresá la dirección de entrega.');
      if (!dto.zonaId) throw new BadRequestException('Elegí una zona de reparto.');
      const zona = await this.prisma.deliveryZone.findFirst({
        where: { id: dto.zonaId, tenantId: tenant.id, activo: true },
      });
      if (!zona) throw new BadRequestException('La zona de reparto no es válida.');
      const minimo = Number(zona.pedidoMinimo);
      if (minimo > 0 && subtotal < minimo) {
        throw new BadRequestException(`El pedido mínimo para ${zona.nombre} es $${minimo}.`);
      }
      zonaId = zona.id;
      zonaNombre = zona.nombre;
      costoEnvio = Number(zona.costoEnvio);
    }

    const total = round2(subtotal + costoEnvio);

    const order = await this.insertOrderWithNumero(tenant.id, {
      dto,
      lines,
      subtotal,
      costoEnvio,
      total,
      zonaId,
      zonaNombre,
    });

    // Aviso al tenant por Telegram (best-effort: no bloquea ni rompe el checkout).
    await this.avisarPedidoNuevo(tenant.id, {
      numero: order.numero,
      codigo: order.codigo,
      clienteNombre: dto.clienteNombre.trim(),
      clienteTelefono: dto.clienteTelefono.trim(),
      tipoEntrega: dto.tipoEntrega,
      zonaNombre,
      franja: dto.franja ?? null,
      direccion: dto.direccion?.trim() || null,
      total,
      items: lines.map((l) => ({ concepto: l.concepto, unidad: l.unidad, cantidad: l.cantidad })),
    });

    return { id: order.id, numero: order.numero, codigo: order.codigo, estado: order.estado, total };
  }

  /** Envía el aviso de pedido nuevo al Telegram del tenant, si está vinculado. */
  private async avisarPedidoNuevo(tenantId: string, msg: Parameters<typeof telegramNewOrderText>[0]) {
    if (!this.telegram.enabled) return;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { telegramChatId: true } });
    if (!tenant?.telegramChatId) return;
    await this.telegram.sendMessage(tenant.telegramChatId, telegramNewOrderText(msg));
  }

  /** Resuelve las líneas del pedido validando productos y recalculando precios. */
  private async resolveLines(tenantId: string, items: CreateOrderDto['items']): Promise<OrderLineCalc[]> {
    const ids = [...new Set(items.map((i) => i.productId))];
    const lista = await this.prisma.priceList.findFirst({
      where: { tenantId, tipo: TipoListaPrecio.MOSTRADOR, activo: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const productos = await this.prisma.product.findMany({
      where: { tenantId, id: { in: ids }, activo: true, visibleOnline: true },
      include: { priceItems: lista ? { where: { priceListId: lista.id } } : false },
    });
    const byId = new Map(productos.map((p) => [p.id, p]));

    const lines: OrderLineCalc[] = [];
    for (const it of items) {
      const p = byId.get(it.productId);
      if (!p) throw new BadRequestException('Un producto del pedido ya no está disponible.');
      const precio = Number(p.priceItems?.[0]?.precio ?? 0);
      if (precio <= 0) throw new BadRequestException(`"${p.nombre}" no tiene precio publicado.`);
      lines.push(calcLine({ id: p.id, nombre: p.nombre, unidadVenta: p.unidadVenta, esPesable: p.esPesable, precio }, it.cantidad));
    }
    return lines;
  }

  /** Inserta el pedido asignando el nº correlativo del tenant (con reintentos). */
  private async insertOrderWithNumero(
    tenantId: string,
    data: {
      dto: CreateOrderDto;
      lines: OrderLineCalc[];
      subtotal: number;
      costoEnvio: number;
      total: number;
      zonaId: string | null;
      zonaNombre: string | null;
    },
  ) {
    const { dto, lines, subtotal, costoEnvio, total, zonaId, zonaNombre } = data;
    for (let intento = 0; intento < 5; intento++) {
      const last = await this.prisma.onlineOrder.findFirst({
        where: { tenantId },
        orderBy: { numero: 'desc' },
        select: { numero: true },
      });
      const numero = (last?.numero ?? 0) + 1;
      try {
        return await this.prisma.onlineOrder.create({
          data: {
            tenantId,
            numero,
            codigo: randomCodigo(),
            tipoEntrega: dto.tipoEntrega,
            zonaId,
            zonaNombre,
            franja: dto.franja ?? null,
            clienteNombre: dto.clienteNombre.trim(),
            clienteTelefono: dto.clienteTelefono.trim(),
            direccion: dto.direccion?.trim() || null,
            notas: dto.notas?.trim() || null,
            subtotal: new Prisma.Decimal(subtotal),
            costoEnvio: new Prisma.Decimal(costoEnvio),
            total: new Prisma.Decimal(total),
            items: {
              create: lines.map((l) => ({
                tenantId,
                productId: l.productId,
                concepto: l.concepto,
                unidad: l.unidad,
                esPesable: l.esPesable,
                cantidad: new Prisma.Decimal(l.cantidad),
                precioUnit: new Prisma.Decimal(l.precioUnit),
                subtotal: new Prisma.Decimal(l.subtotal),
              })),
            },
          },
          select: { id: true, numero: true, codigo: true, estado: true },
        });
      } catch (e) {
        // Choque del correlativo (dos pedidos a la vez): reintenta.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new BadRequestException('No se pudo registrar el pedido, probá de nuevo.');
  }

  /** Seguimiento público de un pedido por código. */
  async getOrderByCodigo(slug: string, codigo: string) {
    const tenant = await this.tiendaActiva(slug);
    const order = await this.prisma.onlineOrder.findFirst({
      where: { tenantId: tenant.id, codigo: codigo.trim().toUpperCase() },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return this.toOrderView(order);
  }

  private toOrderView(order: Prisma.OnlineOrderGetPayload<{ include: { items: true } }>) {
    return {
      numero: order.numero,
      codigo: order.codigo,
      estado: order.estado,
      tipoEntrega: order.tipoEntrega,
      zonaNombre: order.zonaNombre,
      franja: order.franja,
      clienteNombre: order.clienteNombre,
      direccion: order.direccion,
      notas: order.notas,
      subtotal: Number(order.subtotal),
      costoEnvio: Number(order.costoEnvio),
      total: Number(order.total),
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((i) => ({
        concepto: i.concepto,
        unidad: i.unidad,
        esPesable: i.esPesable,
        cantidad: Number(i.cantidad),
        precioUnit: Number(i.precioUnit),
        subtotal: Number(i.subtotal),
      })),
    };
  }

  // --- Admin: config + zonas ------------------------------------------------

  async getConfig(tenantId: string) {
    const [tenant, cfg, zonas] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { tiendaOnlineActiva: true, slug: true, telegramChatId: true },
      }),
      this.prisma.storeConfig.findUnique({ where: { tenantId } }),
      this.prisma.deliveryZone.findMany({ where: { tenantId }, orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] }),
    ]);
    return {
      tiendaOnlineActiva: tenant?.tiendaOnlineActiva ?? false,
      slug: tenant?.slug ?? '',
      deliveryActivo: cfg?.deliveryActivo ?? DEFAULT_CONFIG.deliveryActivo,
      pickupActivo: cfg?.pickupActivo ?? DEFAULT_CONFIG.pickupActivo,
      franjas: this.franjasFromJson(cfg?.franjas),
      notaCheckout: cfg?.notaCheckout ?? '',
      telegram: {
        disponible: this.telegram.enabled,
        vinculado: !!tenant?.telegramChatId,
      },
      zonas: zonas.map((z) => ({
        id: z.id,
        nombre: z.nombre,
        costoEnvio: Number(z.costoEnvio),
        pedidoMinimo: Number(z.pedidoMinimo),
        activo: z.activo,
        orden: z.orden,
      })),
    };
  }

  // --- Telegram: vinculación y avisos ---------------------------------------

  /** Genera un código y devuelve el deep link para vincular el Telegram del tenant. */
  async telegramLink(tenantId: string) {
    if (!this.telegram.enabled || !this.telegram.botUsername) {
      throw new BadRequestException('Las notificaciones por Telegram no están configuradas en el sistema.');
    }
    const code = `${randomCodigo()}${randomCodigo()}`;
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { telegramLinkCode: code } });
    return {
      deepLink: `https://t.me/${this.telegram.botUsername}?start=${code}`,
      botUsername: this.telegram.botUsername,
    };
  }

  /** Envía un mensaje de prueba al Telegram vinculado. */
  async telegramTest(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { telegramChatId: true, nombre: true } });
    if (!tenant?.telegramChatId) throw new BadRequestException('Todavía no vinculaste tu Telegram.');
    const ok = await this.telegram.sendMessage(tenant.telegramChatId, `✅ <b>${tenant.nombre}</b>\nLas notificaciones de pedidos están activas.`);
    if (!ok) throw new BadRequestException('No se pudo enviar el mensaje de prueba.');
    return { ok: true };
  }

  /** Desvincula el Telegram del tenant. */
  async telegramUnlink(tenantId: string) {
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { telegramChatId: null, telegramLinkCode: null } });
    return { vinculado: false };
  }

  /**
   * Webhook entrante de Telegram. Vincula el chat cuando el usuario envía
   * `/start <code>` (o el código suelto). Siempre responde ok para que Telegram
   * no reintente. Valida el secreto de la ruta antes de procesar.
   */
  async handleTelegramWebhook(secret: string, update: unknown): Promise<{ ok: true }> {
    if (!this.telegram.enabled || secret !== this.telegram.webhookSecret) return { ok: true };

    const message = (update as { message?: { text?: string; chat?: { id?: number | string } } })?.message;
    const text = message?.text?.trim();
    const chatId = message?.chat?.id;
    if (!text || chatId == null) return { ok: true };

    // Extrae el código: "/start CODE" o el texto suelto.
    const m = text.match(/^\/start(?:@\w+)?\s+(\S+)/) ?? text.match(/^(\S{8,})$/);
    const code = m?.[1];
    if (!code) {
      await this.telegram.sendMessage(String(chatId), 'Para vincular tu verdulería, tocá el botón "Vincular Telegram" en el panel de administración.');
      return { ok: true };
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { telegramLinkCode: code }, select: { id: true, nombre: true } });
    if (!tenant) {
      await this.telegram.sendMessage(String(chatId), 'El código de vinculación no es válido o ya expiró. Generá uno nuevo desde el panel.');
      return { ok: true };
    }

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { telegramChatId: String(chatId), telegramLinkCode: null },
    });
    await this.telegram.sendMessage(String(chatId), `✅ <b>${tenant.nombre}</b> quedó vinculada.\nTe voy a avisar acá cada vez que entre un pedido nuevo.`);
    return { ok: true };
  }

  async saveConfig(tenantId: string, dto: SaveStoreConfigDto) {
    const franjas = dto.franjas
      ? (dto.franjas.map((f) => f.trim()).filter(Boolean) as unknown as Prisma.InputJsonValue)
      : undefined;
    await this.prisma.storeConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        deliveryActivo: dto.deliveryActivo ?? true,
        pickupActivo: dto.pickupActivo ?? true,
        franjas: franjas ?? [],
        notaCheckout: dto.notaCheckout?.trim() || null,
      },
      update: {
        ...(dto.deliveryActivo !== undefined ? { deliveryActivo: dto.deliveryActivo } : {}),
        ...(dto.pickupActivo !== undefined ? { pickupActivo: dto.pickupActivo } : {}),
        ...(franjas !== undefined ? { franjas } : {}),
        ...(dto.notaCheckout !== undefined ? { notaCheckout: dto.notaCheckout.trim() || null } : {}),
      },
    });
    return this.getConfig(tenantId);
  }

  async createZone(tenantId: string, dto: CreateZoneDto) {
    await this.prisma.deliveryZone.create({
      data: {
        tenantId,
        nombre: dto.nombre.trim(),
        costoEnvio: new Prisma.Decimal(dto.costoEnvio),
        pedidoMinimo: new Prisma.Decimal(dto.pedidoMinimo ?? 0),
        orden: dto.orden ?? 0,
      },
    });
    return this.getConfig(tenantId);
  }

  async updateZone(tenantId: string, id: string, dto: UpdateZoneDto) {
    const zona = await this.prisma.deliveryZone.findFirst({ where: { id, tenantId } });
    if (!zona) throw new NotFoundException('Zona no encontrada');
    await this.prisma.deliveryZone.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
        ...(dto.costoEnvio !== undefined ? { costoEnvio: new Prisma.Decimal(dto.costoEnvio) } : {}),
        ...(dto.pedidoMinimo !== undefined ? { pedidoMinimo: new Prisma.Decimal(dto.pedidoMinimo) } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        ...(dto.orden !== undefined ? { orden: dto.orden } : {}),
      },
    });
    return this.getConfig(tenantId);
  }

  async deleteZone(tenantId: string, id: string) {
    const zona = await this.prisma.deliveryZone.findFirst({ where: { id, tenantId } });
    if (!zona) throw new NotFoundException('Zona no encontrada');
    // Si tiene pedidos, la desactivamos (preserva el histórico); si no, la borramos.
    const usada = await this.prisma.onlineOrder.count({ where: { tenantId, zonaId: id } });
    if (usada > 0) await this.prisma.deliveryZone.update({ where: { id }, data: { activo: false } });
    else await this.prisma.deliveryZone.delete({ where: { id } });
    return this.getConfig(tenantId);
  }

  // --- Admin: gestión de pedidos --------------------------------------------

  /** Lista de pedidos del tenant (opcionalmente por estado), del más nuevo al más viejo. */
  async listOrders(tenantId: string, estado?: OnlineOrderEstado) {
    const orders = await this.prisma.onlineOrder.findMany({
      where: { tenantId, ...(estado ? { estado } : {}) },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    // Resumen de conteos por estado (para badges y el aviso de nuevos).
    const grouped = await this.prisma.onlineOrder.groupBy({
      by: ['estado'],
      where: { tenantId },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const g of grouped) counts[g.estado] = g._count._all;
    return { counts, orders: orders.map((o) => this.toAdminOrder(o)) };
  }

  async getOrderAdmin(tenantId: string, id: string) {
    const order = await this.prisma.onlineOrder.findFirst({ where: { id, tenantId }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return this.toAdminOrder(order);
  }

  /** Cambia el estado del pedido (no permite tocar los pedidos ya cerrados). */
  async setEstado(tenantId: string, id: string, dto: SetEstadoDto) {
    const order = await this.prisma.onlineOrder.findFirst({ where: { id, tenantId }, include: { items: true } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (!puedeCambiarEstado(order.estado)) {
      throw new BadRequestException('El pedido ya está cerrado y no se puede modificar.');
    }

    // Al ENTREGAR, el pedido se convierte en venta (stock + reportes + CFE).
    if (dto.estado === OnlineOrderEstado.ENTREGADO && !order.saleId) {
      await this.facturarPedido(tenantId, order);
    }

    const updated = await this.prisma.onlineOrder.update({
      where: { id },
      data: { estado: dto.estado },
      include: ORDER_INCLUDE,
    });
    return this.toAdminOrder(updated);
  }

  /**
   * Convierte un pedido entregado en una venta: reutiliza el flujo de ventas del
   * POS (descuenta stock, entra a reportes) y emite el CFE (e-Ticket). Idempotente:
   * la clave de la venta es el id del pedido, así reintentar no factura dos veces.
   * Usa la cantidad REAL (pesada) de cada ítem; el envío va como una línea aparte.
   */
  private async facturarPedido(
    tenantId: string,
    order: Prisma.OnlineOrderGetPayload<{ include: { items: true } }>,
  ): Promise<void> {
    // IVA por producto (los ítems del pedido no lo guardan; lo tomamos del catálogo).
    const productIds = order.items.map((i) => i.productId).filter((x): x is string => !!x);
    const productos = productIds.length
      ? await this.prisma.product.findMany({ where: { tenantId, id: { in: productIds } }, select: { id: true, ivaIndicador: true } })
      : [];
    const ivaById = new Map(productos.map((p) => [p.id, p.ivaIndicador]));

    const items = order.items.map((i) => ({
      productId: i.productId ?? undefined,
      concepto: i.concepto,
      unidad: (i.unidad in UnidadMedida ? i.unidad : UnidadMedida.UNIDAD) as UnidadMedida,
      cantidad: i.cantidadReal != null ? Number(i.cantidadReal) : Number(i.cantidad),
      precioUnit: Number(i.precioUnit),
      ivaIndicador: (i.productId && ivaById.get(i.productId)) || IvaIndicador.MINIMA,
    }));

    // Envío como línea de servicio (si corresponde). El contador puede ajustar la tasa.
    const costoEnvio = Number(order.costoEnvio);
    if (order.tipoEntrega === TipoEntrega.DELIVERY && costoEnvio > 0) {
      items.push({
        productId: undefined,
        concepto: `Envío${order.zonaNombre ? ` (${order.zonaNombre})` : ''}`,
        unidad: UnidadMedida.UNIDAD,
        cantidad: 1,
        precioUnit: costoEnvio,
        ivaIndicador: IvaIndicador.BASICA,
      });
    }

    // Sucursal principal del tenant (los pedidos online no tienen caja).
    const sucursal = await this.prisma.sucursal.findFirst({
      where: { tenantId, activo: true },
      orderBy: { codigo: 'asc' },
      select: { id: true },
    });

    const total = round2(items.reduce((s, it) => s + it.precioUnit * it.cantidad, 0));

    // Pago: contra entrega en efectivo (el gateway online es fase 2).
    const sale = await this.sales.createSale(tenantId, {
      idempotencyKey: order.id,
      sucursalId: sucursal?.id,
      customerId: order.customerId ?? undefined,
      items,
      payments: [{ medio: MedioPago.EFECTIVO, monto: total }],
    });

    await this.prisma.onlineOrder.update({ where: { id: order.id }, data: { saleId: sale.id } });

    // CFE best-effort: si falla, la venta ya existe y el CFE se puede reintentar.
    try {
      await this.cfe.emitirParaVenta(tenantId, sale.id);
    } catch (e) {
      this.logger.error(`No se pudo emitir el CFE del pedido ${order.numero}: ${e instanceof Error ? e.message : e}`);
    }
  }

  /**
   * Registra el pesaje/preparación: guarda la cantidad real por ítem y recalcula
   * los subtotales y el total del pedido. Solo mientras no esté cerrado.
   */
  async pesaje(tenantId: string, id: string, dto: PesajeDto) {
    const order = await this.prisma.onlineOrder.findFirst({ where: { id, tenantId }, include: { items: true } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (!puedeCambiarEstado(order.estado)) {
      throw new BadRequestException('El pedido ya está cerrado y no se puede modificar.');
    }

    const realById = new Map(dto.items.map((i) => [i.itemId, i.cantidad]));
    // Cantidad efectiva por ítem = la pesada si vino en el body, si no la actual.
    const merged = order.items.map((it) => ({
      id: it.id,
      precioUnit: Number(it.precioUnit),
      cantidad: Number(it.cantidad),
      cantidadReal: realById.has(it.id) ? realById.get(it.id)! : (it.cantidadReal != null ? Number(it.cantidadReal) : null),
    }));
    const { lineas, subtotal, total } = recomputeOrder(merged, Number(order.costoEnvio));

    await this.prisma.$transaction([
      ...merged.map((m, idx) =>
        this.prisma.onlineOrderItem.update({
          where: { id: m.id },
          data: {
            cantidadReal: m.cantidadReal != null ? new Prisma.Decimal(m.cantidadReal) : null,
            subtotal: new Prisma.Decimal(lineas[idx]),
          },
        }),
      ),
      this.prisma.onlineOrder.update({
        where: { id },
        data: {
          subtotal: new Prisma.Decimal(subtotal),
          total: new Prisma.Decimal(total),
          // Al pesar por primera vez, si estaba NUEVO/CONFIRMADO lo pasamos a PREPARANDO.
          ...(order.estado === OnlineOrderEstado.NUEVO || order.estado === OnlineOrderEstado.CONFIRMADO
            ? { estado: OnlineOrderEstado.PREPARANDO }
            : {}),
        },
      }),
    ]);

    return this.getOrderAdmin(tenantId, id);
  }

  private toAdminOrder(o: Prisma.OnlineOrderGetPayload<{ include: typeof ORDER_INCLUDE }>) {
    const cfe = o.sale?.cfeDocument;
    return {
      id: o.id,
      numero: o.numero,
      codigo: o.codigo,
      estado: o.estado,
      tipoEntrega: o.tipoEntrega,
      zonaNombre: o.zonaNombre,
      franja: o.franja,
      clienteNombre: o.clienteNombre,
      clienteTelefono: o.clienteTelefono,
      direccion: o.direccion,
      notas: o.notas,
      subtotal: Number(o.subtotal),
      costoEnvio: Number(o.costoEnvio),
      total: Number(o.total),
      saleId: o.saleId,
      comprobante: cfe
        ? { tipo: cfe.tipo, estado: cfe.estado, serie: cfe.serie, numero: cfe.numero }
        : null,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((i) => ({
        id: i.id,
        concepto: i.concepto,
        unidad: i.unidad,
        esPesable: i.esPesable,
        cantidad: Number(i.cantidad),
        cantidadReal: i.cantidadReal != null ? Number(i.cantidadReal) : null,
        cantidadEfectiva: cantidadEfectiva(Number(i.cantidad), i.cantidadReal != null ? Number(i.cantidadReal) : null),
        precioUnit: Number(i.precioUnit),
        subtotal: Number(i.subtotal),
      })),
    };
  }
}
