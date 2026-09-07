import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Cifrado simétrico para credenciales de pago (ej. Access Token de Mercado
 * Pago). AES-256-GCM: confidencialidad + integridad (el tag detecta
 * manipulación). La clave se deriva por SHA-256 del secreto de entorno, así
 * cualquier string fuerte sirve como PAYMENTS_ENC_KEY.
 *
 * Formato: `v1:<ivB64>:<tagB64>:<cipherB64>`.
 */

function derivarClave(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function cifrar(texto: string, secret: string): string {
  if (!secret) throw new Error('Falta la clave de cifrado (PAYMENTS_ENC_KEY).');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', derivarClave(secret), iv);
  const enc = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function descifrar(payload: string, secret: string): string {
  if (!secret) throw new Error('Falta la clave de cifrado (PAYMENTS_ENC_KEY).');
  const partes = payload.split(':');
  if (partes.length !== 4 || partes[0] !== 'v1') throw new Error('Formato de cifrado desconocido.');
  const [, ivB, tagB, dataB] = partes;
  const d = createDecipheriv('aes-256-gcm', derivarClave(secret), Buffer.from(ivB, 'base64'));
  d.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([d.update(Buffer.from(dataB, 'base64')), d.final()]).toString('utf8');
}

/** Devuelve una pista enmascarada del token para mostrar sin revelarlo. */
export function enmascarar(token: string): string {
  if (!token) return '';
  const cola = token.slice(-4);
  return `••••••••${cola}`;
}

/** Comparación en tiempo constante (para secretos de webhook). */
export function igualSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
