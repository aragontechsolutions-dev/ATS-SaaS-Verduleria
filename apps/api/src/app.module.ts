import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { TenantMiddleware } from './tenant/tenant.middleware';
import { AuthModule } from './auth/auth.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { CfeModule } from './cfe/cfe.module';
import { CatalogModule } from './catalog/catalog.module';
import { SalesModule } from './sales/sales.module';
import { CashModule } from './cash/cash.module';
import { PlatformModule } from './platform/platform.module';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    EntitlementsModule,
    CfeModule,
    CatalogModule,
    SalesModule,
    CashModule,
    PlatformModule,
    ProductsModule,
    UsersModule,
    ReportsModule,
    SettingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Resuelve el tenant en TODAS las rutas (lo mete en el AsyncLocalStorage).
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
