import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';

@Module({
  controllers: [PurchasesController],
  providers: [PurchasesService, RolesGuard],
})
export class PurchasesModule {}
