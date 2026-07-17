# ATS · SaaS de Gestión de Verdulerías 🥬

SaaS multi-tenant para verdulerías de Uruguay (Maldonado). POS offline, unidades
de medida múltiples con conversión, merma, mayoreo con cuenta corriente, reparto
y **facturación electrónica CFE** integrada contra FEU/Surtec.

> Estado: **fundaciones** — monorepo, modelo de datos Prisma completo y
> adaptador de facturación electrónica FEU listos y con tests. Ver
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Estructura (npm workspaces)

```
packages/database/   @ats/database  — schema Prisma + cliente
packages/cfe/        @ats/cfe       — adaptador CFE (interfaz + FeuProvider)
apps/api/            @ats/api        — backend NestJS (multi-tenant + CFE)
apps/pos/            @ats/pos        — POS offline (PWA + IndexedDB + peso variable)
docs/                arquitectura y contexto verificado de FEU
```

## Requisitos

- Node.js 22+
- Una base Postgres (Supabase managed recomendado)

## Puesta en marcha

```bash
# 1. Instalar dependencias del monorepo
npm install

# 2. Configurar entorno
cp .env.example .env    # completar DATABASE_URL, DIRECT_URL y credenciales FEU

# 3. Generar el cliente Prisma y aplicar el schema
npm run db:generate
npm run db:migrate      # crea las tablas (requiere DIRECT_URL)
#    Luego, en Supabase, ejecutar packages/database/prisma/migrations/rls/enable_rls.sql

# 4. (Opcional) Datos demo
npm run seed -w @ats/database

# 5. Levantar la API
npm run api:dev         # http://localhost:3000/api

# 6. Levantar el POS (PWA offline). En dev proxya /api → :3000
npm run dev -w @ats/pos # http://localhost:5173
#    Configurar el tenant de prueba en la consola del navegador:
#    localStorage.setItem('ats.tenantId', '<uuid del tenant demo>')
```

## Tests

```bash
npm test -w @ats/cfe    # 11 tests del adaptador CFE (sin red)
npm test -w @ats/pos    #  7 tests del parser de código de peso variable
```

## Probar la integración FEU (aislado, sin tocar el proyecto)

```bash
node packages/cfe/scripts/test-feu.mjs   # emite un e-Ticket real en el ambiente de TEST
```

## Tests del adaptador CFE (sin red)

```bash
npm run build -w @ats/cfe && npm test -w @ats/cfe
```

## Documentación

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitectura y roadmap
- [`docs/CFE-FEU.md`](docs/CFE-FEU.md) — contexto verificado de la API de FEU
- [`docs/CFE-IVA.md`](docs/CFE-IVA.md) — clasificación de IVA de productos (DGI)
