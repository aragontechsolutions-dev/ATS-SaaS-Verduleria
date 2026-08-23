import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';
import { BillingService } from './billing.service';

/** Facturación del SaaS (cobro del abono a los clientes). Solo super-admin. */
@Controller('platform/billing')
@UseGuards(PlatformAdminGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('summary')
  summary() {
    return this.billing.summary();
  }

  @Get('invoices')
  list(@Query('estado') estado?: string) {
    return this.billing.list(estado);
  }

  @Post('generate')
  generate(@Body('periodo') periodo: string) {
    return this.billing.generatePeriod(periodo);
  }

  @Post('invoices/:id/pay')
  pay(@Param('id') id: string) {
    return this.billing.markPaid(id);
  }

  @Post('process-overdue')
  processOverdue() {
    return this.billing.processOverdue();
  }
}
