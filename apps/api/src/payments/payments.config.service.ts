import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { cifrar, descifrar, enmascarar } from './crypto';
import { ambienteDeToken, mpGetUsuario, mpOAuthRefresh } from './mercadopago.client';
import type { ActivarCobroDto, ConectarMpDto } from './payments.config.dto';

/** Margen para refrescar el token OAuth antes de que venza (5 min). */
const MARGEN_REFRESH_MS = 5 * 60 * 1000;

/** Vista de la config de pagos para el panel (SIN el token, solo una pista). */
export interface PagosConfigView {
  proveedor: 'MERCADO_PAGO';
  conectado: boolean;
  conexion: 'MANUAL' | 'OAUTH';
  ambiente: 'test' | 'produccion';
  cuenta: string | null; // nickname o id de la cuenta MP conectada
  tokenPista: string | null; // últimos 4 dígitos enmascarados
  cobroOnlineActivo: boolean;
  encKeyDisponible: boolean; // si el server tiene PAYMENTS_ENC_KEY configurada
}

@Injectable()
export class PaymentsConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private encKey(): string {
    return this.config.get('payments', { infer: true }).encKey;
  }

  async ver(tenantId: string): Promise<PagosConfigView> {
    const cfg = await this.prisma.tenantPaymentConfig.findUnique({ where: { tenantId } });
    const encKeyDisponible = !!this.encKey();
    if (!cfg) {
      return {
        proveedor: 'MERCADO_PAGO',
        conectado: false,
        conexion: 'MANUAL',
        ambiente: 'test',
        cuenta: null,
        tokenPista: null,
        cobroOnlineActivo: false,
        encKeyDisponible,
      };
    }
    let tokenPista: string | null = null;
    if (cfg.accessTokenEnc && encKeyDisponible) {
      try {
        tokenPista = enmascarar(descifrar(cfg.accessTokenEnc, this.encKey()));
      } catch {
        tokenPista = null; // clave rotada o dato corrupto: se pedirá reconectar
      }
    }
    return {
      proveedor: 'MERCADO_PAGO',
      conectado: !!cfg.accessTokenEnc,
      conexion: cfg.conexion === 'OAUTH' ? 'OAUTH' : 'MANUAL',
      ambiente: cfg.ambiente === 'produccion' ? 'produccion' : 'test',
      cuenta: cfg.mpNickname ?? cfg.mpUserId ?? null,
      tokenPista,
      cobroOnlineActivo: cfg.cobroOnlineActivo,
      encKeyDisponible,
    };
  }

  /** Valida el token contra MP y lo guarda cifrado. NO activa el cobro (gate aparte). */
  async conectar(tenantId: string, dto: ConectarMpDto): Promise<PagosConfigView> {
    const encKey = this.encKey();
    if (!encKey) {
      throw new BadRequestException('El servidor no tiene configurada la clave de cifrado de pagos (PAYMENTS_ENC_KEY).');
    }
    const accessToken = dto.accessToken.trim();
    const usuario = await mpGetUsuario(accessToken); // lanza 400 si es inválido
    const ambiente = ambienteDeToken(accessToken);

    const existente = await this.prisma.tenantPaymentConfig.findUnique({
      where: { tenantId },
      select: { webhookSecret: true },
    });
    const webhookSecret = existente?.webhookSecret ?? randomBytes(24).toString('hex');

    await this.prisma.tenantPaymentConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        provider: 'MERCADO_PAGO',
        ambiente,
        accessTokenEnc: cifrar(accessToken, encKey),
        publicKey: dto.publicKey?.trim() || null,
        mpUserId: String(usuario.id),
        mpNickname: usuario.nickname ?? null,
        webhookSecret,
      },
      update: {
        provider: 'MERCADO_PAGO',
        ambiente,
        accessTokenEnc: cifrar(accessToken, encKey),
        publicKey: dto.publicKey?.trim() || null,
        mpUserId: String(usuario.id),
        mpNickname: usuario.nickname ?? null,
      },
    });

    return this.ver(tenantId);
  }

  /** Prueba la conexión: descifra el token guardado y consulta la cuenta en MP. */
  async probar(tenantId: string): Promise<{ ok: true; cuenta: string; ambiente: 'test' | 'produccion' }> {
    const cfg = await this.prisma.tenantPaymentConfig.findUnique({ where: { tenantId } });
    if (!cfg?.accessTokenEnc) throw new BadRequestException('Todavía no conectaste Mercado Pago.');
    const token = descifrar(cfg.accessTokenEnc, this.encKey());
    const usuario = await mpGetUsuario(token);
    return {
      ok: true,
      cuenta: usuario.nickname ?? String(usuario.id),
      ambiente: ambienteDeToken(token),
    };
  }

  /** Activa/desactiva el gate de cobro online (requiere estar conectado). */
  async activar(tenantId: string, dto: ActivarCobroDto): Promise<PagosConfigView> {
    const cfg = await this.prisma.tenantPaymentConfig.findUnique({ where: { tenantId } });
    if (dto.activo && !cfg?.accessTokenEnc) {
      throw new BadRequestException('Conectá Mercado Pago antes de activar el cobro online.');
    }
    await this.prisma.tenantPaymentConfig.update({
      where: { tenantId },
      data: { cobroOnlineActivo: dto.activo },
    });
    return this.ver(tenantId);
  }

  /**
   * Credenciales listas para cobrar de un tenant: solo si está conectado Y el
   * gate cobroOnlineActivo está encendido. Null en cualquier otro caso.
   * Uso interno (gateway de checkout), NO se expone al frontend.
   */
  async credencialesActivas(
    tenantId: string,
  ): Promise<{ accessToken: string; ambiente: 'test' | 'produccion'; webhookSecret: string } | null> {
    const cfg = await this.prisma.tenantPaymentConfig.findUnique({ where: { tenantId } });
    if (!cfg?.accessTokenEnc || !cfg.cobroOnlineActivo || !cfg.webhookSecret) return null;
    return {
      accessToken: await this.accessTokenVigente(cfg),
      ambiente: cfg.ambiente === 'produccion' ? 'produccion' : 'test',
      webhookSecret: cfg.webhookSecret,
    };
  }

  /**
   * Devuelve el access token descifrado y VIGENTE. Para conexiones OAUTH, si el
   * token está por vencer y hay refresh token, lo renueva contra MP y persiste
   * los nuevos tokens antes de devolverlo.
   */
  private async accessTokenVigente(cfg: {
    tenantId: string;
    conexion: string;
    accessTokenEnc: string | null;
    refreshTokenEnc: string | null;
    tokenExpiraAt: Date | null;
  }): Promise<string> {
    const encKey = this.encKey();
    const actual = descifrar(cfg.accessTokenEnc as string, encKey);
    const porVencer = cfg.tokenExpiraAt ? cfg.tokenExpiraAt.getTime() - Date.now() < MARGEN_REFRESH_MS : false;
    if (cfg.conexion !== 'OAUTH' || !cfg.refreshTokenEnc || !porVencer) return actual;

    const oauth = this.config.get('payments', { infer: true }).mpOAuth;
    const tokens = await mpOAuthRefresh({
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret,
      refreshToken: descifrar(cfg.refreshTokenEnc, encKey),
    });
    await this.prisma.tenantPaymentConfig.update({
      where: { tenantId: cfg.tenantId },
      data: {
        accessTokenEnc: cifrar(tokens.access_token, encKey),
        refreshTokenEnc: cifrar(tokens.refresh_token, encKey),
        tokenExpiraAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });
    return tokens.access_token;
  }

  /** Resuelve el token de MP a partir del secreto del webhook (ruta pública). */
  async porWebhookSecret(secret: string): Promise<{ tenantId: string; accessToken: string } | null> {
    if (!secret) return null;
    const cfg = await this.prisma.tenantPaymentConfig.findFirst({ where: { webhookSecret: secret } });
    if (!cfg?.accessTokenEnc) return null;
    try {
      return { tenantId: cfg.tenantId, accessToken: await this.accessTokenVigente(cfg) };
    } catch {
      return null;
    }
  }

  /**
   * Access token vigente del tenant, exista o no el gate de cobro activo (para
   * operaciones como reembolsos que deben funcionar aunque se haya apagado el
   * cobro). Null si no está conectado.
   */
  async accessTokenDe(tenantId: string): Promise<string | null> {
    const cfg = await this.prisma.tenantPaymentConfig.findUnique({ where: { tenantId } });
    if (!cfg?.accessTokenEnc) return null;
    try {
      return await this.accessTokenVigente(cfg);
    } catch {
      return null;
    }
  }

  /** ¿El tenant ofrece cobro online ahora mismo? (para el catálogo público) */
  async cobroOnlineDisponible(tenantId: string): Promise<boolean> {
    const cfg = await this.prisma.tenantPaymentConfig.findUnique({
      where: { tenantId },
      select: { accessTokenEnc: true, cobroOnlineActivo: true, webhookSecret: true },
    });
    return !!(cfg?.accessTokenEnc && cfg.cobroOnlineActivo && cfg.webhookSecret);
  }

  /** Desconecta: borra credenciales y apaga el cobro online. */
  async desconectar(tenantId: string): Promise<PagosConfigView> {
    await this.prisma.tenantPaymentConfig.updateMany({
      where: { tenantId },
      data: { accessTokenEnc: null, publicKey: null, mpUserId: null, mpNickname: null, cobroOnlineActivo: false },
    });
    return this.ver(tenantId);
  }
}
