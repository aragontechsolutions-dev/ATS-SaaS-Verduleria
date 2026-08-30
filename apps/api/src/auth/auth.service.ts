import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';

/** Identidad devuelta por Supabase Auth (GoTrue) para un token válido. */
export interface SupabaseUser {
  id: string; // auth.users.id (uuid)
  email?: string;
}

/** Contexto resuelto de nuestra app (tenant + rol) para un usuario autenticado. */
export interface ResolvedAuth {
  userId: string;
  /** Vacío si es un super-admin de plataforma sin membership a un tenant. */
  tenantId: string;
  role: string;
  emisorRut?: string;
  isPlatformAdmin: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // Cache corto de tokens verificados para no pegarle a Supabase en cada request.
  private readonly tokenCache = new Map<string, { user: SupabaseUser; expiresAt: number }>();
  private readonly tokenTtlMs = 30_000;
  private readonly tokenCacheMax = 5_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Verifica un access token de Supabase contra GoTrue (/auth/v1/user). Sirve
   * para cualquier algoritmo de firma (HS256 o llaves asimétricas), sin
   * necesidad de conocer el secreto localmente.
   */
  async verifySupabaseToken(token: string): Promise<SupabaseUser> {
    const cached = this.tokenCache.get(token);
    if (cached && Date.now() < cached.expiresAt) return cached.user;

    const { url, anonKey } = this.config.get('supabase', { infer: true });
    if (!url || !anonKey) throw new UnauthorizedException('Supabase no configurado en el backend');

    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!res.ok) throw new UnauthorizedException('Token de Supabase inválido');

    const body = (await res.json()) as { id: string; email?: string };
    const user: SupabaseUser = { id: body.id, email: body.email };
    this.pruneTokenCache();
    this.tokenCache.set(token, { user, expiresAt: Date.now() + this.tokenTtlMs });
    return user;
  }

  /** Evita crecimiento ilimitado del cache: purga vencidos y, si hace falta, lo vacía. */
  private pruneTokenCache(): void {
    if (this.tokenCache.size < this.tokenCacheMax) return;
    const now = Date.now();
    for (const [k, v] of this.tokenCache) if (now >= v.expiresAt) this.tokenCache.delete(k);
    if (this.tokenCache.size >= this.tokenCacheMax) this.tokenCache.clear();
  }

  /**
   * Mapea el usuario de Supabase a nuestro `User` (por authUserId o email) y
   * resuelve su tenant y rol desde la membership. Enlaza authUserId en el primer
   * login para futuros lookups.
   */
  async resolveContext(sup: SupabaseUser): Promise<ResolvedAuth> {
    const email = sup.email?.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        activo: true,
        OR: [...(sup.id ? [{ authUserId: sup.id }] : []), ...(email ? [{ email }] : [])],
      },
      include: { memberships: { where: { activo: true }, include: { tenant: true } } },
    });

    if (!user) throw new UnauthorizedException('El usuario no está habilitado en el sistema');
    // Un super-admin de plataforma puede no tener membership a ningún tenant.
    if (user.memberships.length === 0 && !user.isPlatformAdmin) {
      throw new UnauthorizedException('El usuario no tiene acceso a ninguna verdulería');
    }

    // Enlazar authUserId la primera vez (solo si vino un id real de Supabase).
    if (sup.id && user.authUserId !== sup.id) {
      await this.prisma.user
        .update({ where: { id: user.id }, data: { authUserId: sup.id } })
        .catch((e) => this.logger.warn(`No se pudo enlazar authUserId: ${e}`));
    }

    const membership =
      user.memberships.find((m) => m.tenantId === user.homeTenantId) ?? user.memberships[0];

    return {
      userId: user.id,
      tenantId: membership?.tenantId ?? '',
      role: membership?.role ?? 'PLATFORM_ADMIN',
      emisorRut: membership?.tenant.rut ?? undefined,
      isPlatformAdmin: user.isPlatformAdmin,
    };
  }

  /** Verifica el token y resuelve el contexto de la app en un solo paso. */
  async authenticate(token: string): Promise<ResolvedAuth> {
    const sup = await this.verifySupabaseToken(token);
    return this.resolveContext(sup);
  }

  /**
   * Login server-side contra Supabase (password grant). Devuelve los tokens si
   * las credenciales son válidas, o null si no. Permite contar los fallos en el
   * backend (para el bloqueo por intentos) sin depender del cliente.
   */
  async passwordGrant(
    email: string,
    password: string,
  ): Promise<{ access_token: string; refresh_token: string; expires_in?: number; expires_at?: number; token_type?: string } | null> {
    const { url, anonKey } = this.config.get('supabase', { infer: true });
    if (!url || !anonKey) throw new UnauthorizedException('Supabase no configurado en el backend');
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { access_token: string; refresh_token: string };
  }

  /** Fija una contraseña nueva en Supabase (Admin API). Para reset del admin. */
  async setSupabasePassword(authUserId: string | null | undefined, password: string): Promise<boolean> {
    const { url, serviceRoleKey } = this.config.get('supabase', { infer: true });
    if (!url || !serviceRoleKey || !authUserId) return false;
    const res = await fetch(`${url}/auth/v1/admin/users/${authUserId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) this.logger.warn(`No se pudo fijar la contraseña en Supabase (${res.status})`);
    return res.ok;
  }

  /** ¿Está configurada la Admin API (service-role) para crear usuarios? */
  canProvisionUsers(): boolean {
    const s = this.config.get('supabase', { infer: true });
    return Boolean(s.url && s.serviceRoleKey);
  }

  /**
   * Crea (o encuentra) un usuario en Supabase Auth con email confirmado, usando
   * la Admin API (service-role, solo backend). Devuelve el auth user id, o null
   * si la Admin API no está configurada. Idempotente ante "ya existe".
   */
  async provisionSupabaseUser(email: string, password: string): Promise<string | null> {
    const { url, serviceRoleKey } = this.config.get('supabase', { infer: true });
    if (!url || !serviceRoleKey) return null;

    const headers = {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    };

    const res = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password, email_confirm: true }),
    });

    if (res.ok) {
      const body = (await res.json()) as { id: string };
      return body.id;
    }

    // Ya existe: lo buscamos para devolver su id (el enlace por email igual sirve).
    if (res.status === 422 || res.status === 409) {
      const list = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers });
      if (list.ok) {
        const data = (await list.json()) as { users?: Array<{ id: string; email?: string }> };
        return data.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
      }
      return null;
    }

    const detail = await res.text().catch(() => '');
    this.logger.warn(`No se pudo crear el usuario en Supabase (${res.status}): ${detail}`);
    throw new Error(`Supabase admin ${res.status}`);
  }
}
