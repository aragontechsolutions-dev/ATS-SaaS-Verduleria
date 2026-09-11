import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlansPublicController } from './plans-public.controller';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingCronService } from './billing.cron.service';
import { PaymentsModule } from '../payments/payments.module';
import { DemoModule } from '../demo/demo.module';

@Module({
  imports: [PaymentsModule, DemoModule],
  controllers: [PlatformController, PlansPublicController, BillingController],
  providers: [PlatformService, BillingService, BillingCronService],
})
export class PlatformModule {}
