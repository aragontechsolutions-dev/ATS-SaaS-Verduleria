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

export interface StoreLocal {
  lat: number;
  lng: number;
  direccion: string | null;
}

export interface StoreCatalog {
  nombre: string;
  slug: string;
  config: StorePublicConfig;
  /** Ubicación del local (mapa del checkout + "cómo llegar" en retiro). Null si no está cargada. */
  local: StoreLocal | null;
  zonas: StoreZone[];
  categorias: Array<{ id: string; nombre: string }>;
  productos: StoreProduct[];
}

/**
 * Normaliza un teléfono uruguayo a +598######## (o null si es inválido).
 * Igual que el backend: acepta 09…, sin 0, con +598/598/00598, con separadores.
 */
export function normalizarTelefonoUy(raw: string): string | null {
  let d = (raw ?? '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00598')) d = d.slice(5);
  else if (d.startsWith('598')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.replace(/^0+/, '');
  return d.length === 8 ? `+598${d}` : null;
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
  /** Punto exacto marcado en el mapa por el cliente (delivery). */
  lat?: number;
  lng?: number;
  notas?: string;
  guardarDireccion?: boolean;
  items: Array<{ productId: string; cantidad: number }>;
}

// --- Cuenta del cliente (login opcional) ------------------------------------

export interface StoreCustomer {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  puntos: number;
}

export interface CustomerAddress {
  id: string;
  etiqueta: string;
  direccion: string;
  referencia: string | null;
}

export interface AccountView {
  customer: StoreCustomer;
  direcciones: CustomerAddress[];
}

export interface MyOrder {
  numero: number;
  codigo: string;
  estado: string;
  tipoEntrega: TipoEntrega;
  total: number;
  createdAt: string;
}

const authHeaders = (token: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

async function okJson<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new NotFoundError('Sesión inválida');
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const msg = Array.isArray(body.message) ? body.message.join(' · ') : body.message;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function registerCustomer(slug: string, input: { nombre: string; email: string; telefono?: string; password: string }) {
  return okJson<{ token: string; customer: StoreCustomer }>(
    await fetch(`${API_BASE}/public/tienda/${encodeURIComponent(slug)}/cuenta/registro`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    }),
  );
}

export async function loginCustomer(slug: string, input: { email: string; password: string }) {
  return okJson<{ token: string; customer: StoreCustomer }>(
    await fetch(`${API_BASE}/public/tienda/${encodeURIComponent(slug)}/cuenta/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    }),
  );
}

export async function getAccount(slug: string, token: string) {
  return okJson<AccountView>(
    await fetch(`${API_BASE}/public/tienda/${encodeURIComponent(slug)}/cuenta`, { headers: authHeaders(token) }),
  );
}

export async function addAddress(slug: string, token: string, input: { etiqueta: string; direccion: string; referencia?: string }) {
  return okJson<AccountView>(
    await fetch(`${API_BASE}/public/tienda/${encodeURIComponent(slug)}/cuenta/direcciones`, {
      method: 'POST', headers: authHeaders(token), body: JSON.stringify(input),
    }),
  );
}

export async function deleteAddress(slug: string, token: string, id: string) {
  return okJson<AccountView>(
    await fetch(`${API_BASE}/public/tienda/${encodeURIComponent(slug)}/cuenta/direcciones/${id}`, {
      method: 'DELETE', headers: authHeaders(token),
    }),
  );
}

export async function getMyOrders(slug: string, token: string) {
  return okJson<MyOrder[]>(
    await fetch(`${API_BASE}/public/tienda/${encodeURIComponent(slug)}/mis-pedidos`, { headers: authHeaders(token) }),
  );
}

export interface OrderResult {
  id: string;
  numero: number;
  codigo: string;
  estado: string;
  total: number;
}

/** Crea un pedido en la tienda online. Lanza Error con el mensaje del backend si falla. */
export async function createOrder(slug: string, input: CreateOrderInput, token?: string): Promise<OrderResult> {
  const res = await fetch(`${API_BASE}/public/tienda/${encodeURIComponent(slug)}/pedido`, {
    method: 'POST',
    headers: token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' },
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
