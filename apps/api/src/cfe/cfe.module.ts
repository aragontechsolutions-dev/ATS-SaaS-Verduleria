import { Module } from '@nestjs/common';
import { CfeController } from './cfe.controller';
import { CfeService } from './cfe.service';
import { CfePollingService } from './cfe.polling.service';
import { cfeProviderFactory } from './cfe.provider.factory';

@Module({
  controllers: [CfeController],
  providers: [cfeProviderFactory, CfeService, CfePollingService],
  exports: [CfeService],
})
export class CfeModule {}
