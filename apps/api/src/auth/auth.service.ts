import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

/** Claims del JWT que emite el backend. */
export interface JwtClaims {
  sub: string; // userId
  email: string;
  tenantId: string;
  role: string;
  emisorRut?: string;
}

export interface LoginResult {
  accessToken: string;
  user: { id: string; email: string; nombre: string };
  tenant: { id: string; nombre: string };
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Valida email + contraseña y devuelve un JWT con el tenant y rol del usuario.
   * El tenant sale de su membership (prefiere el homeTenant si tiene uno activo).
   */
  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: {
        memberships: { where: { activo: true }, include: { tenant: true } },
      },
    });

    // Mensaje genérico para no filtrar si el email existe.
    if (!user || !user.passwordHash || !user.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    if (user.memberships.length === 0) {
      throw new UnauthorizedException('El usuario no tiene acceso a ninguna verdulería');
    }
    const membership =
      user.memberships.find((m) => m.tenantId === user.homeTenantId) ?? user.memberships[0];
    const tenant = membership.tenant;

    const claims: JwtClaims = {
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
      role: membership.role,
      emisorRut: tenant.rut ?? undefined,
    };
    const accessToken = await this.jwt.signAsync(claims);

    return {
      accessToken,
      user: { id: user.id, email: user.email, nombre: user.nombre },
      tenant: { id: tenant.id, nombre: tenant.nombre },
      role: membership.role,
    };
  }

  /** Verifica un token y devuelve sus claims (o lanza si es inválido/expirado). */
  async verify(token: string): Promise<JwtClaims> {
    return this.jwt.verifyAsync<JwtClaims>(token);
  }

  /** Hash de contraseña (para seed / alta de usuarios). */
  static hash(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}
