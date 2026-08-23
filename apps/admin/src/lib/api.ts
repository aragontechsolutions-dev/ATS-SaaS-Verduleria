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
  if (res.status === 403) throw new Error('No tenés permisos de administración con esta cuenta.');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    throw new Error((body as { message?: string }).message || `${label} HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type IvaIndicador = 'EXENTO' | 'MINIMA' | 'BASICA' | 'SUSPENSO';

export interface Me {
  tenantId: string;
  userId?: string;
  role?: string;
}

export interface Product {
  id: string;
  nombre: string;
  plu: number | null;
  codigoBarras: string | null;
  categoriaId: string | null;
  categoriaNombre: string | null;
  unidadVenta: string;
  esPesable: boolean;
  ivaIndicador: IvaIndicador;
  activo: boolean;
  precio: number;
}

export interface Categoria {
  id: string;
  nombre: string;
  ivaIndicadorDefault: IvaIndicador;
}

export interface ProductInput {
  nombre: string;
  unidadVenta: string;
  esPesable: boolean;
  ivaIndicador: IvaIndicador;
  precio: number;
  categoriaId?: string;
  plu?: number;
  codigoBarras?: string;
}

export const getMe = async () => ok<Me>(await fetch(`${API_BASE}/auth/me`, { headers: headers() }), 'me');

export const getProducts = async () =>
  ok<Product[]>(await fetch(`${API_BASE}/products`, { headers: headers() }), 'products');

export const getCategorias = async () =>
  ok<Categoria[]>(await fetch(`${API_BASE}/products/categorias/all`, { headers: headers() }), 'categorias');

export const createProduct = async (input: ProductInput) =>
  ok<{ id: string }>(
    await fetch(`${API_BASE}/products`, { method: 'POST', headers: headers(), body: JSON.stringify(input) }),
    'createProduct',
  );

export const updateProduct = async (id: string, patch: Partial<ProductInput> & { activo?: boolean }) =>
  ok<{ id: string }>(
    await fetch(`${API_BASE}/products/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(patch) }),
    'updateProduct',
  );
