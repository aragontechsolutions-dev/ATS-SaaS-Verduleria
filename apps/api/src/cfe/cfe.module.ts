import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { CfeController } from './cfe.controller';
import { CfeService } from './cfe.service';
import { CfePollingService } from './cfe.polling.service';
import { cfeProviderFactory } from './cfe.provider.factory';

@Module({
  controllers: [CfeController],
  providers: [cfeProviderFactory, CfeService, CfePollingService, RolesGuard],
  exports: [CfeService],
})
export class CfeModule {}
