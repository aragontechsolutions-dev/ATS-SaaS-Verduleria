import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TipoListaPrecio } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import type {
  BulkPriceDto,
  CreateCategoriaDto,
  CreateProductDto,
  UpdateCategoriaDto,
  UpdateProductDto,
} from './products.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista de precios de mostrador del tenant (la crea si no existe). */
  private async mostradorListId(tenantId: string): Promise<string> {
    const existing = await this.prisma.priceList.findFirst({
      where: { tenantId, tipo: TipoListaPrecio.MOSTRADOR },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing.id;
    const created = await this.prisma.priceList.create({
      data: { tenantId, nombre: 'Mostrador', tipo: TipoListaPrecio.MOSTRADOR },
    });
    return created.id;
  }

  async list(tenantId: string) {
    const listId = await this.mostradorListId(tenantId);
    const products = await this.prisma.product.findMany({
      where: { tenantId },
      orderBy: { nombre: 'asc' },
      include: { categoria: true, priceItems: { where: { priceListId: listId } } },
    });
    return products.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      plu: p.plu,
      codigoBarras: p.codigoBarras,
      categoriaId: p.categoriaId,
      categoriaNombre: p.categoria?.nombre ?? null,
      unidadVenta: p.unidadVenta,
      esPesable: p.esPesable,
      ivaIndicador: p.ivaIndicador,
      imagenUrl: p.imagenUrl,
      activo: p.activo,
      precio: Number(p.priceItems[0]?.precio ?? 0),
    }));
  }

  async create(tenantId: string, dto: CreateProductDto) {
    const listId = await this.mostradorListId(tenantId);
    if (dto.categoriaId) await this.assertCategoria(tenantId, dto.categoriaId);

    const product = await this.prisma.product.create({
      data: {
        tenantId,
        nombre: dto.nombre,
        unidadVenta: dto.unidadVenta,
        esPesable: dto.esPesable,
        ivaIndicador: dto.ivaIndicador,
        categoriaId: dto.categoriaId,
        plu: dto.plu,
        codigoBarras: dto.codigoBarras,
        imagenUrl: dto.imagenUrl,
        priceItems: { create: { tenantId, priceListId: listId, precio: new Prisma.Decimal(dto.precio) } },
      },
    });
    return { id: product.id };
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({ where: { id, tenantId } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    if (dto.categoriaId) await this.assertCategoria(tenantId, dto.categoriaId);

    await this.prisma.product.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        unidadVenta: dto.unidadVenta,
        esPesable: dto.esPesable,
        ivaIndicador: dto.ivaIndicador,
        categoriaId: dto.categoriaId,
        plu: dto.plu,
        codigoBarras: dto.codigoBarras,
        imagenUrl: dto.imagenUrl,
        activo: dto.activo,
      },
    });

    if (dto.precio !== undefined) {
      const listId = await this.mostradorListId(tenantId);
      await this.prisma.priceListItem.upsert({
        where: { priceListId_productId: { priceListId: listId, productId: id } },
        update: { precio: new Prisma.Decimal(dto.precio) },
        create: { tenantId, priceListId: listId, productId: id, precio: new Prisma.Decimal(dto.precio) },
      });
    }
    return { id };
  }

  // --- Categorías ---
  async listCategorias(tenantId: string) {
    return this.prisma.categoria.findMany({ where: { tenantId }, orderBy: { orden: 'asc' } });
  }

  async createCategoria(tenantId: string, dto: CreateCategoriaDto) {
    return this.prisma.categoria.create({
      data: { tenantId, nombre: dto.nombre, ivaIndicadorDefault: dto.ivaIndicadorDefault },
    });
  }

  async updateCategoria(tenantId: string, id: string, dto: UpdateCategoriaDto) {
    await this.assertCategoria(tenantId, id);
    return this.prisma.categoria.update({
      where: { id },
      data: { nombre: dto.nombre, ivaIndicadorDefault: dto.ivaIndicadorDefault, orden: dto.orden },
    });
  }

  /**
   * Actualización masiva de precios de mostrador (por % o precio fijo), opcional
   * por categoría y con redondeo. Pensado para el ajuste diario de la verdulería.
   */
  async bulkUpdatePrices(tenantId: string, dto: BulkPriceDto) {
    if (dto.operacion === 'PORCENTAJE' && dto.valor <= -100) {
      throw new BadRequestException('El porcentaje dejaría precios negativos');
    }
    const listId = await this.mostradorListId(tenantId);
    const items = await this.prisma.priceListItem.findMany({
      where: {
        tenantId,
        priceListId: listId,
        product: { is: { activo: true, ...(dto.categoriaId ? { categoriaId: dto.categoriaId } : {}) } },
      },
    });

    let actualizados = 0;
    for (const it of items) {
      const actual = Number(it.precio);
      let nuevo = dto.operacion === 'FIJO' ? dto.valor : actual * (1 + dto.valor / 100);
      if (dto.redondear && dto.redondear > 0) nuevo = Math.round(nuevo / dto.redondear) * dto.redondear;
      nuevo = Math.max(0, Number(nuevo.toFixed(4)));
      await this.prisma.priceListItem.update({ where: { id: it.id }, data: { precio: new Prisma.Decimal(nuevo) } });
      actualizados++;
    }
    return { actualizados };
  }

  private async assertCategoria(tenantId: string, categoriaId: string): Promise<void> {
    const cat = await this.prisma.categoria.findFirst({ where: { id: categoriaId, tenantId } });
    if (!cat) throw new BadRequestException('Categoría inexistente');
  }
}
