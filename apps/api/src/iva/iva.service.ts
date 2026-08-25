import { Injectable, NotFoundException } from '@nestjs/common';
import { IvaIndicador } from '@ats/database';
import { clasificarProducto, type Clasificacion, type IvaRule as EngineRule } from '@ats/cfe';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateIvaRuleDto, UpdateIvaRuleDto } from './iva.dto';

/**
 * Motor de IVA: clasifica productos por nombre usando las reglas GLOBALES que
 * administra Aragon en la Consola. Cachea las reglas activas para no pegarle a
 * la base en cada alta de producto.
 */
@Injectable()
export class IvaService {
  constructor(private readonly prisma: PrismaService) {}

  private cache: { reglas: EngineRule[]; at: number } | null = null;
  private static readonly TTL_MS = 30_000;

  private async reglasActivas(): Promise<EngineRule[]> {
    if (this.cache && Date.now() - this.cache.at < IvaService.TTL_MS) return this.cache.reglas;
    const rows = await this.prisma.ivaRule.findMany({
      where: { activo: true },
      orderBy: [{ prioridad: 'desc' }],
    });
    const reglas: EngineRule[] = rows.map((r) => ({
      termino: r.termino,
      ivaIndicador: r.ivaIndicador,
      esEstadoNatural: r.esEstadoNatural,
      esImportado: r.esImportado,
      prioridad: r.prioridad,
    }));
    this.cache = { reglas, at: Date.now() };
    return reglas;
  }

  private invalidate() {
    this.cache = null;
  }

  /** Clasifica un nombre de producto → tratamiento fiscal (indicador + flags). */
  async clasificar(nombre: string): Promise<Clasificacion> {
    const reglas = await this.reglasActivas();
    return clasificarProducto(nombre, reglas);
  }

  // --- Administración de reglas (Consola / plataforma) ----------------------

  listRules() {
    return this.prisma.ivaRule.findMany({ orderBy: [{ prioridad: 'desc' }, { termino: 'asc' }] });
  }

  async createRule(dto: CreateIvaRuleDto) {
    const rule = await this.prisma.ivaRule.create({
      data: {
        termino: dto.termino.trim().toLowerCase(),
        ivaIndicador: dto.ivaIndicador as IvaIndicador,
        esEstadoNatural: dto.esEstadoNatural ?? false,
        esImportado: dto.esImportado ?? false,
        prioridad: dto.prioridad ?? 0,
        nota: dto.nota,
      },
    });
    this.invalidate();
    return rule;
  }

  async updateRule(id: string, dto: UpdateIvaRuleDto) {
    const existing = await this.prisma.ivaRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Regla no encontrada');
    const rule = await this.prisma.ivaRule.update({
      where: { id },
      data: {
        termino: dto.termino !== undefined ? dto.termino.trim().toLowerCase() : undefined,
        ivaIndicador: dto.ivaIndicador as IvaIndicador | undefined,
        esEstadoNatural: dto.esEstadoNatural,
        esImportado: dto.esImportado,
        prioridad: dto.prioridad,
        activo: dto.activo,
        nota: dto.nota,
      },
    });
    this.invalidate();
    return rule;
  }

  async deleteRule(id: string) {
    await this.prisma.ivaRule.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Regla no encontrada');
    });
    this.invalidate();
    return { ok: true };
  }

  /**
   * Reclasifica TODOS los productos que no tienen override del contador. Se
   * corre cuando Aragon cambia las reglas. Devuelve cuántos se actualizaron.
   */
  async reclassifyAll(): Promise<{ actualizados: number; total: number }> {
    const reglas = await this.reglasActivas();
    const productos = await this.prisma.product.findMany({
      where: { ivaOverride: false },
      select: { id: true, nombre: true, ivaIndicador: true, esEstadoNatural: true, esImportado: true, ivaRegla: true },
    });
    let actualizados = 0;
    for (const p of productos) {
      const c = clasificarProducto(p.nombre, reglas);
      const cambia =
        c.ivaIndicador !== p.ivaIndicador ||
        c.esEstadoNatural !== p.esEstadoNatural ||
        c.esImportado !== p.esImportado ||
        (c.regla ?? null) !== (p.ivaRegla ?? null);
      if (!cambia) continue;
      await this.prisma.product.update({
        where: { id: p.id },
        data: {
          ivaIndicador: c.ivaIndicador as IvaIndicador,
          esEstadoNatural: c.esEstadoNatural,
          esImportado: c.esImportado,
          ivaRegla: c.regla,
        },
      });
      actualizados++;
    }
    return { actualizados, total: productos.length };
  }
}
