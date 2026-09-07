-- ============================================================================
-- Fase 1 · Pagos online — vinculación por OAuth ("Conectar con Mercado Pago").
-- Agrega las columnas para el flujo OAuth a TenantPaymentConfig.
-- Ejecutar en Supabase (SQL editor) antes de desplegar la API con este cambio.
-- Seguro de re-ejecutar (IF NOT EXISTS).
-- ============================================================================

ALTER TABLE "TenantPaymentConfig" ADD COLUMN IF NOT EXISTS "conexion" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "TenantPaymentConfig" ADD COLUMN IF NOT EXISTS "refreshTokenEnc" TEXT;
ALTER TABLE "TenantPaymentConfig" ADD COLUMN IF NOT EXISTS "tokenExpiraAt" TIMESTAMP(3);
ALTER TABLE "TenantPaymentConfig" ADD COLUMN IF NOT EXISTS "oauthState" TEXT;
