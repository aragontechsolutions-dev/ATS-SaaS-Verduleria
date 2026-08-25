import { Module } from '@nestjs/common';
import { IvaController } from './iva.controller';
import { IvaService } from './iva.service';

/** Motor de IVA: reglas globales (Consola) + clasificación de productos. */
@Module({
  controllers: [IvaController],
  providers: [IvaService],
  exports: [IvaService],
})
export class IvaModule {}
