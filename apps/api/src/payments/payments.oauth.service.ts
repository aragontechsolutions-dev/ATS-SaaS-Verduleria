import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { cifrar } from './crypto';
import { mpAuthorizeUrl, mpGetUsuario, mpOAuthExchange } from './mercadopago.client';

@Injectable()
export class PaymentsOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private oauthCfg() {
    return this.config.get('payments', { infer: true }).mpOAuth;
  }

  private redirectUri(): string {
    const o = this.oauthCfg();
    if (o.redirectUri) return o.redirectUri;
    const api = this.config.get('apiPublicUrl', { infer: true });
    return api ? `${api}/api/public/pagos/mp/oauth/callback` : '';
  }

  /** ¿Está lista la app OAuth de la plataforma? (client id/secret + redirect) */
  disponible(): boolean {
    const o = this.oauthCfg();
    return !!(o.clientId && o.clientSecret && this.redirectUri());
  }

  /**
   * Genera el enlace de vinculación para un tenant. Se le pasa al comercio para
   * que autorice con su cuenta de Mercado Pago (1 clic). Guarda un `state` para
   * validar el callback y mapearlo de vuelta al tenant.
   */
  async crearEnlace(tenantId: string): Promise<{ url: string }> {
    const encKey = this.config.get('payments', { infer: true }).encKey;
    if (!encKey) throw new BadRequestException('Falta configurar PAYMENTS_ENC_KEY en el servidor.');
    if (!this.disponible()) {
      throw new BadRequestException('La app de Mercado Pago no está configurada en el servidor (MP_OAUTH_CLIENT_ID/SECRET).');
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Cliente no encontrado');

    const state = randomBytes(24).toString('hex');
    const webhookSecret = randomBytes(24).toString('hex');
    await this.prisma.tenantPaymentConfig.upsert({
      where: { tenantId },
      create: { tenantId, provider: 'MERCADO_PAGO', conexion: 'OAUTH', oauthState: state, webhookSecret },
      update: { oauthState: state },
    });

    return { url: mpAuthorizeUrl(this.oauthCfg().clientId, this.redirectUri(), state) };
  }

  /**
   * Callback de MP tras autorizar: intercambia el code por los tokens del
   * vendedor y los guarda cifrados. Devuelve el nombre del comercio para la
   * página de "conectado".
   */
  async callback(code: string, state: string): Promise<{ nombre: string }> {
    if (!code || !state) throw new BadRequestException('Vinculación inválida.');
    const cfg = await this.prisma.tenantPaymentConfig.findFirst({ where: { oauthState: state } });
    if (!cfg) throw new BadRequestException('La vinculación expiró o no es válida. Generá un enlace nuevo.');

    const encKey = this.config.get('payments', { infer: true }).encKey;
    const o = this.oauthCfg();
    const tokens = await mpOAuthExchange({
      clientId: o.clientId,
      clientSecret: o.clientSecret,
      code,
      redirectUri: this.redirectUri(),
    });

    // Trae el nickname de la cuenta para mostrarlo (best-effort).
    let nickname: string | null = null;
    try {
      nickname = (await mpGetUsuario(tokens.access_token)).nickname ?? null;
    } catch {
      nickname = null;
    }

    await this.prisma.tenantPaymentConfig.update({
      where: { tenantId: cfg.tenantId },
      data: {
        conexion: 'OAUTH',
        ambiente: tokens.live_mode ? 'produccion' : 'test',
        accessTokenEnc: cifrar(tokens.access_token, encKey),
        refreshTokenEnc: cifrar(tokens.refresh_token, encKey),
        tokenExpiraAt: new Date(Date.now() + tokens.expires_in * 1000),
        publicKey: tokens.public_key ?? null,
        mpUserId: String(tokens.user_id),
        mpNickname: nickname,
        oauthState: null,
      },
    });

    const tenant = await this.prisma.tenant.findUnique({ where: { id: cfg.tenantId }, select: { nombre: true } });
    return { nombre: tenant?.nombre ?? 'tu comercio' };
  }
}
