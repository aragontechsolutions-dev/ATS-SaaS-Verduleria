-- ============================================================================
-- Fase 1 · Pagos online (Mercado Pago) — configuración por tenant.
-- Ejecutar en Supabase (SQL editor) ANTES de desplegar la API con este cambio.
-- El Access Token se guarda CIFRADO por la aplicación (AES-256-GCM); esta tabla
-- solo almacena el texto cifrado, nunca el token en claro.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "TenantPaymentConfig" (
  "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"          UUID NOT NULL,
  "provider"          TEXT NOT NULL DEFAULT 'MERCADO_PAGO',
  "ambiente"          TEXT NOT NULL DEFAULT 'test',
  "accessTokenEnc"    TEXT,
  "publicKey"         TEXT,
  "mpUserId"          TEXT,
  "mpNickname"        TEXT,
  "webhookSecret"     TEXT,
  "cobroOnlineActivo" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantPaymentConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantPaymentConfig_tenantId_key"
  ON "TenantPaymentConfig"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "TenantPaymentConfig_webhookSecret_key"
  ON "TenantPaymentConfig"("webhookSecret");

ALTER TABLE "TenantPaymentConfig"
  ADD CONSTRAINT "TenantPaymentConfig_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (defensa en profundidad), mismo patrón que el resto de tablas por tenant.
-- OPCIONAL: solo se aplica si el proyecto ya tiene el helper current_tenant_id()
-- (creado por enable_rls.sql). Si RLS no está desplegado, se omite sin romper y
-- la tabla queda con el mismo régimen que las demás (aislamiento por aplicación).
DO $$
BEGIN
  IF to_regprocedure('public.current_tenant_id()') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "TenantPaymentConfig" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "TenantPaymentConfig" FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON "TenantPaymentConfig"';
    EXECUTE 'CREATE POLICY tenant_isolation ON "TenantPaymentConfig"
              USING ("tenantId" = public.current_tenant_id())
              WITH CHECK ("tenantId" = public.current_tenant_id())';
  END IF;
END $$;
