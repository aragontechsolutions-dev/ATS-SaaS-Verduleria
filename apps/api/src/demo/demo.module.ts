import { Global, Module } from '@nestjs/common';
import { DemoService } from './demo.service';

// Global: AuthController (login) y PlatformController usan DemoService, y a su
// vez DemoService usa AuthService (global). Marcarlo global evita ciclos de
// importación entre módulos.
@Global()
@Module({
  providers: [DemoService],
  exports: [DemoService],
})
export class DemoModule {}
