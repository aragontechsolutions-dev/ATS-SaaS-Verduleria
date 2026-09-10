import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

let currentToken: string | null = null;
supabase.auth.getSession().then(({ data }) => {
  currentToken = data.session?.access_token ?? null;
});
supabase.auth.onAuthStateChange((_e, session) => {
  currentToken = session?.access_token ?? null;
});

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (currentToken) h['Authorization'] = `Bearer ${currentToken}`;
  return h;
}

async function ok<T>(res: Response, label: string): Promise<T> {
  if (res.status === 401) {
    void supabase.auth.signOut();
    throw new Error('SESION_EXPIRADA');
  }
  if (res.status === 403) throw new Error('Tu usuario no tiene permiso de compras.');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    throw new Error((body as { message?: string }).message || `${label} HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// --- Auth -------------------------------------------------------------------

export interface LoginTokens { access_token: string; refresh_token: string; }
export interface LoginError extends Error { code?: string; remaining?: number | null; status?: number; }

export async function login(email: string, password: string): Promise<LoginTokens> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  if (res.ok) return res.json() as Promise<LoginTokens>;
  const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string; remaining?: number };
  const err = new Error(body.message || 'No se pudo iniciar sesión') as LoginError;
  err.code = body.code;
  err.remaining = body.remaining ?? null;
  err.status = res.status;
  throw err;
}

// --- Compras (sugerido + registrar) ----------------------------------------

/** Un producto sugerido para reponer. */
export interface SugeridoItem {
  productId: string;
  nombre: string;
  unidadVenta: string;
  unidadCompra: string;
  stockActual: number;
  ventaDiaria: number;
  diasCobertura: number | null;
  stockMinimo: number;
  /** Cantidad sugerida en unidad de venta. */
  sugeridoVenta: number;
  /** Cantidad sugerida en unidad de compra (cajones/bolsas), redondeada. */
  sugeridoCompra: number;
  costoUnit: number;
  costoEstimado: number;
  bajoMinimo: boolean;
  quiebre: boolean;
}

export interface SugeridoGrupo {
  proveedorId: string | null;
  proveedorNombre: string;
  items: SugeridoItem[];
  totalEstimado: number;
}

export interface Supplier {
  id: string;
  nombre: string;
  esUam: boolean;
  activo: boolean;
}

export async function getSugerido(dias = 4): Promise<SugeridoGrupo[]> {
  return ok(await fetch(`${API_BASE}/purchases/sugerido?dias=${dias}`, { headers: headers() }), 'sugerido');
}

export async function getSuppliers(): Promise<Supplier[]> {
  return ok(await fetch(`${API_BASE}/purchases/suppliers`, { headers: headers() }), 'suppliers');
}

/** Un producto del catálogo con su stock (para agregar compras fuera del sugerido). */
export interface StockProduct {
  productId: string;
  nombre: string;
  categoriaNombre: string | null;
  unidadVenta: string;
  unidadCompra: string;
  cantidad: number;
  costoPromedio: number;
  precio: number;
  margenPct: number | null;
}

export async function getStock(): Promise<StockProduct[]> {
  return ok(await fetch(`${API_BASE}/purchases/stock`, { headers: headers() }), 'stock');
}

export interface CompraItem {
  productId: string;
  cantidadCompra: number;
  costoUnitCompra: number;
}

export interface CompraPayload {
  supplierId?: string;
  notas?: string;
  items: CompraItem[];
}

export async function registrarCompra(payload: CompraPayload): Promise<{ id: string; total: number }> {
  return ok(
    await fetch(`${API_BASE}/purchases`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) }),
    'compra',
  );
}
