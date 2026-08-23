import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { SucursalesController } from './sucursales.controller';
import { SucursalesService } from './sucursales.service';

@Module({
  controllers: [SucursalesController],
  providers: [SucursalesService, RolesGuard],
})
export class SucursalesModule {}
