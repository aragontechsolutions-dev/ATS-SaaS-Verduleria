import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { PaymentsController } from './payments.controller';
import { PaymentsConfigController } from './payments.config.controller';
import { PaymentsService } from './payments.service';
import { PaymentsConfigService } from './payments.config.service';
import { paymentProviderFactory } from './payments.provider';

@Module({
  controllers: [PaymentsController, PaymentsConfigController],
  providers: [PaymentsService, PaymentsConfigService, paymentProviderFactory, RolesGuard],
  exports: [PaymentsService, PaymentsConfigService],
})
export class PaymentsModule {}
