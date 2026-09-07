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
