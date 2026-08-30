import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { TerminalsModule } from '../terminals/terminals.module';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';

@Module({
  imports: [TerminalsModule],
  controllers: [CashController],
  providers: [CashService, RolesGuard],
  exports: [CashService],
})
export class CashModule {}
