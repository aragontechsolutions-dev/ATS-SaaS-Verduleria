import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { IvaModule } from '../iva/iva.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [IvaModule],
  controllers: [ProductsController],
  providers: [ProductsService, RolesGuard],
})
export class ProductsModule {}
