# Deploy: Supabase (BD) + Render (backend) + Vercel (frontend)

Guía paso a paso para poner el MVP en producción. Arquitectura:

```
Vercel (POS PWA)  ──HTTPS──▶  Render (API NestJS)  ──▶  Supabase (Postgres)
                                        │
                                        └──▶ FEU/Surtec (facturación)
```

Orden recomendado: **1) Supabase → 2) Render → 3) Vercel** (el front necesita la
URL del back, y el back necesita la BD).

---

## 1. Supabase (base de datos)

Proyecto: `https://yvbumbuslhydztmjugra.supabase.co` (ref `yvbumbuslhydztmjugra`).

### 1.1 Obtener las connection strings
En el dashboard: **Project Settings → Database → Connection string → "URI"**, o el
botón **Connect** arriba. Vas a necesitar dos (reemplazá `[PASSWORD]` por la
contraseña de la BD y `[REGION]` por tu región, ej. `us-east-1`):

- **Pooler (Transaction, puerto 6543)** → runtime de la app (`DATABASE_URL`):
  ```
  postgresql://postgres.yvbumbuslhydztmjugra:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
  ```
- **Directa (puerto 5432)** → migraciones (`DIRECT_URL`):
  ```
  postgresql://postgres.yvbumbuslhydztmjugra:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
  ```

> `pgbouncer=true` es obligatorio en el pooler: desactiva prepared statements
> incompatibles con el pooler transaccional.

### 1.2 Crear el esquema y datos (desde tu máquina, una sola vez)
```bash
git clone <repo> && cd ATS-SaaS-Verduleria
npm install

export DATABASE_URL="...pooler...6543...?pgbouncer=true"
export DIRECT_URL="...directa...5432..."

npm run db:push     # crea todas las tablas (sin migraciones, ideal para el MVP)
npm run db:seed     # tenant demo + 3 planes + catálogo + suscripción FULL
```

Anotá los IDs que vas a necesitar para el POS:
```bash
# En el SQL Editor de Supabase, o con psql:
select id from "Tenant" where slug = 'demo-maldonado';   -- VITE_TENANT_ID
select id from "User"   where email = 'admin@demo.uy';    -- VITE_USER_ID
```

> **RLS (Row Level Security):** *no* apliques `migrations/rls/enable_rls.sql`
> todavía. Esas policies usan un claim `tenant_id` del JWT de Supabase Auth, y
> nuestra API conecta por connection string (no por ese JWT); con `FORCE RLS`
> activo la API dejaría de ver filas. El aislamiento por tenant hoy lo hace la
> capa de aplicación. Revisá RLS cuando expongas datos vía PostgREST/Supabase
> Auth. (Ver `docs/ARCHITECTURE.md`.)

---

## 2. Render (backend NestJS)

El repo trae `render.yaml` (Blueprint). En Render: **New → Blueprint → elegí este
repo**. Detecta el servicio `ats-verduleria-api`. Sino, **New → Web Service**:

- **Build command:**
  `npm install && npm run build -w @ats/database && npm run build -w @ats/cfe && npm run build -w @ats/api`
- **Start command:** `node apps/api/dist/main.js`
- **Health check path:** `/api/health`

### Variables de entorno (Environment)
| Variable | Valor |
|---|---|
| `DATABASE_URL` | pooler 6543 con `?pgbouncer=true` |
| `DIRECT_URL` | directa 5432 |
| `CORS_ORIGIN` | dominio del front (ej. `https://ats-pos.vercel.app`) — se completa tras el paso 3 |
| `FEU_AMBIENTE` | `test` |
| `FEU_USERNAME` | usuario partner de Surtec |
| `FEU_PASSWORD` | contraseña de Surtec |
| `CFE_POLLING_INTERVAL_MS` | `60000` |
| `NODE_VERSION` | `20` |
| `SUPABASE_URL` | `https://yvbumbuslhydztmjugra.supabase.co` |
| `SUPABASE_ANON_KEY` | anon public key (Supabase → Project Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (opcional; deja que la Consola cree el login del cliente al alta) |
| `ALLOW_HEADER_TENANT` | `false` (en prod el tenant solo sale del token de Supabase) |

> Render inyecta `PORT` automáticamente; la API lo respeta y bindea a `0.0.0.0`.
> El plan free "duerme" tras inactividad (primer request lento); ok para el MVP.

Al terminar, tu API queda en `https://ats-verduleria-api.onrender.com`.
Probá: `GET https://…onrender.com/api/health` → `{"status":"ok","db":true}`.

---

## 3. Vercel (frontend POS)

En Vercel: **Add New → Project → importá el repo**. En la configuración del
proyecto, poné el **Root Directory = `apps/pos`** (Settings → Build & Deployment
→ Root Directory). El POS es una app independiente (no depende de otros
workspaces), así que Vercel detecta Vite y lo buildea sin el hoisting del
monorepo. `apps/pos/vercel.json` aporta el rewrite SPA.

### Variables de entorno (Production)
| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://ats-verduleria-api.onrender.com/api` |
| `VITE_SUPABASE_URL` | `https://yvbumbuslhydztmjugra.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon public key (Supabase → Project Settings → API) |

> Vite inyecta estas variables en **build-time**: si las cambiás, **redeploy**.

### Crear el usuario de login (Supabase Auth)
El login lo maneja **Supabase Auth**. Creá el usuario en el dashboard:
**Authentication → Users → Add user** → `admin@demo.uy` + una contraseña, y
marcá **Auto Confirm User** (o Email Confirm). El backend lo enlaza por email
con el `User` del seed (que aporta el tenant y el rol). Para altas nuevas:
crear el usuario en Supabase Auth **y** en `public.User` con el mismo email +
su membership.

Deploy → tu POS queda en `https://ats-pos.vercel.app` (o el dominio que asigne).

### Cerrar el círculo (CORS)
Volvé a Render y poné `CORS_ORIGIN = https://ats-pos.vercel.app` (el dominio real
de Vercel). Redeploy del backend.

---

## 3b. Consola de Plataforma (segundo proyecto en Vercel)

La consola de Aragon (`apps/console`) se despliega como **otro proyecto** de Vercel:
- **Add New → Project** → mismo repo → **Root Directory = `apps/console`**.
- Env vars (Production): `VITE_API_URL` (misma URL de Render + `/api`),
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Sumá el dominio de la consola a `CORS_ORIGIN` en Render (lista separada por comas).

**Super-admin de plataforma**: creá `owner@aragontech.uy` en Supabase →
Authentication → Users (mismo email que el seed marca `isPlatformAdmin`). Con esa
cuenta entrás a la consola y das de alta clientes.

## 3c. Panel de Administración del tenant (tercer proyecto en Vercel)

El panel del cliente (`apps/admin`) — donde el dueño de la verdulería gestiona
productos, precios y usuarios — se despliega como **otro proyecto** de Vercel:
- **Add New → Project** → mismo repo → **Root Directory = `apps/admin`** →
  Framework **Vite**.
- Env vars: `VITE_API_URL` (misma URL de Render + `/api`), `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`.
- Sumá su dominio a `CORS_ORIGIN` en Render (lista separada por comas junto al
  POS y la consola).

Entra con el usuario **ADMIN/ENCARGADO** de esa verdulería (ej. `admin@demo.uy`).

## 4. Verificación end-to-end
1. Abrí el POS en Vercel. Debería cargar el catálogo (10 productos del seed).
2. Abrí caja → vendé un pesable (ej. 1.5 kg) → cobrá en efectivo.
3. Al confirmar, el POS emite el e-Ticket contra FEU y muestra serie-número/CAE.
4. Cerrá caja → arqueo con diferencia 0.

> **Sobre FEU:** la emisión del CFE requiere que Render pueda salir a
> `*.facturaelectronica.com.uy` con credenciales válidas. Si el proveedor
> rechaza el login, la venta igual queda registrada y el CFE se puede reintentar
> (el POS lo muestra como pendiente/errado, no se pierde la venta).

---

## Notas de seguridad (antes de clientes reales)
- **Auth real (JWT)** en lugar del header `x-tenant-id`/`x-user-id` (hoy el POS
  manda el tenant por header; sirve para el MVP single-tenant, no para multi-cliente).
- Restringir `CORS_ORIGIN` al dominio real (ya soportado).
- Activar y probar **RLS** si se expone la BD vía PostgREST.
- Nunca usar la **service_role key** de Supabase desde el cliente.
