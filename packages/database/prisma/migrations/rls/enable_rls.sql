-- ============================================================================
-- RLS (Row Level Security) como defensa en profundidad — Supabase / Postgres.
--
-- El aislamiento primario lo hace la capa de aplicación (NestJS filtra por
-- tenantId en cada query). RLS es la segunda barrera: si algo consulta la BD
-- con la anon key (PostgREST), NO debe ver datos de otro tenant.
--
-- Estrategia: cada tabla de negocio filtra por
--   tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
-- El tenant_id viaja como custom claim en el JWT de Supabase Auth.
--
-- ⚠️ Ejecutar DESPUÉS de `prisma migrate` (Prisma no gestiona policies).
-- ⚠️ La service_role key bypassea RLS: NUNCA usarla desde el cliente.
-- ⚠️ Testear las policies desde el SDK cliente, no desde el SQL editor
--    (el editor bypassea RLS).
-- ============================================================================

-- Helper: tenant_id del JWT actual.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'tenant_id', '')::uuid;
$$;

-- Tablas con columna tenant_id (nombre físico en snake_case según @@map de Prisma
-- o el default). Ajustar los nombres si se personaliza el mapeo.
do $$
declare
  t text;
  tablas text[] := array[
    'Tenant','CfeTenantConfig','Membership','Sucursal','Categoria','Product',
    'PriceList','PriceListItem','Stock','StockMovement','Waste','Supplier',
    'Purchase','PurchaseItem','CashSession','Sale','SaleItem','Payment',
    'Customer','AccountReceivable','AccountMovement','DeliveryOrder',
    'DeliveryItem','Route','CfeDocument'
  ];
begin
  foreach t in array tablas loop
    execute format('alter table if exists public.%I enable row level security;', t);
    execute format('alter table if exists public.%I force row level security;', t);
  end loop;
end $$;

-- Policy genérica por tenant para las tablas que tienen columna "tenantId".
-- (Tenant se maneja aparte porque su PK ES el tenant.)
do $$
declare
  t text;
  tablas text[] := array[
    'CfeTenantConfig','Membership','Sucursal','Categoria','Product',
    'PriceList','PriceListItem','Stock','StockMovement','Waste','Supplier',
    'Purchase','PurchaseItem','CashSession','Sale','SaleItem','Payment',
    'Customer','AccountReceivable','DeliveryOrder','DeliveryItem','Route',
    'CfeDocument'
  ];
begin
  foreach t in array tablas loop
    execute format('drop policy if exists tenant_isolation on public.%I;', t);
    execute format($f$
      create policy tenant_isolation on public.%I
        using ("tenantId" = public.current_tenant_id())
        with check ("tenantId" = public.current_tenant_id());
    $f$, t);
  end loop;
end $$;

-- Tenant: el usuario solo ve su propio tenant.
drop policy if exists tenant_self on public."Tenant";
create policy tenant_self on public."Tenant"
  using ("id" = public.current_tenant_id())
  with check ("id" = public.current_tenant_id());

-- NOTA: AccountMovement no tiene tenantId directo en algunos modelos; acá sí lo
-- tiene. Si se quitara, derivar el tenant vía join con AccountReceivable.
