import { randomInt } from 'node:crypto';

// Alfabetos sin caracteres ambiguos (0/O, 1/l/I) para que sea legible al dictarlo.
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const ALL = LOWER + UPPER + DIGITS;

/**
 * Genera una contraseña temporal fuerte (por defecto 16 caracteres, ~90 bits de
 * entropía) con al menos una minúscula, una mayúscula y un dígito. Usa el RNG
 * criptográfico del sistema. Pensada para entregarse una sola vez y cambiarse.
 */
export function generateTempPassword(length = 16): string {
  const pick = (set: string): string => set[randomInt(set.length)];
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(ALL));
  // Fisher-Yates para no dejar las clases garantizadas siempre al inicio.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
