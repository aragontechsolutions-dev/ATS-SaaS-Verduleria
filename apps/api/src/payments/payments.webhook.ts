/**
 * Extrae el id de pago de una notificación de Mercado Pago. MP notifica de
 * varias formas: querystring `?type=payment&data.id=123` o `?topic=payment&id=123`,
 * y/o body `{ type:'payment', data:{ id } }` o `{ action:'payment.created', ... }`.
 * Solo nos interesan los eventos de tipo "payment". Función pura (testeable).
 */
export function extraerPagoId(
  body: Record<string, unknown> | null | undefined,
  query: Record<string, unknown> | null | undefined,
): string | null {
  const q = query ?? {};
  const b = body ?? {};
  const tipo = String(q['type'] ?? q['topic'] ?? (b as { type?: string }).type ?? '').toLowerCase();
  const esPago = tipo === 'payment' || String((b as { action?: string }).action ?? '').startsWith('payment.');
  if (!esPago) return null;
  const data = (b as { data?: { id?: unknown } }).data;
  const id = q['data.id'] ?? q['id'] ?? data?.id;
  return id != null && String(id).length > 0 ? String(id) : null;
}
