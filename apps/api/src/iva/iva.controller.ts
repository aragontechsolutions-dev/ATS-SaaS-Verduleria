import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../platform/platform-admin.guard';
import { IvaService } from './iva.service';
import { ClasificarDto, CreateIvaRuleDto, UpdateIvaRuleDto } from './iva.dto';

/**
 * Administración del motor de IVA — SOLO Aragon (super-admin de plataforma).
 * Las reglas son globales: aplican a los productos de todas las verdulerías.
 */
@Controller('platform/iva')
@UseGuards(PlatformAdminGuard)
export class IvaController {
  constructor(private readonly iva: IvaService) {}

  @Get('rules')
  list() {
    return this.iva.listRules();
  }

  @Post('rules')
  create(@Body() dto: CreateIvaRuleDto) {
    return this.iva.createRule(dto);
  }

  @Patch('rules/:id')
  update(@Param('id') id: string, @Body() dto: UpdateIvaRuleDto) {
    return this.iva.updateRule(id, dto);
  }

  @Delete('rules/:id')
  remove(@Param('id') id: string) {
    return this.iva.deleteRule(id);
  }

  /** Prueba: clasifica un nombre con las reglas actuales (sin guardar nada). */
  @Post('clasificar')
  clasificar(@Body() dto: ClasificarDto) {
    return this.iva.clasificar(dto.nombre);
  }

  /** Reaplica el motor a todo el catálogo (productos sin override del contador). */
  @Post('reclasificar')
  reclasificar() {
    return this.iva.reclassifyAll();
  }
}
