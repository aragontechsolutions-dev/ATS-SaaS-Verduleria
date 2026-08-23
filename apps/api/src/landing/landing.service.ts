import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import { defaultLanding, normalizeLanding, type LandingConfig } from './landing.types';

@Injectable()
export class LandingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Config de edición del tenant (crea el borrador por defecto si no existe). */
  async getForAdmin(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { nombre: true, slug: true, direccion: true, landing: true },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    let landing = tenant.landing;
    if (!landing) {
      const draft = defaultLanding(tenant.nombre, tenant.direccion);
      landing = await this.prisma.tenantLanding.create({
        data: { tenantId, draft: draft as unknown as Prisma.InputJsonValue },
      });
    }

    return {
      slug: tenant.slug,
      estaPublicado: landing.estaPublicado,
      draft: normalizeLanding(landing.draft, tenant.nombre),
    };
  }

  /** Guarda el borrador (normalizado). */
  async saveDraft(tenantId: string, raw: unknown) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { nombre: true } });
    const config: LandingConfig = normalizeLanding(raw, tenant?.nombre);
    await this.prisma.tenantLanding.upsert({
      where: { tenantId },
      create: { tenantId, draft: config as unknown as Prisma.InputJsonValue },
      update: { draft: config as unknown as Prisma.InputJsonValue },
    });
    return { draft: config };
  }

  /** Publica: copia el borrador al snapshot público. */
  async publish(tenantId: string) {
    const existing = await this.prisma.tenantLanding.findUnique({ where: { tenantId } });
    const draft = existing?.draft ?? (defaultLanding('Mi verdulería') as unknown as Prisma.JsonValue);
    await this.prisma.tenantLanding.upsert({
      where: { tenantId },
      create: {
        tenantId,
        draft: draft as unknown as Prisma.InputJsonValue,
        publicado: draft as unknown as Prisma.InputJsonValue,
        estaPublicado: true,
      },
      update: { publicado: draft as unknown as Prisma.InputJsonValue, estaPublicado: true },
    });
    return { estaPublicado: true };
  }

  /** Baja de publicación (deja de mostrarse al público). */
  async unpublish(tenantId: string) {
    await this.prisma.tenantLanding.updateMany({ where: { tenantId }, data: { estaPublicado: false } });
    return { estaPublicado: false };
  }

  /** Vista pública por slug (solo si está publicada). Sin auth. */
  async getPublic(slug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug, activo: true },
      select: { nombre: true, telefono: true, landing: true },
    });
    if (!tenant || !tenant.landing || !tenant.landing.estaPublicado || !tenant.landing.publicado) {
      throw new NotFoundException('Página no encontrada');
    }
    return {
      nombre: tenant.nombre,
      config: normalizeLanding(tenant.landing.publicado, tenant.nombre),
    };
  }
}
