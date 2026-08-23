import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  controllers: [PlatformController, BillingController],
  providers: [PlatformService, BillingService],
})
export class PlatformModule {}
