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
  horarios: { mostrar: boolean; texto: string; direccion: string; mapaUrl: string };
  contacto: { mostrar: boolean; whatsapp: string; telefono: string; instagram: string; facebook: string };
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
