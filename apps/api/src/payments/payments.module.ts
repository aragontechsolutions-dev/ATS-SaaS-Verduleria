import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { paymentProviderFactory } from './payments.provider';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, paymentProviderFactory, RolesGuard],
  exports: [PaymentsService],
})
export class PaymentsModule {}
