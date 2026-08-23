import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TipoListaPrecio } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCategoriaDto, CreateProductDto, UpdateProductDto } from './products.dto';

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

  private async assertCategoria(tenantId: string, categoriaId: string): Promise<void> {
    const cat = await this.prisma.categoria.findFirst({ where: { id: categoriaId, tenantId } });
    if (!cat) throw new BadRequestException('Categoría inexistente');
  }
}
