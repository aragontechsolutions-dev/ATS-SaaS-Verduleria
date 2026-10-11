-- Monitoreo de actividad de tenants (Consola del dueño del SaaS).
-- Aplicar en Supabase (SQL editor). Idempotente.

CREATE TABLE IF NOT EXISTS "DeviceActivity" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"    uuid NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "userId"      uuid,
  "app"         text NOT NULL,
  "deviceType"  text NOT NULL,
  "ip"          text,
  "userAgent"   text,
  "email"       text,
  "visitas"     integer NOT NULL DEFAULT 1,
  "firstSeenAt" timestamp(3) NOT NULL DEFAULT now(),
  "lastSeenAt"  timestamp(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceActivity_tenantId_userId_app_deviceType_key"
  ON "DeviceActivity"("tenantId", "userId", "app", "deviceType");
CREATE INDEX IF NOT EXISTS "DeviceActivity_tenantId_lastSeenAt_idx" ON "DeviceActivity"("tenantId", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "DeviceActivity_lastSeenAt_idx" ON "DeviceActivity"("lastSeenAt");
