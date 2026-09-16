-- Remitos de traslado (no fiscales) para venta mayorista con camión.
-- Aplicar en Supabase (SQL editor). Idempotente.

DO $$ BEGIN
  CREATE TYPE "RemitoEstado" AS ENUM ('BORRADOR', 'DESPACHADO', 'ANULADO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Remito" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"      uuid NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "numero"        integer NOT NULL,
  "customerId"    uuid REFERENCES "Customer"("id"),
  "clienteNombre" text NOT NULL,
  "clienteDoc"    text,
  "transportista" text,
  "matricula"     text,
  "destino"       text,
  "notas"         text,
  "estado"        "RemitoEstado" NOT NULL DEFAULT 'BORRADOR',
  "fecha"         timestamp(3) NOT NULL DEFAULT now(),
  "createdAt"     timestamp(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "Remito_tenantId_numero_key" ON "Remito"("tenantId", "numero");
CREATE INDEX IF NOT EXISTS "Remito_tenantId_fecha_idx" ON "Remito"("tenantId", "fecha");
CREATE INDEX IF NOT EXISTS "Remito_tenantId_estado_idx" ON "Remito"("tenantId", "estado");

CREATE TABLE IF NOT EXISTS "RemitoItem" (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  uuid NOT NULL,
  "remitoId"  uuid NOT NULL REFERENCES "Remito"("id") ON DELETE CASCADE,
  "productId" uuid REFERENCES "Product"("id"),
  "concepto"  text NOT NULL,
  "cantidad"  numeric(14,3) NOT NULL,
  "unidad"    text NOT NULL
);
CREATE INDEX IF NOT EXISTS "RemitoItem_tenantId_idx" ON "RemitoItem"("tenantId");
CREATE INDEX IF NOT EXISTS "RemitoItem_remitoId_idx" ON "RemitoItem"("remitoId");
