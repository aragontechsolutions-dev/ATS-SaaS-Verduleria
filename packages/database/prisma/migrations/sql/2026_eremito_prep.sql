-- Preparación del e-Remito fiscal (CFE 181): enlaza CfeDocument con un Remito.
-- Aplicar en Supabase (SQL editor). Idempotente. No cambia el flujo actual.

ALTER TABLE "CfeDocument" ADD COLUMN IF NOT EXISTS "remitoId" uuid;

DO $$ BEGIN
  ALTER TABLE "CfeDocument"
    ADD CONSTRAINT "CfeDocument_remitoId_fkey"
    FOREIGN KEY ("remitoId") REFERENCES "Remito"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "CfeDocument_remitoId_key" ON "CfeDocument"("remitoId");
