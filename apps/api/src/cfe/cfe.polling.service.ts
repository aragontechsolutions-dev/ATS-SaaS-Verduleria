import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import type { AppConfig } from '../config/configuration';
import { CfeService } from './cfe.service';

/**
 * Worker de polling del estado DGI (NE → AE/BE/CE).
 * FEU no tiene webhook todavía (en desarrollo por Surtec), así que reconsultamos
 * periódicamente. Cuando exista el webhook, se reemplaza este worker sin tocar
 * el resto del sistema.
 *
 * ⚠️ El intervalo mínimo lo mide DGI; confirmar con Surtec (CONTEXTOFEU.md §11).
 * Por defecto 60s (CFE_POLLING_INTERVAL_MS).
 */
@Injectable()
export class CfePollingService implements OnModuleInit {
  private readonly logger = new Logger(CfePollingService.name);
  private corriendo = false;

  constructor(
    private readonly cfeService: CfeService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.config.get('cfePollingIntervalMs', { infer: true });
    const timer = setInterval(() => void this.tick(), intervalMs);
    this.scheduler.addInterval('cfe-polling', timer);
    this.logger.log(`Polling de estado DGI cada ${intervalMs}ms`);
  }

  async tick(): Promise<void> {
    if (this.corriendo) return; // evita solapamiento
    this.corriendo = true;
    try {
      const pendientes = await this.cfeService.pendientesDePolling();
      if (pendientes.length === 0) return;
      this.logger.debug(`Reconsultando ${pendientes.length} CFE pendientes`);
      for (const doc of pendientes) {
        await this.cfeService.refrescarEstado(doc);
      }
    } catch (err) {
      this.logger.error(`Error en tick de polling: ${String(err)}`);
    } finally {
      this.corriendo = false;
    }
  }
}
