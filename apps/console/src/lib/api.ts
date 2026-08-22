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
  if (res.status === 403) throw new Error('No tenés permisos de plataforma con esta cuenta.');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    throw new Error((body as { message?: string }).message || `${label} HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// --- Tipos ------------------------------------------------------------------

export interface Overview {
  tenants: number;
  activos: number;
  suscripcionesPorEstado: Array<{ estado: string; _count: number }>;
}

export interface Plan {
  id: string;
  code: string;
  nombre: string;
  precioMensual: string | number;
}

export interface TenantRow {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  rut: string | null;
  plan: string | null;
  estado: string;
  usuarios: number;
  productos: number;
  sucursales: number;
  createdAt: string;
}

export interface CreateTenantInput {
  nombre: string;
  slug: string;
  planCode: string;
  adminNombre: string;
  adminEmail: string;
  adminPassword?: string;
  rut?: string;
}

export interface CreateTenantResult {
  tenantId: string;
  plan: string;
  admin: { email: string; password?: string; loginCreado: boolean };
}

// --- Llamadas ---------------------------------------------------------------

export const getOverview = async () =>
  ok<Overview>(await fetch(`${API_BASE}/platform/overview`, { headers: headers() }), 'overview');

export const getPlans = async () =>
  ok<Plan[]>(await fetch(`${API_BASE}/platform/plans`, { headers: headers() }), 'plans');

export const getTenants = async () =>
  ok<TenantRow[]>(await fetch(`${API_BASE}/platform/tenants`, { headers: headers() }), 'tenants');

export const createTenant = async (input: CreateTenantInput) =>
  ok<CreateTenantResult>(
    await fetch(`${API_BASE}/platform/tenants`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(input),
    }),
    'createTenant',
  );

export const updateTenant = async (id: string, patch: { activo?: boolean; planCode?: string }) =>
  ok<unknown>(
    await fetch(`${API_BASE}/platform/tenants/${id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(patch),
    }),
    'updateTenant',
  );
