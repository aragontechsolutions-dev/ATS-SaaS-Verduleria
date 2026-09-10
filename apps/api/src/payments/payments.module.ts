import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { PaymentsController } from './payments.controller';
import { PaymentsConfigController } from './payments.config.controller';
import { PaymentsPublicController } from './payments.public.controller';
import { PaymentsPointController } from './payments.point.controller';
import { PaymentsService } from './payments.service';
import { PaymentsConfigService } from './payments.config.service';
import { PaymentsGatewayService } from './payments.gateway.service';
import { PaymentsOAuthService } from './payments.oauth.service';
import { PaymentsPointService } from './payments.point.service';
import { paymentProviderFactory } from './payments.provider';

@Module({
  controllers: [PaymentsController, PaymentsConfigController, PaymentsPublicController, PaymentsPointController],
  providers: [PaymentsService, PaymentsConfigService, PaymentsGatewayService, PaymentsOAuthService, PaymentsPointService, paymentProviderFactory, RolesGuard],
  exports: [PaymentsService, PaymentsConfigService, PaymentsOAuthService, PaymentsPointService],
})
export class PaymentsModule {}
