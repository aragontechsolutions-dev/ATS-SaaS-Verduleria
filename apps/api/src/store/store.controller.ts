import { Controller, Get, Param } from '@nestjs/common';
import { StoreService } from './store.service';

/** Tienda online pública por slug — SIN autenticación (la consume la web pública). */
@Controller('public/tienda')
export class PublicStoreController {
  constructor(private readonly store: StoreService) {}

  @Get(':slug/catalogo')
  catalogo(@Param('slug') slug: string) {
    return this.store.getPublicCatalog(slug);
  }
}
