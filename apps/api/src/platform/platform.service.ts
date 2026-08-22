import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, SubscriptionStatus, TipoListaPrecio } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTenantDto, UpdateTenantDto } from './platform.dto';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  /** Métricas globales para el dashboard de la consola. */
  async overview() {
    const [tenants, activos, porPlan] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { activo: true } }),
      this.prisma.subscription.groupBy({ by: ['estado'], _count: true }),
    ]);
    return { tenants, activos, suscripcionesPorEstado: porPlan };
  }

  async listPlans() {
    return this.prisma.plan.findMany({ where: { activo: true }, orderBy: { orden: 'asc' } });
  }

  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { users: true, products: true, sucursales: true } },
      },
    });
    return tenants.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      slug: t.slug,
      activo: t.activo,
      rut: t.rut,
      plan: t.subscription?.plan.code ?? null,
      estado: t.subscription?.estado ?? 'SIN_SUSCRIPCION',
      usuarios: t._count.users,
      productos: t._count.products,
      sucursales: t._count.sucursales,
      createdAt: t.createdAt,
    }));
  }

  /**
   * Onboarding de un cliente: crea la verdulería (tenant), su sucursal y lista
   * de precios base, el usuario admin + membership, y la suscripción al plan.
   * Todo en una transacción. NOTA: el login del admin se crea aparte en Supabase
   * Auth (mismo email); el backend los enlaza al primer ingreso.
   */
  async createTenant(dto: CreateTenantDto) {
    const plan = await this.prisma.plan.findUnique({ where: { code: dto.planCode } });
    if (!plan) throw new BadRequestException(`Plan "${dto.planCode}" inexistente`);

    const email = dto.adminEmail.trim().toLowerCase();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            nombre: dto.nombre,
            slug: dto.slug,
            rut: dto.rut,
            razonSocial: dto.razonSocial,
            sucursales: { create: { nombre: 'Casa central', codigo: 1 } },
            priceLists: { create: { nombre: 'Mostrador', tipo: TipoListaPrecio.MOSTRADOR } },
            subscription: {
              create: { planId: plan.id, estado: SubscriptionStatus.TRIAL },
            },
          },
        });

        const admin = await tx.user.upsert({
          where: { email },
          update: { homeTenantId: tenant.id },
          create: { email, nombre: dto.adminNombre, homeTenantId: tenant.id },
        });

        await tx.membership.upsert({
          where: { tenantId_userId: { tenantId: tenant.id, userId: admin.id } },
          update: { role: Role.ADMIN, activo: true },
          create: { tenantId: tenant.id, userId: admin.id, role: Role.ADMIN },
        });

        return { tenant, admin: { id: admin.id, email: admin.email }, plan: plan.code };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe una verdulería con ese slug');
      }
      throw e;
    }
  }

  /** Activar/suspender un tenant y/o cambiarle el plan. */
  async updateTenant(id: string, dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, include: { subscription: true } });
    if (!tenant) throw new NotFoundException('Verdulería no encontrada');

    if (typeof dto.activo === 'boolean') {
      await this.prisma.tenant.update({ where: { id }, data: { activo: dto.activo } });
      // Suspender/reactivar también la suscripción (apaga entitlements).
      if (tenant.subscription) {
        await this.prisma.subscription.update({
          where: { tenantId: id },
          data: {
            estado: dto.activo ? SubscriptionStatus.ACTIVA : SubscriptionStatus.SUSPENDIDA,
          },
        });
      }
    }

    if (dto.planCode) {
      const plan = await this.prisma.plan.findUnique({ where: { code: dto.planCode } });
      if (!plan) throw new BadRequestException(`Plan "${dto.planCode}" inexistente`);
      await this.prisma.subscription.upsert({
        where: { tenantId: id },
        update: { planId: plan.id },
        create: { tenantId: id, planId: plan.id, estado: SubscriptionStatus.ACTIVA },
      });
    }

    return this.prisma.tenant.findUnique({
      where: { id },
      include: { subscription: { include: { plan: true } } },
    });
  }
}
