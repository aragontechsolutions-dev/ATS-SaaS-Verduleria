// ============================================================================
// Normalización de teléfonos de Uruguay a formato internacional +598.
// Pura y testeable. El cliente puede escribir de varias formas y siempre se
// guarda igual: 09XXXXXXX → +5989XXXXXXX (móvil), 2XXXXXXX → +5982XXXXXXX (fijo).
// ============================================================================

/**
 * Devuelve el teléfono en formato +598######## (8 dígitos nacionales), o null
 * si no es un número uruguayo válido. Acepta: con/sin +598, con/sin 0 inicial,
 * con espacios, guiones o paréntesis, y el prefijo 00598.
 */
export function normalizarTelefonoUy(raw: string | undefined | null): string | null {
  let d = (raw ?? '').replace(/\D/g, ''); // deja solo dígitos
  if (!d) return null;

  if (d.startsWith('00598')) d = d.slice(5);
  else if (d.startsWith('598')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.replace(/^0+/, ''); // quita el/los 0 de trunk

  // El número nacional uruguayo tiene 8 dígitos (móvil 9XXXXXXX, fijo 2/4XXXXXXX).
  if (d.length !== 8) return null;
  return `+598${d}`;
}

/** ¿El texto ya es un teléfono uruguayo válido (una vez normalizado)? */
export function esTelefonoUyValido(raw: string | undefined | null): boolean {
  return normalizarTelefonoUy(raw) !== null;
}
