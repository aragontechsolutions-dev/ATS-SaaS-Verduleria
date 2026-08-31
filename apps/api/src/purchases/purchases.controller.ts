import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequiresModule } from '../entitlements/requires-module.decorator';
import { PurchasesService } from './purchases.service';
import {
  CreatePurchaseDto,
  CreateSupplierDto,
  CreateVencimientoDto,
  CreateWasteDto,
  ListQueryDto,
  ResolveVencimientoDto,
  StockAdjustDto,
  StockQueryDto,
  UpdateSupplierDto,
} from './purchases.dto';

/**
 * Compras (UAM) + stock + merma. Las compras exigen el módulo PURCHASES; ver
 * stock y registrar merma/ajustes va con INVENTORY (incluido en el plan base).
 */
@Controller('purchases')
@UseGuards(TenantGuard, EntitlementsGuard, RolesGuard)
@RequiresModule('PURCHASES')
@Roles(Role.ADMIN, Role.ENCARGADO, Role.COMPRADOR)
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  // --- Proveedores ---
  @Get('suppliers')
  listSuppliers(@CurrentTenant('tenantId') tenantId: string) {
    return this.purchases.listSuppliers(tenantId);
  }

  @Post('suppliers')
  createSupplier(@CurrentTenant('tenantId') tenantId: string, @Body() dto: CreateSupplierDto) {
    return this.purchases.createSupplier(tenantId, dto);
  }

  @Patch('suppliers/:id')
  updateSupplier(
    @CurrentTenant('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.purchases.updateSupplier(tenantId, id, dto);
  }

  // --- Compras ---
  @Get()
  listPurchases(@CurrentTenant('tenantId') tenantId: string, @Query() q: ListQueryDto) {
    return this.purchases.listPurchases(tenantId, q.limit);
  }

  @Post()
  createPurchase(@CurrentTenant('tenantId') tenantId: string, @Body() dto: CreatePurchaseDto) {
    return this.purchases.createPurchase(tenantId, dto);
  }

  @Get('detalle/:id')
  getPurchase(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.purchases.getPurchase(tenantId, id);
  }

  // --- Stock (INVENTORY) ---
  @Get('stock')
  @RequiresModule('INVENTORY')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.COMPRADOR, Role.DEPOSITO)
  listStock(@CurrentTenant('tenantId') tenantId: string, @Query() q: StockQueryDto) {
    return this.purchases.listStock(tenantId, q.sucursalId);
  }

  @Post('stock/ajuste')
  @RequiresModule('INVENTORY')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.DEPOSITO)
  adjustStock(@CurrentTenant('tenantId') tenantId: string, @Body() dto: StockAdjustDto) {
    return this.purchases.adjustStock(tenantId, dto);
  }

  // --- Merma (INVENTORY) ---
  @Get('waste')
  @RequiresModule('INVENTORY')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.COMPRADOR, Role.DEPOSITO)
  listWaste(@CurrentTenant('tenantId') tenantId: string, @Query() q: ListQueryDto) {
    return this.purchases.listWaste(tenantId, q.limit);
  }

  @Post('waste')
  @RequiresModule('INVENTORY')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.DEPOSITO)
  createWaste(@CurrentTenant('tenantId') tenantId: string, @Body() dto: CreateWasteDto) {
    return this.purchases.createWaste(tenantId, dto);
  }

  /** Reporte de mermas ($ perdido por producto y por motivo) en un rango. */
  @Get('waste/report')
  @RequiresModule('INVENTORY')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.CONTADOR, Role.COMPRADOR)
  mermaReport(
    @CurrentTenant('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.purchases.mermaReport(tenantId, from, to);
  }

  // --- Vencimientos (INVENTORY) ---
  @Get('vencimientos')
  @RequiresModule('INVENTORY')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.COMPRADOR, Role.DEPOSITO)
  listVencimientos(
    @CurrentTenant('tenantId') tenantId: string,
    @Query('estado') estado?: string,
    @Query('dias') dias?: string,
  ) {
    return this.purchases.listVencimientos(tenantId, { estado, dias: dias ? Number(dias) : undefined });
  }

  @Post('vencimientos')
  @RequiresModule('INVENTORY')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.DEPOSITO)
  createVencimiento(@CurrentTenant('tenantId') tenantId: string, @Body() dto: CreateVencimientoDto) {
    return this.purchases.createVencimiento(tenantId, dto);
  }

  @Post('vencimientos/:id/resolve')
  @RequiresModule('INVENTORY')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.DEPOSITO)
  resolveVencimiento(
    @CurrentTenant('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: ResolveVencimientoDto,
  ) {
    return this.purchases.resolveVencimiento(tenantId, id, dto);
  }

  @Post('vencimientos/:id/delete')
  @RequiresModule('INVENTORY')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.DEPOSITO)
  deleteVencimiento(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.purchases.deleteVencimiento(tenantId, id);
  }
}
