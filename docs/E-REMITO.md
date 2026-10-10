# e-Remito fiscal (CFE 181) — plan y estado

> Estado: **en preparación**. Hoy el sistema emite el **remito imprimible (no
> fiscal)** del módulo Remitos. El **e-Remito electrónico** (CFE tipo 181, ante
> DGI) todavía **no está habilitado**. Este documento deja la base y el plan.

## Qué es y cuándo se necesita

El e-Remito (CFE 181) es el comprobante electrónico que **ampara el traslado de
mercadería**. En la práctica, cuando el cliente mayorista se lleva la mercadería
(p. ej. en camión), la mercadería que circula debe ir acompañada de un remito;
si estás obligado a CFE, ese remito debe ser electrónico.

> ⚠️ **Confirmar con el contador**: si tu operación/volumen requiere e-Remito, y
> el tratamiento de IVA/valores del 181 para tu régimen. No habilitar sin esa
> validación.

## Lo que ya quedó preparado (en este repo)

- **Modelo de datos**: `CfeDocument.remitoId` (único, nullable) enlaza un CFE con
  un `Remito`, y `Remito.cfeDocument` es la relación inversa.
  Migración: `packages/database/prisma/migrations/sql/2026_eremito_prep.sql`.
- **Mapper**: `remitoToCfeInput(remito, cfeConfig, regimen, opts?)` en
  `apps/api/src/cfe/cfe.mapper.ts` — arma el `CfeInput` con `tipo: 'E_REMITO'`,
  cliente (snapshot del remito), ítems (concepto/cantidad/unidad) y una adenda
  con transportista/matrícula/destino. **WIP**: ver TODOs de IVA/valores.
- **Servicio**: `CfeService.emitirRemito(tenantId, remitoId)` — punto de
  enganche, **protegido** por la variable de entorno `EREMITO_HABILITADO`
  (si no es `'true'`, lanza error). Hace upsert de `CfeDocument` (tipo
  `E_REMITO`, idExterno `remito-<id>`) y llama al proveedor. **No está expuesto
  por ninguna ruta ni UI.**
- El enum `CfeTipo` ya incluía `E_REMITO` (181).

Nada de lo anterior cambia el flujo actual: es todo aditivo e inerte.

## Lo que falta para habilitarlo

1. **Proveedor (FEU)**: confirmar que el adaptador `CfeProvider.emitir` soporta
   el tipo 181 y qué campos exige (puede diferir de factura/ticket).
2. **IVA / valores del remito**: definir con el contador si el 181 va **sin
   valores** o **con importes** y qué indicador de IVA corresponde. Hoy el
   mapper pone `precio: 0` e `iva: 'EXENTO'` por defecto (placeholder).
3. **Receptor**: el `Remito` guarda el documento del cliente (`clienteDoc`) pero
   no su **tipo de documento**. Si el 181 lo requiere, agregar
   `clienteTipoDoc` al `Remito` (o resolverlo desde el `Customer`).
4. **Datos de transporte**: revisar si DGI pide campos estructurados
   (transportista, matrícula, origen/destino) en lugar de la adenda de texto.
5. **Certificado / ambiente**: igual que el resto de CFE (certificado vigente,
   ambiente test → producción), gestionado desde la Consola.
6. **Polling de estado**: el `CfeDocument` del remito entra al mismo worker de
   polling DGI (ya existe para ventas); verificar que contempla el 181.
7. **UI**: en la pantalla **Remitos**, un botón "Emitir e-Remito" (visible solo
   si el módulo CFE está activo y `EREMITO_HABILITADO`), con su estado DGI y el
   PDF/QR.

## Cómo habilitarlo (cuando esté validado)

1. Setear `EREMITO_HABILITADO=true` en la API (Render).
2. Aplicar la migración `2026_eremito_prep.sql` en Supabase (si no se aplicó).
3. Completar los TODOs del mapper (IVA/valores, tipo de documento del receptor).
4. Exponer `emitirRemito` por un endpoint (p. ej. `POST /remitos/:id/efactura`)
   y conectar el botón en la UI.
5. Probar en **ambiente test** de DGI antes de producción.

## Archivos

- `apps/api/src/cfe/cfe.mapper.ts` — `remitoToCfeInput` (WIP).
- `apps/api/src/cfe/cfe.service.ts` — `emitirRemito` (guardado por flag).
- `packages/database/prisma/schema.prisma` — `CfeDocument.remitoId` / `Remito.cfeDocument`.
- `packages/database/prisma/migrations/sql/2026_eremito_prep.sql` — migración.
