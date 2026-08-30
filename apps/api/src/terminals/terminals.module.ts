import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { TerminalsController } from './terminals.controller';
import { TerminalsService } from './terminals.service';

@Module({
  controllers: [TerminalsController],
  providers: [TerminalsService, RolesGuard],
  exports: [TerminalsService],
})
export class TerminalsModule {}
