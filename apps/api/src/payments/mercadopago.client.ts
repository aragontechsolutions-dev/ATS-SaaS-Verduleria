import { BadRequestException } from '@nestjs/common';

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
}

/**
 * Los tokens de prueba (sandbox) empiezan con `TEST-`; los productivos con
 * `APP_USR-`. Derivamos el ambiente del prefijo para no pedirlo aparte.
 */
export function ambienteDeToken(accessToken: string): 'test' | 'produccion' {
  return accessToken.trim().startsWith('TEST-') ? 'test' : 'produccion';
}

export interface MpPreferenceItem {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: string; // "UYU"
}

export interface MpPreferenceInput {
  items: MpPreferenceItem[];
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
