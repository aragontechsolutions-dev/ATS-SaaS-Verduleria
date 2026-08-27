// ============================================================================
// Umbral de identificación del comprador (regla DGI).
//
// En Uruguay, un e-Ticket cuyo total supera 5.000 UI obliga a identificar al
// comprador (documento). La UI (Unidad Indexada) cambia a diario, así que el
// valor en pesos se configura por env; el default es una estimación 2026
// (5.000 UI ≈ $31.000). Ajustá VITE_UMBRAL_IDENTIFICACION_UYU según la UI vigente.
// ============================================================================

const raw = Number(import.meta.env.VITE_UMBRAL_IDENTIFICACION_UYU);
export const UMBRAL_IDENTIFICACION_UYU = Number.isFinite(raw) && raw > 0 ? raw : 31000;

/** ¿La venta obliga a identificar al comprador por superar el umbral? */
export function requiereIdentificacion(total: number): boolean {
  return total >= UMBRAL_IDENTIFICACION_UYU;
}
