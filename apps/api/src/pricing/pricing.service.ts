import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TipoListaPrecio } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import type { CrearListaDto, GuardarPreciosDto, PreciosMasivoDto } from './pricing.dto';

const num = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : Number(v));
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  private async mostradorId(tenantId: string): Promise<string | null> {
    const l = await this.prisma.priceList.findFirst({
      where: { tenantId, tipo: TipoListaPrecio.MOSTRADOR, activo: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return l?.id ?? null;
  }

  /** Lista de listas de precio (para el selector). */
  async listas(tenantId: string) {
    const listas = await this.prisma.priceList.findMany({
      where: { tenantId, activo: true },
      orderBy: [{ tipo: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, nombre: true, tipo: true, _count: { select: { items: true } } },
    });
    return listas.map((l) => ({ id: l.id, nombre: l.nombre, tipo: l.tipo, items: l._count.items }));
  }

  async crearLista(tenantId: string, dto: CrearListaDto) {
    if (dto.tipo === TipoListaPrecio.MOSTRADOR) {
      throw new BadRequestException('La lista de mostrador se gestiona desde Productos.');
    }
    const lista = await this.prisma.priceList.create({
      data: { tenantId, nombre: dto.nombre.trim(), tipo: dto.tipo },
      select: { id: true, nombre: true, tipo: true },
    });
    return { ...lista, items: 0 };
  }

  /** Productos con costo, precio de mostrador y el precio neto de la lista dada. */
  async precios(tenantId: string, listId: string) {
    const lista = await this.prisma.priceList.findFirst({ where: { id: listId, tenantId }, select: { id: true, nombre: true, tipo: true } });
    if (!lista) throw new NotFoundException('Lista no encontrada');
    const mostradorId = await this.mostradorId(tenantId);

    const productos = await this.prisma.product.findMany({
      where: { tenantId, activo: true },
      orderBy: { nombre: 'asc' },
      include: {
        categoria: { select: { id: true, nombre: true } },
        stockItems: { select: { cantidad: true, costoPromedio: true } },
        priceItems: {
          where: { priceListId: { in: mostradorId ? [mostradorId, listId] : [listId] } },
          select: { priceListId: true, precio: true },
        },
      },
    });

    const items = productos.map((p) => {
      const cant = p.stockItems.reduce((s, x) => s + num(x.cantidad), 0);
      const costoPeso = p.stockItems.reduce((s, x) => s + num(x.cantidad) * num(x.costoPromedio), 0);
      const costo = cant > 0 ? costoPeso / cant : num(p.stockItems[0]?.costoPromedio);
      const mostrador = mostradorId ? num(p.priceItems.find((i) => i.priceListId === mostradorId)?.precio) : 0;
      const neto = p.priceItems.find((i) => i.priceListId === listId)?.precio;
      return {
        productId: p.id,
        nombre: p.nombre,
        categoriaId: p.categoria?.id ?? null,
        categoriaNombre: p.categoria?.nombre ?? null,
        unidadVenta: p.unidadVenta,
        costo: Number(costo.toFixed(4)),
        precioMostrador: mostrador,
        precioNeto: neto == null ? null : num(neto),
      };
    });
    return { lista, items };
  }

  /** Guarda (upsert) los precios netos indicados. precio ≤ 0 borra el ítem. */
  async guardarPrecios(tenantId: string, listId: string, dto: GuardarPreciosDto) {
    await this.assertLista(tenantId, listId);
    for (const it of dto.items) {
      if (it.precio > 0) {
        await this.prisma.priceListItem.upsert({
          where: { priceListId_productId: { priceListId: listId, productId: it.productId } },
          update: { precio: new Prisma.Decimal(it.precio) },
          create: { tenantId, priceListId: listId, productId: it.productId, precio: new Prisma.Decimal(it.precio) },
        });
      } else {
        await this.prisma.priceListItem.deleteMany({ where: { priceListId: listId, productId: it.productId } });
      }
    }
    return { ok: true, actualizados: dto.items.length };
  }

  /** Fija precios en lote: por margen sobre costo, descuento sobre mostrador, o = mostrador. */
  async masivo(tenantId: string, listId: string, dto: PreciosMasivoDto) {
    await this.assertLista(tenantId, listId);
    const { items } = await this.precios(tenantId, listId);
    const valor = dto.valor ?? 0;
    let n = 0;
    for (const it of items) {
      if (dto.categoriaId && it.categoriaId !== dto.categoriaId) continue;
      if (dto.soloVacios && it.precioNeto != null) continue;
      let neto = 0;
      if (dto.modo === 'margenCosto') neto = it.costo * (1 + valor / 100);
      else if (dto.modo === 'descuentoMostrador') neto = it.precioMostrador * (1 - valor / 100);
      else neto = it.precioMostrador;
      neto = round2(neto);
      if (neto <= 0) continue;
      await this.prisma.priceListItem.upsert({
        where: { priceListId_productId: { priceListId: listId, productId: it.productId } },
        update: { precio: new Prisma.Decimal(neto) },
        create: { tenantId, priceListId: listId, productId: it.productId, precio: new Prisma.Decimal(neto) },
      });
      n++;
    }
    return { ok: true, actualizados: n };
  }

  private async assertLista(tenantId: string, listId: string) {
    const l = await this.prisma.priceList.findFirst({ where: { id: listId, tenantId }, select: { id: true } });
    if (!l) throw new NotFoundException('Lista no encontrada');
  }
}
