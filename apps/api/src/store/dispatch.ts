// ============================================================================
// Motor de asignación de reparto (funciones PURAS, testeables con node:test).
//
// Regla (definida con el negocio): un pedido despachado se asigna al repartidor
// LIBRE más cercano al LOCAL (así vuelve rápido a buscar el próximo). Si no hay
// ninguno libre, el pedido queda en cola (FIFO) y se asigna cuando un repartidor
// se libera. Con un solo repartidor, todo se le encola.
// ============================================================================

export interface Punto {
  lat: number;
  lng: number;
}

export interface RepartidorLibre {
  userId: string;
  lat?: number | null;
  lng?: number | null;
}

const R_TIERRA_KM = 6371;
const rad = (g: number) => (g * Math.PI) / 180;

/** Distancia en km entre dos puntos (fórmula de haversine). */
export function haversineKm(a: Punto, b: Punto): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Elige el repartidor libre más cercano al local. Los repartidores sin
 * ubicación (o si el local no tiene coordenadas) van al final, pero pueden
 * ser elegidos si son los únicos. `libres` debe venir ordenado por preferencia
 * de desempate (ej. el que hace más rato que está libre, primero).
 * Devuelve el userId elegido, o null si no hay ninguno libre.
 */
export function elegirRepartidor(libres: RepartidorLibre[], local: Punto | null): string | null {
  if (libres.length === 0) return null;
  const conDist = libres.map((r, i) => {
    const tieneCoords = local && r.lat != null && r.lng != null;
    const dist = tieneCoords ? haversineKm(local, { lat: r.lat as number, lng: r.lng as number }) : Number.POSITIVE_INFINITY;
    return { userId: r.userId, dist, i };
  });
  // Menor distancia primero; ante empate, respeta el orden de entrada (FIFO).
  conDist.sort((a, b) => a.dist - b.dist || a.i - b.i);
  return conDist[0].userId;
}
