import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { SalesModule } from '../sales/sales.module';
import { CfeModule } from '../cfe/cfe.module';
import { PublicStoreController, StoreAdminController, TelegramWebhookController } from './store.controller';
import { StoreService } from './store.service';
import { TelegramService } from './telegram.service';

@Module({
  imports: [SalesModule, CfeModule],
  controllers: [PublicStoreController, StoreAdminController, TelegramWebhookController],
  providers: [StoreService, TelegramService, RolesGuard],
})
export class StoreModule {}
