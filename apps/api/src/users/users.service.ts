import { randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import type { CreateUserDto, UpdateUserDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  /** Usuarios (memberships) del tenant. */
  async list(tenantId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: { user: true },
    });
    return memberships.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      email: m.user.email,
      nombre: m.user.nombre,
      role: m.role,
      activo: m.activo,
    }));
  }

  /**
   * Da de alta un empleado en el tenant: crea el login en Supabase Auth
   * (best-effort), el User y la membership con el rol. Idempotente por email.
   */
  async create(tenantId: string, dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const password = dto.password || 'ATS-' + randomBytes(4).toString('hex');

    const existingMembership = await this.prisma.membership.findFirst({
      where: { tenantId, user: { email } },
    });
    if (existingMembership) {
      throw new ConflictException('Ese email ya es usuario de esta verdulería');
    }

    const user = await this.prisma.user.upsert({
      where: { email },
      update: { nombre: dto.nombre },
      create: { email, nombre: dto.nombre },
    });

    await this.prisma.membership.create({
      data: { tenantId, userId: user.id, role: dto.role },
    });

    let loginCreado = false;
    try {
      const authUserId = await this.auth.provisionSupabaseUser(email, password);
      if (authUserId && user.authUserId !== authUserId) {
        await this.prisma.user.update({ where: { id: user.id }, data: { authUserId } });
        loginCreado = true;
      } else if (authUserId) {
        loginCreado = true;
      }
    } catch {
      /* el usuario quedó creado; el login se puede generar aparte */
    }

    return { email, password: loginCreado ? password : undefined, loginCreado };
  }

  async update(tenantId: string, membershipId: string, dto: UpdateUserDto) {
    const membership = await this.prisma.membership.findFirst({ where: { id: membershipId, tenantId } });
    if (!membership) throw new NotFoundException('Usuario no encontrado');
    if (dto.role === undefined && dto.activo === undefined) {
      throw new BadRequestException('Nada para actualizar');
    }
    return this.prisma.membership.update({
      where: { id: membershipId },
      data: { role: dto.role, activo: dto.activo },
      include: { user: true },
    });
  }
}
