import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { cifrar, descifrar, enmascarar } from './crypto';
import { ambienteDeToken, mpGetUsuario } from './mercadopago.client';
import type { ActivarCobroDto, ConectarMpDto } from './payments.config.dto';

/** Vista de la config de pagos para el panel (SIN el token, solo una pista). */
export interface PagosConfigView {
  proveedor: 'MERCADO_PAGO';
  conectado: boolean;
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

  /** Desconecta: borra credenciales y apaga el cobro online. */
  async desconectar(tenantId: string): Promise<PagosConfigView> {
    await this.prisma.tenantPaymentConfig.updateMany({
      where: { tenantId },
      data: { accessTokenEnc: null, publicKey: null, mpUserId: null, mpNickname: null, cobroOnlineActivo: false },
    });
    return this.ver(tenantId);
  }
}
