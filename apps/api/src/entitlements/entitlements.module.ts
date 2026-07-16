import { Global, Module } from '@nestjs/common';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';
import { EntitlementsGuard } from './entitlements.guard';

/**
 * Global para que EntitlementsService y EntitlementsGuard estén disponibles en
 * cualquier módulo que quiera proteger endpoints con @RequiresModule.
 */
@Global()
@Module({
  controllers: [EntitlementsController],
  providers: [EntitlementsService, EntitlementsGuard],
  exports: [EntitlementsService, EntitlementsGuard],
})
export class EntitlementsModule {}
