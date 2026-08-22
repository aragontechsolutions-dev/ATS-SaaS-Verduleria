import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { AppConfig } from '../config/configuration';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Global para que JwtModule/AuthService estén disponibles también en el
 * TenantMiddleware (que verifica el Bearer token en cada request).
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const auth = config.get('auth', { infer: true });
        return {
          secret: auth.jwtSecret,
          // expiresIn admite string tipo "12h"; el tipo de @nestjs/jwt es un
          // template-literal estricto, por eso el cast.
          signOptions: { expiresIn: auth.jwtExpiresIn as `${number}h` },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
