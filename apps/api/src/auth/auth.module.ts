import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Global para que AuthService esté disponible en el TenantMiddleware (que
 * verifica el token de Supabase y resuelve el tenant en cada request).
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
