-- Demo (cuenta sandbox): marca de tenant demo, última actividad y snapshot base.
-- Aplicar en Supabase (SQL editor). Idempotente.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "esDemo" boolean NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "demoActividadAt" timestamp(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "demoSnapshot" jsonb;
