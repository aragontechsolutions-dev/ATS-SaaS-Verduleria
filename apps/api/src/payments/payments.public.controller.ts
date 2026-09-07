import { Body, Controller, Get, Header, Param, Post, Query } from '@nestjs/common';
import { PaymentsGatewayService } from './payments.gateway.service';
import { PaymentsOAuthService } from './payments.oauth.service';

/** Página HTML mínima para el cierre del flujo OAuth (la ve el comercio). */
function paginaResultado(ok: boolean, mensaje: string): string {
  const color = ok ? '#128C7E' : '#c62828';
  const icono = ok ? '✅' : '⚠️';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mercado Pago</title></head>
<body style="font-family:system-ui,sans-serif;background:#f4f4f4;margin:0;display:grid;place-items:center;height:100vh">
<div style="background:#fff;border-radius:16px;padding:36px 30px;max-width:420px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.12)">
<div style="font-size:48px">${icono}</div>
<h1 style="color:${color};font-size:22px;margin:12px 0 8px">${ok ? '¡Cuenta conectada!' : 'No se pudo conectar'}</h1>
<p style="color:#555;line-height:1.5">${mensaje}</p>
<p style="color:#999;font-size:13px;margin-top:20px">Ya podés cerrar esta ventana.</p>
</div></body></html>`;
}

/**
 * Endpoints públicos de cobro online (SIN autenticación de panel):
 * - el cliente de la tienda inicia el pago de su pedido;
 * - Mercado Pago notifica el resultado por webhook (valida un secreto en la ruta);
 * - callback del flujo OAuth de vinculación de cuenta.
 */
@Controller('public')
export class PaymentsPublicController {
  constructor(
    private readonly gateway: PaymentsGatewayService,
    private readonly oauth: PaymentsOAuthService,
  ) {}

  /** Callback de "Conectar con Mercado Pago": cierra la vinculación OAuth. */
  @Get('pagos/mp/oauth/callback')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async oauthCallback(@Query('code') code?: string, @Query('state') state?: string): Promise<string> {
    try {
      const { nombre } = await this.oauth.callback(code ?? '', state ?? '');
      return paginaResultado(true, `La cuenta de Mercado Pago de <strong>${nombre}</strong> quedó vinculada. El cobro online se activa desde el panel de Aragon Tech Solutions.`);
    } catch (e) {
      return paginaResultado(false, e instanceof Error ? e.message : 'Volvé a generar el enlace de conexión e intentá de nuevo.');
    }
  }

  /** Inicia el pago de un pedido y devuelve la URL de Checkout Pro. */
  @Post('tienda/:slug/pedido/:codigo/pagar')
  pagar(@Param('slug') slug: string, @Param('codigo') codigo: string) {
    return this.gateway.iniciarCheckout(slug, codigo);
  }

  /** Webhook de Mercado Pago. Responde 200 siempre (MP reintenta si no). */
  @Post('pagos/mp/:secret')
  webhook(
    @Param('secret') secret: string,
    @Body() body: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
  ) {
    return this.gateway.webhook(secret, body, query);
  }
}
