import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  tenantId: string;
  userId?: string;
  role?: string;
  /** RUT del emisor para X-Emisor en CFE. */
  emisorRut?: string;
}

/**
 * Almacenamiento por-request del tenant activo. Permite que servicios profundos
 * (ej. un Prisma extendido con filtro por tenant) accedan al tenant sin pasarlo
 * por parámetro. El aislamiento real se garantiza en cada query + RLS.
 */
export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore();
}

export function requireTenantContext(): TenantContext {
  const ctx = tenantStorage.getStore();
  if (!ctx) throw new Error('No hay contexto de tenant en este request');
  return ctx;
}
