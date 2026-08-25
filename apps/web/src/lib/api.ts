const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export interface LandingProducto {
  nombre: string;
  precio: string;
  imagenUrl: string;
}

export interface LandingConfig {
  tema: { color: string };
  hero: { mostrar: boolean; titulo: string; lema: string; imagenUrl: string };
  productos: { mostrar: boolean; titulo: string; items: LandingProducto[] };
  horarios: { mostrar: boolean; texto: string; direccion: string; mapaUrl: string; lat: number; lng: number };
  contacto: { mostrar: boolean; whatsapp: string; telefono: string; instagram: string; facebook: string };
}

/** URL de mapa embebido de OpenStreetMap (sin API key) con un marcador. */
export function osmEmbedUrl(lat: number, lng: number): string {
  const d = 0.004;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lng}`;
}

export function tieneUbicacion(lat: number, lng: number): boolean {
  return lat !== 0 || lng !== 0;
}

/**
 * URL de Google Maps para ir hasta el local: abre las indicaciones y permite
 * iniciar la navegación. En el celu deep-linkea a la app de Google Maps.
 */
export function gmapsDirUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export interface PublicLanding {
  nombre: string;
  config: LandingConfig;
}

export class NotFoundError extends Error {}

/** Landing pública de una verdulería por slug. 404 si no existe o no está publicada. */
export async function getPublicLanding(slug: string): Promise<PublicLanding> {
  const res = await fetch(`${API_BASE}/public/landing/${encodeURIComponent(slug)}`);
  if (res.status === 404) throw new NotFoundError('Página no encontrada');
  if (!res.ok) throw new Error(`landing HTTP ${res.status}`);
  return res.json() as Promise<PublicLanding>;
}
