import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ActividadService } from './actividad.service';
import { ActividadInterceptor } from './actividad.interceptor';

// Global: el interceptor se aplica a todas las rutas y PlatformController usa el
// servicio para el monitoreo en la Consola.
@Global()
@Module({
  providers: [
    ActividadService,
    { provide: APP_INTERCEPTOR, useClass: ActividadInterceptor },
  ],
  exports: [ActividadService],
})
export class ActividadModule {}
