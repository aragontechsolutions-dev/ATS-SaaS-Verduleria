import { Controller, Get } from '@nestjs/common';
import { PlatformService } from './platform.service';

/** Endpoint PÚBLICO (sin auth) para la página de precios del sitio de Aragon. */
@Controller('public/planes')
export class PlansPublicController {
  constructor(private readonly platform: PlatformService) {}

  @Get()
  list() {
    return this.platform.listPublicPlans();
  }
}
