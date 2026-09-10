-- ============================================================================
-- Mercado Pago Point — cobro presencial con lector.
-- Guarda el lector Point elegido (modo integrado) por tenant.
-- Ejecutar en Supabase antes de desplegar. Seguro de re-ejecutar.
-- ============================================================================

ALTER TABLE "TenantPaymentConfig" ADD COLUMN IF NOT EXISTS "pointDeviceId" TEXT;
