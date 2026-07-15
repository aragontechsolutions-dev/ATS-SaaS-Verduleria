import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { getTenantContext, type TenantContext } from './tenant-context';

/** Inyecta el TenantContext (o una de sus propiedades) en un handler. */
export const CurrentTenant = createParamDecorator(
  (data: keyof TenantContext | undefined, _ctx: ExecutionContext) => {
    const context = getTenantContext();
    if (!context) return undefined;
    return data ? context[data] : context;
  },
);
