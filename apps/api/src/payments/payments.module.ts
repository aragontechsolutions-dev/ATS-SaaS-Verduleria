import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { PaymentsController } from './payments.controller';
import { PaymentsConfigController } from './payments.config.controller';
import { PaymentsPublicController } from './payments.public.controller';
import { PaymentsService } from './payments.service';
import { PaymentsConfigService } from './payments.config.service';
import { PaymentsGatewayService } from './payments.gateway.service';
import { paymentProviderFactory } from './payments.provider';

@Module({
  controllers: [PaymentsController, PaymentsConfigController, PaymentsPublicController],
  providers: [PaymentsService, PaymentsConfigService, PaymentsGatewayService, paymentProviderFactory, RolesGuard],
  exports: [PaymentsService, PaymentsConfigService],
})
export class PaymentsModule {}
