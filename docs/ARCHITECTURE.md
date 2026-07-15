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
