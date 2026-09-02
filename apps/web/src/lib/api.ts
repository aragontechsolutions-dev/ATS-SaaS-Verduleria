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
  /** La tienda online (e-commerce) está activa: mostrar el CTA "Comprar online". */
  tiendaActiva?: boolean;
}

export class NotFoundError extends Error {}

/** Landing pública de una verdulería por slug. 404 si no existe o no está publicada. */
export async function getPublicLanding(slug: string): Promise<PublicLanding> {
  const res = await fetch(`${API_BASE}/public/landing/${encodeURIComponent(slug)}`);
  if (res.status === 404) throw new NotFoundError('Página no encontrada');
  if (!res.ok) throw new Error(`landing HTTP ${res.status}`);
  return res.json() as Promise<PublicLanding>;
}

// --- Tienda online (e-commerce público) -------------------------------------

export interface StoreProduct {
  id: string;
  nombre: string;
  descripcionOnline: string | null;
  categoriaId: string | null;
  categoriaNombre: string | null;
  unidadVenta: string;
  esPesable: boolean;
  /** Precio de mostrador con IVA (por kg si es pesable). */
  precio: number;
  imagenUrl: string | null;
  /** Hay stock para pedir. */
  disponible: boolean;
}

export interface StoreZone {
  id: string;
  nombre: string;
  costoEnvio: number;
  pedidoMinimo: number;
}

export interface StorePublicConfig {
  deliveryActivo: boolean;
  pickupActivo: boolean;
  franjas: string[];
  notaCheckout: string | null;
}

export interface StoreCatalog {
  nombre: string;
  slug: string;
  config: StorePublicConfig;
  zonas: StoreZone[];
  categorias: Array<{ id: string; nombre: string }>;
  productos: StoreProduct[];
}

/** Catálogo de la tienda online por slug. 404 si la tienda no está activa. */
export async function getStoreCatalog(slug: string): Promise<StoreCatalog> {
  const res = await fetch(`${API_BASE}/public/tienda/${encodeURIComponent(slug)}/catalogo`);
  if (res.status === 404) throw new NotFoundError('Tienda no encontrada');
  if (!res.ok) throw new Error(`tienda HTTP ${res.status}`);
  return res.json() as Promise<StoreCatalog>;
}

export type TipoEntrega = 'DELIVERY' | 'PICKUP';

export interface CreateOrderInput {
  tipoEntrega: TipoEntrega;
  zonaId?: string;
  franja?: string;
  clienteNombre: string;
  clienteTelefono: string;
  direccion?: string;
  notas?: string;
  items: Array<{ productId: string; cantidad: number }>;
}

export interface OrderResult {
  id: string;
  numero: number;
  codigo: string;
  estado: string;
  total: number;
}

/** Crea un pedido en la tienda online. Lanza Error con el mensaje del backend si falla. */
export async function createOrder(slug: string, input: CreateOrderInput): Promise<OrderResult> {
  const res = await fetch(`${API_BASE}/public/tienda/${encodeURIComponent(slug)}/pedido`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const msg = Array.isArray(body.message) ? body.message.join(' · ') : body.message;
    throw new Error(msg || `No se pudo crear el pedido (HTTP ${res.status})`);
  }
  return res.json() as Promise<OrderResult>;
}

export interface OrderItemView {
  concepto: string;
  unidad: string;
  esPesable: boolean;
  cantidad: number;
  precioUnit: number;
  subtotal: number;
}

export interface OrderView {
  numero: number;
  codigo: string;
  estado: string;
  tipoEntrega: TipoEntrega;
  zonaNombre: string | null;
  franja: string | null;
  clienteNombre: string;
  direccion: string | null;
  notas: string | null;
  subtotal: number;
  costoEnvio: number;
  total: number;
  createdAt: string;
  items: OrderItemView[];
}

/** Seguimiento de un pedido por su código público. */
export async function getOrder(slug: string, codigo: string): Promise<OrderView> {
  const res = await fetch(`${API_BASE}/public/tienda/${encodeURIComponent(slug)}/pedido/${encodeURIComponent(codigo)}`);
  if (res.status === 404) throw new NotFoundError('Pedido no encontrado');
  if (!res.ok) throw new Error(`pedido HTTP ${res.status}`);
  return res.json() as Promise<OrderView>;
}
