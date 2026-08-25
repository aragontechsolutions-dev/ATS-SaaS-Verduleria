import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IvaIndicador, Prisma, TipoListaPrecio } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import { IvaService } from '../iva/iva.service';
import type {
  BulkPriceDto,
  CreateCategoriaDto,
  CreateProductDto,
  UpdateCategoriaDto,
  UpdateProductDto,
} from './products.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly iva: IvaService,
  ) {}

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
      ivaOverride: p.ivaOverride,
      ivaRegla: p.ivaRegla,
      esEstadoNatural: p.esEstadoNatural,
      esImportado: p.esImportado,
      imagenUrl: p.imagenUrl,
      activo: p.activo,
      precio: Number(p.priceItems[0]?.precio ?? 0),
    }));
  }

  /** Clasifica un nombre con el motor de IVA (para la vista previa del alta). */
  clasificarIva(nombre: string) {
    return this.iva.clasificar(nombre);
  }

  async create(tenantId: string, dto: CreateProductDto) {
    const listId = await this.mostradorListId(tenantId);
    if (dto.categoriaId) await this.assertCategoria(tenantId, dto.categoriaId);

    // IVA: por override manual del contador, o asignado por el motor según el nombre.
    let iva: { ivaIndicador: IvaIndicador; esEstadoNatural: boolean; esImportado: boolean; ivaOverride: boolean; ivaRegla: string | null };
    if (dto.ivaOverride && dto.ivaIndicador) {
      iva = {
        ivaIndicador: dto.ivaIndicador,
        esEstadoNatural: dto.esEstadoNatural ?? false,
        esImportado: dto.esImportado ?? false,
        ivaOverride: true,
        ivaRegla: null,
      };
    } else {
      const c = await this.iva.clasificar(dto.nombre);
      iva = {
        ivaIndicador: c.ivaIndicador as IvaIndicador,
        esEstadoNatural: c.esEstadoNatural,
        esImportado: c.esImportado,
        ivaOverride: false,
        ivaRegla: c.regla,
      };
    }

    const product = await this.prisma.product.create({
      data: {
        tenantId,
        nombre: dto.nombre,
        unidadVenta: dto.unidadVenta,
        esPesable: dto.esPesable,
        ...iva,
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

    // Resuelve el IVA: override del contador, reclasificación del motor, o sin cambios.
    const iva = await this.resolverIvaUpdate(product, dto);

    await this.prisma.product.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        unidadVenta: dto.unidadVenta,
        esPesable: dto.esPesable,
        ...iva,
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

  /**
   * Decide qué campos de IVA escribir al actualizar un producto:
   *  - override del contador → guarda los valores manuales, sin reclasificar.
   *  - sin override → si cambió el nombre (o se acaba de sacar el override),
   *    reclasifica con el motor; si no, no toca el IVA.
   */
  private async resolverIvaUpdate(
    product: { nombre: string; ivaIndicador: IvaIndicador; esEstadoNatural: boolean; esImportado: boolean; ivaOverride: boolean; ivaRegla: string | null },
    dto: UpdateProductDto,
  ): Promise<Prisma.ProductUncheckedUpdateInput> {
    const overrideNext = dto.ivaOverride ?? product.ivaOverride;

    if (overrideNext) {
      return {
        ivaIndicador: dto.ivaIndicador ?? product.ivaIndicador,
        esEstadoNatural: dto.esEstadoNatural ?? product.esEstadoNatural,
        esImportado: dto.esImportado ?? product.esImportado,
        ivaOverride: true,
        ivaRegla: null,
      };
    }

    const nombreCambia = dto.nombre !== undefined && dto.nombre !== product.nombre;
    const seSacoOverride = product.ivaOverride === true; // pasaba a auto
    if (!nombreCambia && !seSacoOverride) return {}; // nada que reclasificar

    const c = await this.iva.clasificar(dto.nombre ?? product.nombre);
    return {
      ivaIndicador: c.ivaIndicador as IvaIndicador,
      esEstadoNatural: c.esEstadoNatural,
      esImportado: c.esImportado,
      ivaOverride: false,
      ivaRegla: c.regla,
    };
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
