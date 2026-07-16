import { Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequiresModule } from '../entitlements/requires-module.decorator';
import { CfeService } from './cfe.service';

@Controller('cfe')
@UseGuards(TenantGuard, EntitlementsGuard)
@RequiresModule('CFE') // todo el módulo CFE requiere el entitlement CFE en el plan
export class CfeController {
  constructor(private readonly cfeService: CfeService) {}

  /** Emite el CFE de una venta (idempotente por venta). */
  @Post('ventas/:saleId/emitir')
  async emitir(@CurrentTenant('tenantId') tenantId: string, @Param('saleId') saleId: string) {
    return this.cfeService.emitirParaVenta(tenantId, saleId);
  }

  /** Descarga el PDF del comprobante (?tipo=ticket80 para térmica 80mm). */
  @Get(':cfeDocId/pdf')
  async pdf(
    @CurrentTenant('tenantId') tenantId: string,
    @Param('cfeDocId') cfeDocId: string,
    @Query('tipo') tipo: 'A4' | 'ticket80' = 'A4',
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.cfeService.obtenerPdf(tenantId, cfeDocId, tipo);
    res.setHeader('Content-Type', pdf.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${pdf.fileName}"`);
    res.send(pdf.buffer);
  }
}
