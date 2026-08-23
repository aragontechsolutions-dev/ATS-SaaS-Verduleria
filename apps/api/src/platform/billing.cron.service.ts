import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { AppConfig } from '../config/configuration';
import { BillingService } from './billing.service';

/**
 * Automatiza la facturación del SaaS:
 *  - el día 1 de cada mes genera las facturas del período (si autoGenerate);
 *  - todos los días marca las vencidas y, si autoSuspend, corta a los morosos.
 *
 * Defaults seguros: autoGenerate ON (solo crea facturas), autoSuspend OFF
 * (cortar servicio sin humano es sensible → el owner lo hace desde la consola,
 * salvo que active BILLING_AUTO_SUSPEND=true).
 */
@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name);

  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private get flags() {
    return this.config.get('billing', { infer: true });
  }

  /** Genera las facturas del mes en curso (1° de cada mes, 03:00 UTC). */
  @Cron('0 3 1 * *')
  async generarMensual(): Promise<void> {
    if (!this.flags.autoGenerate) return;
    const periodo = new Date().toISOString().slice(0, 7); // YYYY-MM
    try {
      const r = await this.billing.generatePeriod(periodo);
      this.logger.log(`Facturación ${periodo}: ${r.creadas} nuevas (de ${r.suscripciones} suscripciones)`);
    } catch (err) {
      this.logger.error(`Error generando facturas ${periodo}: ${String(err)}`);
    }
  }

  /** Marca vencidas (y suspende si autoSuspend) todos los días a las 04:00 UTC. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async procesarVencidos(): Promise<void> {
    try {
      const r = await this.billing.processOverdue(this.flags.autoSuspend);
      if (r.vencidas > 0) {
        this.logger.log(`Vencidos: ${r.vencidas} facturas · ${r.suspendidos} suspendidos (autoSuspend=${this.flags.autoSuspend})`);
      }
    } catch (err) {
      this.logger.error(`Error procesando vencidos: ${String(err)}`);
    }
  }
}
