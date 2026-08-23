import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingCronService } from './billing.cron.service';

@Module({
  controllers: [PlatformController, BillingController],
  providers: [PlatformService, BillingService, BillingCronService],
})
export class PlatformModule {}
