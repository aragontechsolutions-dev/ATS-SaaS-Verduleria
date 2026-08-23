# Seguridad — ATS SaaS Verdulería

Estado y guía de endurecimiento del sistema. Cubre la app (API + frontends) y la
base de datos (Supabase/Postgres).

## Controles ya implementados (código)

| Control | Dónde |
|---|---|
| Verificación de token server-side (Supabase GoTrue) | `auth/auth.service.ts` |
| Aislamiento multi-tenant por `AsyncLocalStorage` + `tenantId` en toda query | `tenant/*`, servicios |
| RBAC (`RolesGuard`), entitlements por plan (`EntitlementsGuard`), super-admin (`PlatformAdminGuard`) | `tenant/`, `entitlements/` |
| Validación de entrada (class-validator) en **todos** los endpoints, incl. `/sales` y `/cash` | `*.dto.ts` |
| Cabeceras de seguridad (HSTS, no-sniff, frameguard, sin `X-Powered-By`) | `helmet` en `main.ts` |
| Rate limiting global (120 req/min por IP) | `@nestjs/throttler` en `app.module.ts` |
| Límite de tamaño de body (1 MB) | `main.ts` |
| `trust proxy` para IP/HTTPS reales detrás de Render | `main.ts` |
| Contraseñas temporales fuertes (16 chars, RNG cripto) | `common/password.util.ts` |
| CFE restringido por rol (ADMIN/ENCARGADO/CAJERO/CONTADOR) | `cfe/cfe.controller.ts` |
| Caches en memoria acotados | `auth/auth.service.ts` |
| Secretos solo en env; service-role **solo backend**; sin secretos en git | `config/`, `.gitignore` |
| Backdoor de header apagado en prod (`ALLOW_HEADER_TENANT=false`) | `render.yaml` |
| SQL parametrizado (Prisma) — sin SQL injection | toda la capa de datos |

## Pasos manuales pendientes (config, no código)

1. **CORS**: en Render, setear `CORS_ORIGIN` con los dominios reales de Vercel
   (coma-separado). Si queda vacío, la API acepta cualquier origen.
2. **Base de datos**: correr el hardening de RLS de abajo en Supabase.
3. **Dependencias (NestJS 11)**: quedan CVEs transitivos (lodash, multer, qs,
   body-parser…) que solo se resuelven subiendo NestJS 10 → 11 (`npm audit fix
   --force`). Es un cambio mayor: hacerlo en su propia rama con testing. Riesgo
   real hoy: **bajo** (no hay endpoints de upload → multer no se ejerce; lodash
   no se invoca con input de usuario). El límite de body ya mitiga el DoS de
   body-parser.

---

## Base de datos — verificación y hardening (Supabase)

> **Por qué importa:** Supabase expone automáticamente una API REST (PostgREST)
> accesible con la **anon key** (que está embebida en los frontends). Si las
> tablas de la app son accesibles por los roles `anon`/`authenticated`, cualquiera
> con esa key podría leer/escribir datos **salteándose** los controles de tenant
> del backend. Nuestro backend se conecta con Prisma como el rol `postgres`
> (owner), que **ignora RLS**, así que activar RLS y revocar grants **no afecta**
> a la app, pero **cierra** la puerta de PostgREST.
>
> Los frontends solo usan Supabase para **auth** (login/sesión) y consumen los
> datos por nuestra API NestJS — nunca leen tablas directo. Por eso revocar los
> grants es seguro.

### 1) Verificar (correr en el SQL Editor de Supabase)

```sql
-- a) ¿RLS activo por tabla? (rowsecurity=false = potencialmente expuesta)
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by rowsecurity, tablename;

-- b) ¿Qué pueden hacer los roles públicos sobre las tablas?
select grantee, table_name, string_agg(privilege_type, ', ') as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by grantee, table_name
order by table_name, grantee;

-- c) ¿El backend se conecta como un rol que ignora RLS? (debe dar rolbypassrls=t
--    o rolsuper=t; con el usuario postgres del pooler, sí)
select current_user;
select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user;
```

Interpretación:
- (a) Ideal: `rowsecurity = true` en todas.
- (b) Ideal: **cero filas** (los roles públicos no tienen acceso directo).
- (c) Ideal: `rolbypassrls = t` o `rolsuper = t` para el usuario del backend.

### 2) Endurecer (correr una vez, como `postgres`, en el SQL Editor)

```sql
-- A) Activar RLS en todas las tablas de public (deny-by-default para PostgREST).
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', r.tablename);
  end loop;
end $$;

-- B) Revocar el acceso directo de los roles públicos (defensa en profundidad).
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- C) Que las tablas/secuencias futuras nazcan sin acceso para esos roles.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
```

### 3) Post-verificación

- Re-correr las consultas (a) y (b): todas con `rowsecurity = true` y **sin filas**
  en (b).
- Confirmar que la app sigue andando: hacer login en el panel y cargar cualquier
  pantalla (el backend usa `postgres`, así que no se ve afectado).

> **Cuidado:** No tocar los esquemas `auth`, `storage`, `realtime` (los maneja
> Supabase). Este hardening es solo para `public`. Si algún día creás un rol de
> base **limitado** para el backend (en vez de `postgres`), vas a necesitar
> políticas RLS explícitas o `BYPASSRLS` en ese rol, o la app dejará de leer.
