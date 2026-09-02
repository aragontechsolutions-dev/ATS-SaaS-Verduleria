import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { PublicStoreController, StoreAdminController } from './store.controller';
import { StoreService } from './store.service';

@Module({
  controllers: [PublicStoreController, StoreAdminController],
  providers: [StoreService, RolesGuard],
})
export class StoreModule {}
