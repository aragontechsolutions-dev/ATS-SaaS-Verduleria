# Contexto de integración: Facturación Electrónica FEU (Surtec)

> **Para Claude Code / equipo de desarrollo de ATS.**
> Este documento resume TODO lo verificado empíricamente sobre la API de FEU
> mediante pruebas end-to-end reales contra el ambiente de test. No es teoría:
> cada punto marcado como ✅ VERIFICADO fue probado con requests reales que
> emitieron comprobantes con CAE de DGI. Lo que no se probó está marcado como
> ⚠️ PENDIENTE. El objetivo es que quien construya el adaptador `CfeProvider`
> no tenga que redescubrir nada.

---

## 0. Resumen ejecutivo (lo que hay que saber sí o sí)

- **Proveedor elegido:** FEU (facturaelectronica.com.uy), de SURTEC Software S.A.S. API REST + JSON, autenticación Bearer + refresh token. Es la opción más developer-friendly del mercado uruguayo.
- **Modelo comercial (partner):** el RUT de ATS no paga; ATS **recupera el 15% de lo facturado al cliente** hasta 5 RUTs. Con más de 5 clientes se pasa a un plan de precio fijo por RUT. El Plan Básico ($915/mes + IVA, actualizado por IPC cada enero) es el que trae API; los clientes Literal E tienen un descuento de $420.
- **Multi-tenant nativo:** UN solo login (usuario/contraseña) puede emitir para MÚLTIPLES RUTs. El RUT destino se indica en el header `X-Emisor` en cada request. Esto mapea directo a `tenant → RUT` en el SaaS.
- **Certificado digital:** es propiedad del cliente (su empresa). Surtec facilita el trámite (crea la solicitud en Abitab, el cliente va y paga con su cédula). El adaptador NO gestiona certificados en runtime; se cargan una vez vía endpoint `/certificado/importar`.
- **Estado DGI es asíncrono:** al emitir, el CAE se asigna al instante, pero el acuse de DGI (`AE`) llega segundos/minutos después. **Requiere polling** (no hay webhook todavía; está en desarrollo por Surtec). DGI mide el intervalo mínimo entre consultas.
- **El PDF viene como JSON con base64**, NO como binario directo (ver sección 5, es el hallazgo menos obvio).

---

## 1. Endpoints y URLs

### Ambiente de TEST (verificado)
| Recurso | URL |
|---|---|
| Token (auth) | `https://auth-test.facturaelectronica.com.uy/token` |
| API base | `https://api-test.facturaelectronica.com.uy` |
| Backend web (UI) | `https://test.facturaelectronica.com.uy/v3` |

### Ambiente de PRODUCCIÓN
⚠️ PENDIENTE confirmar las URLs exactas de producción con Surtec. Por convención serían `auth.facturaelectronica.com.uy` y `api.facturaelectronica.com.uy` (sin el `-test`), pero **hay que confirmarlo, no asumirlo**. Los tokens de test NO funcionan en producción y viceversa.

### Operaciones disponibles (verificadas en la doc oficial)
- `POST /token` — autenticar (password o refresh_token)
- `POST /comprobantes/crear` — emitir cualquier tipo de CFE
- `GET /comprobantes/{id}` — datos del comprobante por id interno
- `GET /comprobantes/e/{id_externo}` — datos por id externo (idempotencia)
- `GET /comprobantes/{id}/pdf?tipo=ticket80` — PDF (A4 por defecto, `ticket80` para térmica 80mm)
- `GET /consulta/comprobantes/emitidos` — consultar estado DGI de emitidos
- `GET /consulta/comprobantes/recibidos` — CFE de compras (facturas de proveedores)
- `GET /consulta-dgi/actividad-empresarial/{rut}` — razón social/datos dado un RUT
- `POST /certificado/importar` — cargar certificado digital del emisor
- `GET /certificado/consultar` — estado del certificado
- `GET /v2/consulta/comprobantes/emitidos` — versión v2 paginada (pageNumber, pageSize máx 100)

---

## 2. Autenticación ✅ VERIFICADO

Dos modos: primer login con `password`, luego renovar con `refresh_token`.

### Login inicial
```
POST https://auth-test.facturaelectronica.com.uy/token
Content-Type: application/json

{ "grant_type": "password", "username": "<user>", "password": "<pass>" }
```

Respuesta:
```json
{ "access_token": "eyJ...", "token_type": "bearer", "refresh_token": "eyJ..." }
```

### Renovar token
```
POST /token
{ "grant_type": "refresh_token", "refresh_token": "<refresh>" }
```

**Notas para el adaptador:**
- El `refresh_token` dura 365 días por defecto (configurable con `refresh_token_expire_time` en minutos, mínimo 10).
- El `access_token` es de corta duración → el adaptador debe cachear el access_token y renovarlo con el refresh cuando expire (interceptor que reintenta ante 401).
- Los tokens son RS256 (JWT firmado). Un token de test no sirve en producción.

**Credenciales de TEST (del correo de Surtec):**
```
username:  api-feu@acme-api.com
password:  OiJSUzx1.DS
RUT test:  218617380010
sucursal:  1
```
⚠️ Ambiente de test COMPARTIDO con otros desarrolladores: en las consultas pueden aparecer comprobantes de terceros. Filtrar por fecha/serie/id.

---

## 3. Emisión de comprobantes ✅ VERIFICADO

```
POST /comprobantes/crear
Authorization: Bearer <access_token>
Content-Type: application/json
X-Emisor: <RUT_del_emisor>
```

### Payload de e-Ticket probado (venta de verdulería, IVA mínimo)
```json
{
  "sucursal": 1,
  "tipo_comprobante": 101,
  "forma_pago": 1,
  "moneda": "UYU",
  "cod_montos_brutos": 1,
  "id_externo": "ATS-<sale_id>",
  "items": [
    { "concepto": "Tomate perita", "unidad": "kg", "cantidad": 2.5, "precio": 89.0, "indicador_facturacion": 2 },
    { "concepto": "Lechuga mantecosa", "unidad": "un", "cantidad": 3, "precio": 45.0, "indicador_facturacion": 2 },
    { "concepto": "Papa lavada", "unidad": "kg", "cantidad": 5, "precio": 52.0, "indicador_facturacion": 2 }
  ],
  "adenda": { "texto": "Gracias por su compra" }
}
```

### Respuesta real obtenida
```json
{
  "id": 539072,
  "id_externo": "ATS-TEST-1784071534640",
  "comprobante_tipo": 101,
  "serie": "A",
  "numero": 878,
  "importe_total": 617.5,
  "hash": "k7LIZIOEOwRU6lh6FU9buVJDwlAAkXEnuZFYpOsBAqQ=",
  "cae_numero": 90231398919,
  "cae_rango_inicio": 1,
  "cae_rango_final": 9999999,
  "cae_vencimiento": "2050-12-31T00:00:00",
  "url": "https://www.efactura.dgi.gub.uy/consultaQR/cfe?218617380010,101,A,878,617.50,14/07/2026,k7LIZIOEOwRU6lh6FU9buVJDwlAAkXEnuZFYpOsBAqQ%3D"
}
```

**Campos clave de la respuesta para persistir en la tabla `CfeDocument`:**
`id` (id interno FEU), `serie`, `numero`, `hash`, `cae_numero`, `cae_rango_inicio/final`, `cae_vencimiento`, `url` (para el QR), `importe_total`.

### Idempotencia — CRÍTICO para el POS offline ✅ VERIFICADO
- El campo `id_externo` es un **token de idempotencia**. Si se reintenta un `crear` con el mismo `id_externo` y los mismos parámetros tras un éxito, FEU devuelve el comprobante original en vez de duplicar.
- **Regla de arquitectura:** `id_externo` = el `sale_id` (uuid) de la tabla de ventas del SaaS. Así, cuando el POS recupera conexión y reintenta emitir una venta encolada, nunca se factura dos veces.
- Se puede recuperar por este id: `GET /comprobantes/e/{id_externo}`.

---

## 4. IVA y regímenes fiscales — mapeo al modelo de datos ✅ VERIFICADO

### `indicador_facturacion` (por ítem) → tasa de IVA
| Valor | Significado | Uso en verdulería |
|---|---|---|
| 1 | Exento de IVA | Productos exentos |
| **2** | **Tasa mínima (10%)** | **Frutas y verduras (la mayoría del catálogo)** |
| 3 | Tasa básica (22%) | Productos elaborados/envasados |
| 12 | IVA en suspenso | Compras a productores (cadena) |

→ En el modelo `Product`, el campo `tasaIva` mapea directo a `indicador_facturacion`. Una verdulería usa mayormente `2`.

### `cod_montos_brutos` (por comprobante) → régimen fiscal
| Valor | Significado |
|---|---|
| **1** | Líneas van con **IVA incluido** (caso normal Régimen General / IVA mínimo con IVA en el precio) |
| 2 | Líneas con IMEBA y adicionales incluidos |
| **3** | Ventas de contribuyentes con **obligación IVA mínimo, Monotributo o Monotributo MIDES** |

→ **Este es el switch que permite servir a los dos regímenes con el mismo código.** El adaptador debe elegir `cod_montos_brutos` según el régimen fiscal configurado en el tenant. Para verdulería estándar con precios que ya incluyen IVA: `1`.

---

## 5. Descarga de PDF — EL HALLAZGO NO OBVIO ✅ VERIFICADO

**El endpoint `/comprobantes/{id}/pdf` NO devuelve el PDF binario.** Devuelve un JSON con `Content-Type: application/json` y el PDF codificado en base64:

```json
{
  "file_name": "e-Ticket A0000881.pdf",
  "mime_type": "application/pdf",
  "format": "base64",
  "data": "JVBERi0xLjQK..."   // <- el PDF real en base64 (JVBERi0x = "%PDF-1." en base64)
}
```

**Cómo procesarlo correctamente (Node):**
```js
const respuesta = await res.json();
if (respuesta.format === "base64" && respuesta.data) {
  const buffer = Buffer.from(respuesta.data, "base64");
  // buffer.subarray(0,4).toString("latin1") === "%PDF"  -> válido
  fs.writeFileSync(rutaPdf, buffer);
}
```

**Errores que esto causa si no se sabe:**
- Guardar la respuesta como binario directo → PDF corrupto ("no se puede abrir este archivo").
- Es probable que otros endpoints binarios de FEU (si los hubiera) usen el mismo patrón JSON+base64.

**Para el adaptador:** el método `obtenerPdf()` debe parsear el JSON, decodificar `data` de base64 y devolver el Buffer. Aprovechar `file_name` (nombre sugerido) y `mime_type`. Parámetro `?tipo=ticket80` para impresora térmica 80mm; sin él, A4.

---

## 6. Consulta de estado DGI (polling) ✅ VERIFICADO

```
GET /consulta/comprobantes/emitidos?FechaDesde=AAAA-MM-DD&FechaHasta=AAAA-MM-DD
Authorization: Bearer <token>
X-Emisor: <RUT>
```

### Estados DGI (tabla oficial)
| Código | Significado |
|---|---|
| **NE** | No enviado / sin respuesta de DGI todavía (estado transitorio inicial) |
| **AE** | Aceptado por DGI (comprobante recibido) — estado final OK |
| **BE** | Rechazado por DGI — estado final de error |
| **CE** | Observado (CFC) |

**Comportamiento verificado:** al consultar inmediatamente después de emitir, el comprobante aparece con `estado_dgi.codigo = "NE"`. Minutos después pasa a `AE`. Esto **confirma la necesidad de polling**.

### Regla de arquitectura para el polling
- Al emitir, persistir el CFE con estado `NE`.
- Encolar un job que reconsulte el estado tras el intervalo mínimo permitido por DGI (⚠️ PENDIENTE confirmar el intervalo exacto con Surtec; "está medido por DGI").
- Reintentar hasta que el estado sea final (`AE`, `BE` o `CE`), con backoff.
- Cuando Surtec libere el **webhook** (en desarrollo), reemplazar el polling por recepción de evento sin tocar el resto del sistema (por eso el adaptador debe abstraer "obtener estado").

---

## 7. Consulta de compras (facturas recibidas) ✅ documentado

```
GET /consulta/comprobantes/recibidos?FechaDesde=...&Emisor[]=<RUT_proveedor>&EstadoDgi[]=AE
X-Emisor: <RUT_receptor>
```
Devuelve las facturas que el cliente recibió de sus proveedores (útil para el módulo de compras: conciliar lo comprado en la UAM/proveedores contra los CFE recibidos). Filtros repetibles con `[]`. Trae `emisor`, `totales` (con desglose de IVA mínimo/básico), `items`, `cae`, `estado`.

---

## 8. Tipos de comprobante (tabla DGI) — los que importan para verdulería

| Código | Tipo | Uso |
|---|---|---|
| **101** | e-Ticket | **Venta de mostrador a consumidor final (el 95% de la operación)** |
| 102 | NC de e-Ticket | Anulación/devolución de ticket |
| 103 | ND de e-Ticket | Nota de débito de ticket |
| **111** | e-Factura | **Venta mayorista a cliente con RUC (restaurantes, hoteles)** |
| 112 | NC de e-Factura | Nota de crédito mayorista |
| 113 | ND de e-Factura | Nota de débito mayorista |
| **181** | e-Remito | **Reparto/traslado de mercadería (módulo delivery)** |
| 182 | e-Resguardo | Retenciones |

Habilitados en test (según correo Surtec): e-factura y sus NC/ND, e-ticket y sus NC/ND, e-factura de exportación, e-resguardos, e-ticket por cuenta ajena, e-factura de contingencia. Otros se habilitan a pedido.

### Cliente obligatorio
El objeto `cliente` es obligatorio para: e-Ticket > 5.000 UI, e-Factura (111) y e-Boleta de entrada. Para e-Ticket de consumidor final por debajo de ese monto, se puede omitir.

Tipos de documento del cliente: 1=NIE, **2=RUC (UY)**, **3=CI (UY)**, 4=Otros, 5=Pasaporte, 6=DNI (AR/BR/CL/PY), 7=NIFE.

---

## 9. Contingencia (offline) ✅ aclarado por Surtec

- Si se cae internet/DGI, **no se puede emitir un e-Ticket normal**; solo el **comprobante de contingencia** (e-ticket de contingencia, habilitado en test).
- Surtec reporta que en 15 años casi no se da; suele ser problema del lado del cliente (sin luz/internet).
- **Estrategia para el POS offline:** el POS sigue vendiendo y **encola la emisión del CFE** para cuando vuelva la conexión (usando `id_externo`=`sale_id` para idempotencia). La contingencia formal queda como caso extremo.
- Si el cliente final pide comprobante estando sin conexión, solo puede ser por contingencia.

---

## 10. Diseño del adaptador `CfeProvider` (guía para implementar)

Interfaz común (para que FEU sea intercambiable con Host Factura u otros a futuro):

```ts
interface CfeProvider {
  emitir(tenantRut: string, cfe: CfeInput): Promise<CfeResult>;      // POST /comprobantes/crear
  consultarEstado(tenantRut: string, cfeId: number): Promise<EstadoDgi>; // GET /consulta/.../emitidos
  obtenerPdf(tenantRut: string, cfeId: number, tipo?: 'A4'|'ticket80'): Promise<Buffer>; // parsea JSON+base64
  consultarPorIdExterno(tenantRut: string, idExterno: string): Promise<CfeResult>;
  consultarActividadEmpresarial(rut: string): Promise<EmpresaDatos>;  // para onboarding
}

class FeuProvider implements CfeProvider { /* ... */ }
```

Responsabilidades internas del `FeuProvider`:
1. **Gestión de token:** cachear access_token, renovar con refresh_token ante 401.
2. **Header `X-Emisor`:** siempre el RUT del tenant en cada request.
3. **Idempotencia:** `id_externo = sale_id`.
4. **PDF:** parsear JSON → decodificar base64 → Buffer.
5. **Polling de estado:** job en cola que reconsulta NE→final.
6. **Mapeo de datos:** `Sale` + `SaleItem` → payload FEU; `tasaIva` → `indicador_facturacion`; régimen del tenant → `cod_montos_brutos`.

### Onboarding de un tenant nuevo
1. Cliente ingresa su RUT → `consultarActividadEmpresarial(rut)` autocompleta razón social/dirección.
2. Surtec gestiona el certificado digital (trámite Abitab) → se carga vía `/certificado/importar`.
3. Configurar régimen fiscal del tenant (define `cod_montos_brutos`).
4. Emisión de prueba en test → validar → pasar a producción.

---

## 11. Pendientes / a confirmar con Surtec (soporte@surtec.com.uy, WhatsApp +598 92 878 855)

- ⚠️ URLs exactas de **producción** (auth y api).
- ⚠️ **Intervalo mínimo de polling** medido por DGI (para no ser bloqueado).
- ⚠️ Fecha estimada del **webhook** de estado (para reemplazar polling).
- ⚠️ **Rate limit** exacto de la API (Surtec dijo "es bueno, sin que te dé tiempo a crear tantas facturas", pero conviene el número).
- ⚠️ Flujo exacto de **carga de certificado** en producción (formato del archivo, clave privada).
- ⚠️ Confirmar el `scope` en el login: en el Postman original aparece `scope: <RUT>` en el body del token; en la doc pública no figura. Verificar si es necesario para multi-RUT o si alcanza con `X-Emisor` por request. (En las pruebas funcionó SIN scope, solo con X-Emisor.)

---

## 12. Estado de la validación

| Ítem | Estado |
|---|---|
| Autenticación (password + refresh) | ✅ Verificado |
| Emisión de e-Ticket (101) con IVA mínimo | ✅ Verificado (CAE real de DGI) |
| Idempotencia por id_externo | ✅ Verificado |
| Consulta de estado DGI (NE→AE) | ✅ Verificado |
| Descarga PDF (JSON+base64, ticket80) | ✅ Verificado (abre correctamente) |
| Multi-RUT por X-Emisor | ✅ Confirmado (doc + Surtec) |
| e-Factura (111) con receptor RUC | ⚠️ Documentado, no probado aún |
| e-Remito (181) para reparto | ⚠️ Documentado, no probado aún |
| Notas de crédito (102/112) | ⚠️ Documentado, no probado aún |
| Carga de certificado | ⚠️ No probado |
| Ambiente de producción | ⚠️ No probado |

---

*Documento generado a partir de pruebas reales contra api-test.facturaelectronica.com.uy. Script de prueba: `test-feu.mjs`. Diagnóstico de PDF: `diag.mjs`.*
