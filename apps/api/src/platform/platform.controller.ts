import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformService } from './platform.service';
import { DemoService } from '../demo/demo.service';
import { CreateTenantDto, SetCfeAddonDto, SetDescuentoDto, UpdateCfeConfigDto, UpdateTenantDto } from './platform.dto';

/** Consola de plataforma (Aragon). Todo exige ser super-admin de plataforma. */
@Controller('platform')
@UseGuards(PlatformAdminGuard)
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly demo: DemoService,
  ) {}

  @Get('overview')
  overview() {
    return this.platform.overview();
  }

  @Get('plans')
  plans() {
    return this.platform.listPlans();
  }

  @Get('tenants')
  listTenants() {
    return this.platform.listTenants();
  }

  /** Usuarios bloqueados por intentos fallidos (para desbloquear al admin). */
  @Get('locked-users')
  lockedUsers() {
    return this.platform.lockedUsers();
  }

  @Post('users/:id/unlock')
  unlockUser(@Param('id') id: string) {
    return this.platform.unlockUser(id);
  }

  @Post('tenants')
  createTenant(@Body() dto: CreateTenantDto) {
    return this.platform.createTenant(dto);
  }

  @Patch('tenants/:id')
  updateTenant(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.platform.updateTenant(id, dto);
  }

  // --- Demo (cuenta sandbox) ---

  /** Estado de la demo del tenant (si es demo, si tiene base, última actividad). */
  @Get('tenants/:id/demo')
  demoEstado(@Param('id') id: string) {
    return this.demo.estado(id);
  }

  /** Guarda la "foto" actual (catálogo + usuarios) como base a restaurar. */
  @Post('tenants/:id/demo/base')
  demoGuardarBase(@Param('id') id: string) {
    return this.demo.guardarBase(id);
  }

  /** Restaura la demo a la base ahora mismo. */
  @Post('tenants/:id/demo/reset')
  demoReset(@Param('id') id: string) {
    return this.demo.restaurar(id).then(() => ({ ok: true }));
  }

  /** Deja de ser demo (no borra la base guardada). */
  @Post('tenants/:id/demo/off')
  demoOff(@Param('id') id: string) {
    return this.demo.desmarcar(id);
  }

  /** Descuento/cupón de la suscripción (ej. promo Fundadores 50%). */
  @Patch('tenants/:id/descuento')
  setDescuento(@Param('id') id: string, @Body() dto: SetDescuentoDto) {
    return this.platform.setDescuento(id, dto);
  }

  /** Config fiscal (CFE) del tenant — lectura. */
  @Get('tenants/:id/cfe')
  getCfeConfig(@Param('id') id: string) {
    return this.platform.getCfeConfig(id);
  }

  /** Config fiscal (CFE) del tenant — edición (solo Aragon). */
  @Patch('tenants/:id/cfe')
  updateCfeConfig(@Param('id') id: string, @Body() dto: UpdateCfeConfigDto) {
    return this.platform.updateCfeConfig(id, dto);
  }

  /** Activa/desactiva el add-on de CFE (módulo extra en la suscripción). */
  @Patch('tenants/:id/cfe/addon')
  setCfeAddon(@Param('id') id: string, @Body() dto: SetCfeAddonDto) {
    return this.platform.setCfeAddon(id, dto.enabled);
  }

  // --- Cobros online (Mercado Pago) — gestionado por Aragon ------------------

  /** Estado de la conexión de MP del tenant. */
  @Get('tenants/:id/pagos')
  getPagos(@Param('id') id: string) {
    return this.platform.getPagosConfig(id);
  }

  /** Elige el proveedor de pago del comercio (de la gama). */
  @Post('tenants/:id/pagos/proveedor')
  seleccionarProveedor(@Param('id') id: string, @Body() dto: { provider: string }) {
    return this.platform.seleccionarProveedorPago(id, dto.provider);
  }

  /** Genera el enlace de "Conectar con Mercado Pago" para pasárselo al comercio. */
  @Post('tenants/:id/pagos/oauth-link')
  crearEnlacePagos(@Param('id') id: string) {
    return this.platform.crearEnlacePagos(id);
  }

  /** Activa/desactiva el cobro online en la tienda del tenant. */
  @Patch('tenants/:id/pagos/activar')
  activarPagos(@Param('id') id: string, @Body() dto: SetCfeAddonDto) {
    return this.platform.activarCobroOnline(id, dto.enabled);
  }

  /** Desconecta la cuenta de Mercado Pago del tenant. */
  @Post('tenants/:id/pagos/desconectar')
  desconectarPagos(@Param('id') id: string) {
    return this.platform.desconectarPagos(id);
  }

  // --- Mercado Pago Point (lector presencial) -------------------------------

  /** Lista los lectores Point de la cuenta del tenant. */
  @Get('tenants/:id/point/dispositivos')
  pointDispositivos(@Param('id') id: string) {
    return this.platform.pointDispositivos(id);
  }

  /** Elige el lector Point del tenant y lo pone en modo integrado. */
  @Post('tenants/:id/point/dispositivo')
  pointSeleccionar(@Param('id') id: string, @Body() dto: { deviceId: string }) {
    return this.platform.pointSeleccionar(id, dto.deviceId);
  }

  /** Quita el lector Point configurado. */
  @Post('tenants/:id/point/quitar')
  pointQuitar(@Param('id') id: string) {
    return this.platform.pointQuitar(id);
  }
}
