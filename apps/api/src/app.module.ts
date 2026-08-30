import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { TenantMiddleware } from './tenant/tenant.middleware';
import { AuthModule } from './auth/auth.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { CfeModule } from './cfe/cfe.module';
import { CatalogModule } from './catalog/catalog.module';
import { CustomersModule } from './customers/customers.module';
import { LandingModule } from './landing/landing.module';
import { SalesModule } from './sales/sales.module';
import { CashModule } from './cash/cash.module';
import { PlatformModule } from './platform/platform.module';
import { IvaModule } from './iva/iva.module';
import { ProductsModule } from './products/products.module';
import { PurchasesModule } from './purchases/purchases.module';
import { SucursalesModule } from './sucursales/sucursales.module';
import { UsersModule } from './users/users.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { AuditModule } from './audit/audit.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    // Rate limiting global: 120 req/min por IP (generoso para el sync del POS).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    EntitlementsModule,
    CfeModule,
    CatalogModule,
    CustomersModule,
    LandingModule,
    SalesModule,
    CashModule,
    PlatformModule,
    IvaModule,
    ProductsModule,
    PurchasesModule,
    SucursalesModule,
    UsersModule,
    ReportsModule,
    SettingsModule,
    AuditModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Resuelve el tenant en TODAS las rutas (lo mete en el AsyncLocalStorage).
    // Express 5 / path-to-regexp v8: el comodín ahora es un parámetro nombrado.
    consumer.apply(TenantMiddleware).forRoutes('{*path}');
  }
}
