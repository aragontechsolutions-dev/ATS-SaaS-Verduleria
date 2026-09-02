import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { SalesModule } from '../sales/sales.module';
import { CfeModule } from '../cfe/cfe.module';
import { PublicStoreController, StoreAdminController } from './store.controller';
import { StoreService } from './store.service';

@Module({
  imports: [SalesModule, CfeModule],
  controllers: [PublicStoreController, StoreAdminController],
  providers: [StoreService, RolesGuard],
})
export class StoreModule {}
