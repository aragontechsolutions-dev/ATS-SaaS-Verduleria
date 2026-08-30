import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, SubscriptionStatus, TipoListaPrecio } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { generateTempPassword } from '../common/password.util';
import type { CreateTenantDto, UpdateTenantDto } from './platform.dto';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  /** Métricas globales para el dashboard de la consola. */
  async overview() {
    const [tenants, activos, porPlan] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { activo: true } }),
      this.prisma.subscription.groupBy({ by: ['estado'], _count: true }),
    ]);
    return { tenants, activos, suscripcionesPorEstado: porPlan };
  }

  /** Usuarios bloqueados (por intentos fallidos) de todos los tenants. */
  async lockedUsers() {
    const users = await this.prisma.user.findMany({
      where: { bloqueado: true },
      include: { memberships: { include: { tenant: { select: { nombre: true } } } } },
      orderBy: { updatedAt: 'desc' },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      tenants: u.memberships.map((m) => m.tenant.nombre),
      roles: [...new Set(u.memberships.map((m) => m.role))],
    }));
  }

  /** Desbloquea a un usuario (cualquier tenant) y lo obliga a cambiar la clave. */
  async unlockUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    await this.prisma.user.update({
      where: { id: userId },
      data: { bloqueado: false, failedLoginAttempts: 0, mustChangePassword: true },
    });
    return { ok: true };
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
    const password = dto.adminPassword || this.generatePassword();

    let result: { tenantId: string; adminId: string };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            nombre: dto.nombre,
            slug: dto.slug,
            rut: dto.rut,
            razonSocial: dto.razonSocial,
            sucursales: { create: { nombre: 'Casa central', codigo: 1 } },
            priceLists: { create: { nombre: 'Mostrador', tipo: TipoListaPrecio.MOSTRADOR } },
            subscription: { create: { planId: plan.id, estado: SubscriptionStatus.TRIAL } },
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

        return { tenantId: tenant.id, adminId: admin.id };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe una verdulería con ese slug');
      }
      throw e;
    }

    // Crear el login en Supabase Auth (best-effort, fuera de la transacción de BD).
    let loginCreado = false;
    try {
      const authUserId = await this.auth.provisionSupabaseUser(email, password);
      if (authUserId) {
        await this.prisma.user.update({ where: { id: result.adminId }, data: { authUserId } });
        loginCreado = true;
      }
    } catch {
      // La verdulería quedó creada; el login se puede crear/reintentar aparte.
    }

    return {
      tenantId: result.tenantId,
      plan: plan.code,
      admin: {
        email,
        // Devolvemos la contraseña UNA vez para que el owner se la pase al cliente.
        password: loginCreado ? password : undefined,
        loginCreado,
      },
    };
  }

  /** Contraseña inicial legible (para comunicar al cliente). */
  private generatePassword(): string {
    return generateTempPassword();
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
