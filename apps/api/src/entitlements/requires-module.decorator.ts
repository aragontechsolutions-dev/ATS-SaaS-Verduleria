import { SetMetadata } from '@nestjs/common';
import type { ModuleKey } from '@ats/database';

export const REQUIRES_MODULE = 'requires_module';

/** Marca un controlador/handler como dependiente de un módulo del plan. */
export const RequiresModule = (module: ModuleKey) => SetMetadata(REQUIRES_MODULE, module);
