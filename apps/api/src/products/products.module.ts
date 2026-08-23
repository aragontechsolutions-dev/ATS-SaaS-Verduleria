import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, RolesGuard],
})
export class ProductsModule {}
