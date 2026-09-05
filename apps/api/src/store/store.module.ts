import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';
import { RolesGuard } from '../tenant/roles.guard';
import { SalesModule } from '../sales/sales.module';
import { CfeModule } from '../cfe/cfe.module';
import {
  PublicCustomerController,
  PublicStoreController,
  StoreAdminController,
  TelegramWebhookController,
} from './store.controller';
import { RepartidorController, RepartoAdminController } from './reparto.controller';
import { StoreService } from './store.service';
import { TelegramService } from './telegram.service';
import { CustomerService } from './customer.service';
import { RepartoService } from './reparto.service';

@Module({
  imports: [
    SalesModule,
    CfeModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('customerJwtSecret', { infer: true }),
        signOptions: { expiresIn: '60d' },
      }),
    }),
  ],
  controllers: [
    PublicStoreController,
    PublicCustomerController,
    StoreAdminController,
    TelegramWebhookController,
    RepartidorController,
    RepartoAdminController,
  ],
  providers: [StoreService, TelegramService, CustomerService, RepartoService, RolesGuard],
})
export class StoreModule {}
