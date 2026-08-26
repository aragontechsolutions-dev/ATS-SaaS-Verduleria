import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';

@Module({
  controllers: [CashController],
  providers: [CashService, RolesGuard],
  exports: [CashService],
})
export class CashModule {}
