import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

/**
 * Cliente mínimo de la API de Mercado Pago (REST, sin SDK). En la Fase 1 solo
 * necesitamos validar el Access Token del tenant contra /users/me. La creación
 * de preferencias de Checkout Pro y la consulta de pagos llegan en la Parte 2.
 */

const MP_API = 'https://api.mercadopago.com';

export interface MpUsuario {
  id: number;
  nickname?: string;
  email?: string;
  site_id?: string; // "MLU" para Uruguay
  tags?: string[]; // incluye "test_user" en las cuentas de prueba
}

/**
 * Los tokens de prueba (sandbox) empiezan con `TEST-`; los productivos con
 * `APP_USR-`. Derivamos el ambiente del prefijo para no pedirlo aparte.
 */
export function ambienteDeToken(accessToken: string): 'test' | 'produccion' {
  return accessToken.trim().startsWith('TEST-') ? 'test' : 'produccion';
}

/**
 * ¿La cuenta es un usuario de prueba de MP? Es la señal CONFIABLE de ambiente:
 * los test users traen `tags: ["test_user"]`, aunque su token OAuth reporte
 * `live_mode: true`. Si es de prueba, hay que usar el checkout sandbox.
 */
export function esCuentaTest(usuario: MpUsuario): boolean {
  return Array.isArray(usuario.tags) && usuario.tags.includes('test_user');
}

export interface MpPreferenceItem {
  id?: string;
  title: string;
  description?: string;
  category_id?: string;
  quantity: number;
  unit_price: number;
  currency_id: string; // "UYU"
}

export interface MpPreferencePayer {
  name?: string;
  surname?: string;
  email?: string;
  phone?: { area_code?: string; number?: string };
}

export interface MpPreferenceInput {
  items: MpPreferenceItem[];
  payer?: MpPreferencePayer;
  external_reference: string;
  notification_url?: string;
  back_urls?: { success?: string; failure?: string; pending?: string };
  auto_return?: 'approved';
  metadata?: Record<string, unknown>;
  statement_descriptor?: string;
}

export interface MpPreference {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

export interface MpPago {
  id: number;
  status: string; // approved | pending | rejected | cancelled | refunded | …
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
}

/** Valida el Access Token trayendo la cuenta asociada. Lanza 400 si es inválido. */
export async function mpGetUsuario(accessToken: string): Promise<MpUsuario> {
  let res: Response;
  try {
    res = await fetch(`${MP_API}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new BadRequestException('No se pudo contactar a Mercado Pago. Revisá la conexión e intentá de nuevo.');
  }
  if (res.status === 401 || res.status === 403) {
    throw new BadRequestException('El Access Token de Mercado Pago no es válido o no tiene permisos.');
  }
  if (!res.ok) {
    throw new BadRequestException('Mercado Pago rechazó la validación. Probá de nuevo en unos minutos.');
  }
  const data = (await res.json()) as MpUsuario;
  if (data.site_id && data.site_id !== 'MLU') {
    throw new BadRequestException(`La cuenta de Mercado Pago es de ${data.site_id}, no de Uruguay (MLU).`);
  }
  return data;
}

/** Crea una preferencia de Checkout Pro y devuelve los links de pago. */
export async function mpCrearPreferencia(accessToken: string, input: MpPreferenceInput): Promise<MpPreference> {
  let res: Response;
  try {
    res = await fetch(`${MP_API}/checkout/preferences`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new BadRequestException('No se pudo contactar a Mercado Pago para iniciar el pago.');
  }
  if (!res.ok) {
    throw new BadRequestException('Mercado Pago rechazó la creación del pago. Revisá tus credenciales.');
  }
  return (await res.json()) as MpPreference;
}

// --- OAuth ("Conectar con Mercado Pago") -----------------------------------

export interface MpOAuthTokens {
  access_token: string;
  refresh_token: string;
  user_id: number;
  expires_in: number; // segundos
  public_key?: string;
  live_mode?: boolean;
}

/** URL de autorización a la que se manda al vendedor para vincular su cuenta. */
export function mpAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    platform_id: 'mp',
    state,
    redirect_uri: redirectUri,
  });
  return `https://auth.mercadopago.com.uy/authorization?${p.toString()}`;
}

/** Intercambia el "code" del callback por los tokens del vendedor. */
export async function mpOAuthExchange(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<MpOAuthTokens> {
  return oauthToken({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
  });
}

/** Renueva el access token de un vendedor usando su refresh token. */
export async function mpOAuthRefresh(input: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<MpOAuthTokens> {
  return oauthToken({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
  });
}

async function oauthToken(body: Record<string, string>): Promise<MpOAuthTokens> {
  let res: Response;
  try {
    res = await fetch(`${MP_API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new BadRequestException('No se pudo contactar a Mercado Pago para la vinculación.');
  }
  if (!res.ok) {
    throw new BadRequestException('Mercado Pago rechazó la vinculación. Volvé a intentar la conexión.');
  }
  return (await res.json()) as MpOAuthTokens;
}

/**
 * Reembolsa un pago (total si no se pasa `amount`, parcial si se pasa). Devuelve
 * true si MP lo aceptó. Usa X-Idempotency-Key para evitar dobles reembolsos.
 */
export async function mpReembolsar(accessToken: string, pagoId: string, amount?: number): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(pagoId)}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': randomUUID(),
      },
      body: amount != null ? JSON.stringify({ amount }) : '{}',
    });
  } catch {
    throw new BadRequestException('No se pudo contactar a Mercado Pago para el reembolso.');
  }
  if (!res.ok) {
    throw new BadRequestException('Mercado Pago rechazó el reembolso. Revisá el estado del pago e intentá de nuevo.');
  }
}

// --- Point (cobro presencial con lector) -----------------------------------

export interface MpPointDevice {
  id: string;
  operating_mode?: string; // "PDV" (integrado) | "STANDALONE"
}

export interface MpPointIntent {
  id: string;
  state?: string; // OPEN | ON_TERMINAL | PROCESSING | FINISHED | CANCELED | ERROR | ABANDONED
  payment?: { id?: number | string; status?: string };
}

const POINT = `${MP_API}/point/integration-api`;

/** Lista los lectores Point asociados a la cuenta. */
export async function mpPointDispositivos(accessToken: string): Promise<MpPointDevice[]> {
  let res: Response;
  try {
    res = await fetch(`${POINT}/devices?limit=50`, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch {
    throw new BadRequestException('No se pudo contactar a Mercado Pago Point.');
  }
  if (!res.ok) throw new BadRequestException('No se pudieron listar los lectores Point de la cuenta.');
  const data = (await res.json()) as { devices?: MpPointDevice[] };
  return data.devices ?? [];
}

/** Pone un lector en modo integrado (PDV) o autónomo (STANDALONE). */
export async function mpPointModo(accessToken: string, deviceId: string, modo: 'PDV' | 'STANDALONE'): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${POINT}/devices/${encodeURIComponent(deviceId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ operating_mode: modo }),
    });
  } catch {
    throw new BadRequestException('No se pudo configurar el lector Point.');
  }
  if (!res.ok) throw new BadRequestException('Mercado Pago no pudo poner el lector en modo integrado.');
}

/** Crea una intención de pago en el lector (monto en centavos). */
export async function mpPointCrearIntent(
  accessToken: string,
  deviceId: string,
  amountCents: number,
  externalRef: string,
): Promise<MpPointIntent> {
  let res: Response;
  try {
    res = await fetch(`${POINT}/devices/${encodeURIComponent(deviceId)}/payment-intents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountCents, additional_info: { external_reference: externalRef, print_on_terminal: true } }),
    });
  } catch {
    throw new BadRequestException('No se pudo enviar el cobro al lector Point.');
  }
  if (!res.ok) throw new BadRequestException('Mercado Pago rechazó el cobro en el lector. Revisá que esté encendido y en línea.');
  return (await res.json()) as MpPointIntent;
}

/** Estado de una intención de pago (para el POS mientras espera el pago). */
export async function mpPointGetIntent(accessToken: string, intentId: string): Promise<MpPointIntent | null> {
  let res: Response;
  try {
    res = await fetch(`${POINT}/payment-intents/${encodeURIComponent(intentId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  return (await res.json()) as MpPointIntent;
}

/** Cancela una intención de pago pendiente en el lector. */
export async function mpPointCancelarIntent(accessToken: string, deviceId: string, intentId: string): Promise<void> {
  try {
    await fetch(`${POINT}/devices/${encodeURIComponent(deviceId)}/payment-intents/${encodeURIComponent(intentId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    /* best-effort: si falla, el lector igual expira la intención solo */
  }
}

/** Consulta el estado de un pago por su id (usado por el webhook). */
export async function mpGetPago(accessToken: string, pagoId: string): Promise<MpPago | null> {
  let res: Response;
  try {
    res = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(pagoId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  return (await res.json()) as MpPago;
}
