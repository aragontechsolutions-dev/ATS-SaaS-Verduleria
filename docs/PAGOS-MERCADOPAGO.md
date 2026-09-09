# Cobros online — Mercado Pago (Checkout Pro + OAuth)

Guía de puesta en marcha y de onboarding de clientes para el cobro online.

## Modelo

- **Pasarela de paso, no facilitador**: cada verdulería cobra en **su propia
  cuenta** de Mercado Pago. El dinero va directo a ella; Aragon no toca la plata.
- **Checkout Pro con preferencias**: al pagar, la API crea una *preferencia*
  (`/checkout/preferences`) en la cuenta del comercio y redirige al cliente. MP
  confirma por **webhook**.
- **OAuth ("Conectar con Mercado Pago")**: el comercio vincula su cuenta en un
  clic; el token se guarda cifrado y se **renueva solo** (refresh token). Aragon
  gestiona la conexión desde la **Consola**; el panel del comercio es solo lectura.

## Setup por única vez (plataforma / Aragon)

### 1. Crear la aplicación de MP

En https://www.mercadopago.com.uy/developers → **Tus integraciones → Crear
aplicación**:

- Producto: **Checkout Pro** → **API de Preferencias** (no "API de Orders").
- **Configuración de la aplicación → Configuración avanzada**:
  - **URL de redireccionamiento (OAuth)**: `https://<API>/api/public/pagos/mp/oauth/callback`
    (una sola barra; debe coincidir **exacto** con `MP_OAUTH_REDIRECT_URI`).
  - **PKCE**: No.
  - **Permisos**: `read`, `offline access`, `write` (el `offline access` es el
    que habilita el refresh token; no quitarlo).
- Anotar **Client ID** (= número de la app) y **Client Secret**
  (Credenciales → "Ver datos de la credencial"). El Client Secret es el mismo
  para prueba y producción.

### 2. Variables de entorno (Render, servicio de la API)

| Variable | Valor | Obligatoria |
|---|---|---|
| `PAYMENTS_ENC_KEY` | secreto fuerte y **estable** (cifra los tokens) | Sí (si falta, cae al service-role de Supabase) |
| `API_PUBLIC_URL` | `https://<API>` (sin barra final) | Sí (webhook) |
| `MP_OAUTH_CLIENT_ID` | Client ID de la app | Sí |
| `MP_OAUTH_CLIENT_SECRET` | Client Secret de la app | Sí |
| `MP_OAUTH_REDIRECT_URI` | `https://<API>/api/public/pagos/mp/oauth/callback` | Recomendada (si falta, se arma con `API_PUBLIC_URL`) |

### 3. Base de datos (Supabase)

Correr, en orden:

- `packages/database/prisma/migrations/sql/2026_tenant_payment_config.sql`
- `packages/database/prisma/migrations/sql/2026_mp_oauth.sql`

Ambos son seguros de re-ejecutar (`IF NOT EXISTS`).

## Onboarding de un cliente (por cada verdulería)

1. **Consola** → fila del cliente → **Pagos** → **Generar enlace de conexión**.
2. Pasarle el enlace al comercio (WhatsApp/mail). Lo abre, inicia sesión en **su**
   cuenta de Mercado Pago y **autoriza** → ve "¡Cuenta conectada!".
3. En la Consola, el estado pasa a **Conectado**. Tocar el check **"Ofrecer pago
   online en la tienda"**.
4. Listo: en la tienda del comercio aparece **"Pagar con Mercado Pago"**.

El comercio nunca ve ni toca tokens. Para reconectar (si cambió de cuenta),
generás un enlace nuevo.

## Probar con cuentas de prueba (sin plata real)

1. En la app de MP → **Cuentas de prueba** → crear una **vendedora** y una
   **compradora**.
2. Generar el enlace de conexión desde la Consola y abrirlo en **incógnito**;
   autorizar con la cuenta **vendedora** de prueba. Queda en ambiente **Prueba**.
3. Activar el cobro. Hacer un pedido en la tienda y pagar con la cuenta
   **compradora** de prueba + [tarjeta de prueba](https://www.mercadopago.com.uy/developers/es/docs/checkout-pro/additional-content/test-cards)
   (titular `APRO` = aprobado).
4. El seguimiento del pedido debe mostrar **"Pago confirmado"**.

## Cómo funciona por dentro

- `POST /api/public/tienda/:slug/pedido/:codigo/pagar` → crea la preferencia y
  devuelve `checkoutUrl` (init_point o sandbox_init_point según ambiente).
- `POST /api/public/pagos/mp/:secret` → webhook: valida el pago contra MP con el
  token del tenant dueño del `webhookSecret`; si está aprobado, marca el pedido
  pagado (idempotente).
- `GET /api/public/pagos/mp/oauth/callback` → cierra el OAuth (intercambia el
  code por los tokens y los guarda cifrados).
- El access token OAuth se **refresca** automáticamente antes de cobrar cuando
  está por vencer.

## Problemas frecuentes

- **redirect_uri mismatch**: la URL registrada en MP no es idéntica a
  `MP_OAUTH_REDIRECT_URI` (ojo con barras dobles o `http` vs `https`).
- **El pago se crea pero no se confirma solo**: falta `API_PUBLIC_URL` (MP no
  puede llamar al webhook).
- **"No hay pasarela / cobro no activo"**: falta activar el gate en la Consola,
  o el token no está (reconectar).
- **El panel de credenciales de MP tira "Algo salió mal"**: es del lado de MP;
  el Client Secret también aparece en **Credenciales de producción**.
