import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DemoModule } from '../demo/demo.module';

/**
 * Global para que AuthService esté disponible en el TenantMiddleware (que
 * verifica el token de Supabase y resuelve el tenant en cada request).
 */
@Global()
@Module({
  imports: [DemoModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
