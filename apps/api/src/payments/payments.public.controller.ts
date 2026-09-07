import { Body, Controller, Param, Post, Query } from '@nestjs/common';
import { PaymentsGatewayService } from './payments.gateway.service';

/**
 * Endpoints públicos de cobro online (SIN autenticación de panel):
 * - el cliente de la tienda inicia el pago de su pedido;
 * - Mercado Pago notifica el resultado por webhook (valida un secreto en la ruta).
 */
@Controller('public')
export class PaymentsPublicController {
  constructor(private readonly gateway: PaymentsGatewayService) {}

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
