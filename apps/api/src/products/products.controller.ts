import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequiresModule } from '../entitlements/requires-module.decorator';
import { ProductsService } from './products.service';
import {
  BulkPriceDto,
  CreateCategoriaDto,
  CreateProductDto,
  UpdateCategoriaDto,
  UpdateProductDto,
} from './products.dto';

@Controller('products')
@UseGuards(TenantGuard, EntitlementsGuard, RolesGuard)
@RequiresModule('POS')
@Roles(Role.ADMIN, Role.ENCARGADO)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@CurrentTenant('tenantId') tenantId: string) {
    return this.products.list(tenantId);
  }

  @Post()
  create(@CurrentTenant('tenantId') tenantId: string, @Body() dto: CreateProductDto) {
    return this.products.create(tenantId, dto);
  }

  @Patch(':id')
  update(
    @CurrentTenant('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(tenantId, id, dto);
  }

  /** Actualización masiva de precios (por % o fijo, opcional por categoría). */
  @Post('prices/bulk')
  bulkPrices(@CurrentTenant('tenantId') tenantId: string, @Body() dto: BulkPriceDto) {
    return this.products.bulkUpdatePrices(tenantId, dto);
  }

  @Get('categorias/all')
  listCategorias(@CurrentTenant('tenantId') tenantId: string) {
    return this.products.listCategorias(tenantId);
  }

  @Post('categorias')
  createCategoria(@CurrentTenant('tenantId') tenantId: string, @Body() dto: CreateCategoriaDto) {
    return this.products.createCategoria(tenantId, dto);
  }

  @Patch('categorias/:id')
  updateCategoria(
    @CurrentTenant('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoriaDto,
  ) {
    return this.products.updateCategoria(tenantId, id, dto);
  }
}
