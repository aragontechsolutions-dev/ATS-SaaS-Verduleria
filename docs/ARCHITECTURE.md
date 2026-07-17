# Arquitectura — ATS SaaS Verdulería

SaaS multi-tenant de gestión de verdulerías para Uruguay (Maldonado). Este
documento describe la arquitectura de las **fundaciones** ya implementadas y el
roadmap.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | NestJS 10 (media TODAS las operaciones) |
| ORM / DB | Prisma 5 + PostgreSQL (Supabase managed) |
| Facturación CFE | Paquete `@ats/cfe` (adaptador pluggable, FEU/Surtec) |
| POS (futuro) | React PWA offline (IndexedDB + service worker + cola de sync) |
| App repartidor (futuro) | React Native + Expo |

## Monorepo (npm workspaces)

```
packages/
  database/   → @ats/database : schema Prisma + cliente generado
  cfe/        → @ats/cfe      : interfaz CfeProvider + FeuProvider (sin deps)
apps/
  api/        → @ats/api      : backend NestJS (Prisma, multi-tenant, CFE)
  pos/        → @ats/pos      : POS offline (PWA React + IndexedDB + sync)
```

`@ats/cfe` es **standalone** (solo `fetch` nativo) para poder reusarlo y para
que FEU sea intercambiable con Host Factura u otro proveedor.

## Multi-tenancy

- **Modelo shared-schema**: toda tabla de negocio lleva `tenantId` **indexado**.
- **Aislamiento primario en la app**: NestJS resuelve el tenant por request
  (`TenantMiddleware` → `AsyncLocalStorage`) y filtra por `tenantId` en cada
  query. `TenantGuard` exige tenant en recursos protegidos.
- **RLS como defensa en profundidad** (`prisma/migrations/rls/enable_rls.sql`):
  si algo accede vía PostgREST con la anon key, las policies por
  `tenant_id = current_tenant_id()` (custom claim del JWT) impiden fugas.
- La `service_role` key **nunca** va al cliente.

> Foundations: el tenant se resuelve por header `x-tenant-id`. En producción se
> reemplaza por el `tenant_id` del JWT validado por un AuthGuard.

## Facturación electrónica (CFE)

Diseño **pluggable**: la app trabaja con tipos de dominio (`CfeInput`,
`CfeResult`, `EstadoDgiResult`) y la interfaz `CfeProvider`. El `FeuProvider`
implementa esa interfaz contra la API de FEU (Surtec). Todo verificado
empíricamente (ver `docs/CFE-FEU.md`).

Puntos clave implementados:
- **Un login → múltiples RUTs**: el RUT del tenant se manda en `X-Emisor` por
  request (multi-tenant nativo de FEU).
- **Idempotencia**: `id_externo = Sale.idempotencyKey` (= sale_id). Reintentar
  una venta encolada offline nunca factura dos veces. `CfeDocument` es único por
  `(tenantId, idExterno)`.
- **Token management**: cache del access_token + refresh + reintento ante 401.
- **PDF JSON+base64**: el endpoint `/pdf` devuelve JSON con el PDF en base64
  (no binario); el provider lo decodifica a Buffer.
- **Polling de estado DGI**: `CfePollingService` reconsulta `NE → AE/BE/CE`
  hasta estado final (FEU aún no tiene webhook). Reemplazable sin tocar el resto.
- **Dos regímenes con el mismo código**: `cod_montos_brutos` y el modo
  "ticket interno no fiscal" (Monotributo / sin CFE) según el régimen del tenant.

### IVA por producto y por tipo de cliente

La tasa de IVA no es solo propiedad del producto: depende de **a quién se vende**
(ver `docs/CFE-IVA.md`).

- Las **categorías** llevan `ivaIndicadorDefault`; el producto lo hereda en
  `ivaIndicador` (editable por el contador).
- `resolverIvaIndicador()` (`@ats/cfe`) calcula la tasa efectiva combinando la
  base del producto, `esEstadoNatural`, `esImportado` y el tipo de cliente:
  - **Consumidor final** (mostrador, 95% de la operación) → tasa base directa.
  - **Empresa B2B** (e-Factura a RUC): nacional en estado natural → **IVA en
    suspenso**; importado → **22%**; elaborado/almacén → su tasa base.
- El campo `indicador_facturacion` de cada línea CFE es la tasa resuelta
  (1 exento / 2 mínima / 3 básica / 12 suspenso).

> El módulo mayorista B2B (suspenso/22%) es de v1; el MVP mostrador usa la base.

### Flujo de emisión

```
POS vende (offline-first)
      │  Sale + idempotencyKey (uuid)
      ▼
CfeService.emitirParaVenta(tenantId, saleId)
      │  ┌─ Monotributo/SIN_CFE → CfeDocument TICKET_INTERNO (no fiscal)
      │  └─ resto → map Sale→CfeInput → FeuProvider.emitir (X-Emisor=RUT)
      ▼
CfeDocument (estado NE, CAE, serie/número, qrUrl)
      ▼
CfePollingService  ──reconsulta──▶  estado AE (aceptado DGI)
```

## POS offline (PWA) — `apps/pos`

El core operativo: si se cae internet, la verdulería debe seguir vendiendo.

- **Fuente de verdad local**: IndexedDB (Dexie) con dos tablas — `catalog`
  (productos + precios cacheados) y `outbox` (ventas encoladas).
- **Offline-first**: el catálogo se carga primero del cache local (instantáneo)
  y se refresca del backend (`GET /api/catalog`, NetworkFirst) cuando hay red.
  Las ventas se registran siempre local y se suben con `flushOutbox()`.
- **Idempotencia**: cada venta lleva un `idempotencyKey` (uuid) que es a la vez
  el `id_externo` del CFE. Reintentar tras reconectar nunca duplica (el backend
  hace upsert por esa clave; FEU también).
- **Sync**: disparado por el listener `online` + intervalo de 30s (Background
  Sync solo existe en Chromium, por eso el fallback). Siempre se encola primero.
- **Código de peso variable EAN-13** (`lib/barcode.ts`): parsea el código que
  imprime la balanza etiquetadora (prefijo 20-29 → PLU + peso/importe) sin
  hablar con la balanza. El POS resuelve el producto por PLU y recalcula el
  precio con el catálogo del día. Configurable (peso vs importe embebido,
  decimales, validación de dígito verificador). 7 tests.
- **Lector de código de barras**: `useScanner` capta el lector (que emula
  teclado) por la cadencia rápida de teclas + Enter.
- **Ingreso manual** (`WeighModal`): para balanzas que muestran el peso pero NO
  imprimen etiqueta. Al tocar un producto pesable, el cajero escribe solo el
  **peso** y el POS calcula el precio con el catálogo del día.
- **UX**: grilla táctil por categoría, búsqueda, cobro por medio de pago,
  contador de ventas pendientes de sync.

> PWA: `vite-plugin-pwa` precachea el app shell y genera el service worker.
> Los íconos de producción deben ser PNG reales (hoy hay un SVG de placeholder).

## Modularidad por plan (entitlements)

El SaaS se vende **por niveles**: cada plan activa un set de módulos. Diseño
data-driven (planes editables sin tocar código):

- **Catálogo de módulos** (`ModuleKey`): POS, CFE, INVENTORY, PURCHASES, PRICING,
  WHOLESALE, DELIVERY, REPORTS_ADVANCED, MULTI_SUCURSAL, SCALE_LIVE.
- **`Plan`**: incluye un array de módulos + límites (`maxUsuarios`,
  `maxSucursales`, `maxProductos`, `maxDispositivosPos`; null = ilimitado).
- **`Subscription`** (1 por tenant): plan + estado (TRIAL/ACTIVA/SUSPENDIDA/
  CANCELADA) + **overrides** (`modulosExtra`, `modulosExcluidos`, y overrides de
  límites) para acuerdos a medida sin crear un plan nuevo.
- **Entitlements efectivos** = (módulos del plan ∪ extra) − excluidos, solo si la
  suscripción está activa. Los resuelve y cachea `EntitlementsService`.

Enforcement:
- **Backend**: `@RequiresModule('DELIVERY')` + `EntitlementsGuard` (tras
  `TenantGuard`) → 403 si el plan no lo incluye. `assertWithinLimit()` valida
  cupos al crear recursos. Ej: `CfeController` ya está protegido con
  `@RequiresModule('CFE')`.
- **Frontend/POS**: `GET /api/me/entitlements` devuelve plan, estado, módulos
  activos (con metadata) y límites → la UI muestra/oculta secciones.

Seed: 3 planes de ejemplo (Básico / Pro / Full) editables.

## Modelo de datos (resumen)

Núcleo: `Tenant`/`User`/`Membership(role)`, `Product` (unidades múltiples con
`factorConversion`, `ivaIndicador`, `esPesable`, `plu`, `mermaPct`),
`PriceList`/`PriceListItem`, `Stock`/`StockMovement`/`Waste`,
`Purchase`/`PurchaseItem` (compra UAM por cajón/bulto),
`Sale`/`SaleItem`/`Payment`/`CashSession`, `Customer`/`AccountReceivable`
(cuenta corriente mayorista), `DeliveryOrder`/`Route` (reparto), y `CfeDocument`.

Ver `packages/database/prisma/schema.prisma`.

## Roadmap

- **MVP**: multi-tenant + auth + RLS ✅ (fundaciones); catálogo unidades
  múltiples ✅; adaptador CFE FEU ✅; **POS offline PWA** (pendiente); código de
  peso variable EAN-13 (pendiente); caja/arqueo (modelado ✅, UI pendiente).
- **v1**: compras UAM + costo/merma; rentabilidad por producto; listas de precios
  múltiples; cuenta corriente mayorista + remitos; WebSerial peso en vivo.
- **v2**: app repartidor (RN/Expo); portal mayorista; e-Remito; agente Node
  balanza; multi-sucursal.
