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
  if (res.status === 403) throw new Error('Tu usuario no tiene el rol de repartidor.');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    throw new Error((body as { message?: string }).message || `${label} HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// --- Tipos ------------------------------------------------------------------

export type OnlineOrderEstado = 'PREPARANDO' | 'EN_CAMINO';
export type PresenciaEstado = 'DISPONIBLE' | 'OFFLINE';

export interface PedidoItem {
  concepto: string;
  cantidad: number;
  unidad: string;
}

export interface Pedido {
  id: string;
  numero: number;
  codigo: string;
  estado: OnlineOrderEstado;
  cliente: string;
  telefono: string;
  direccion: string | null;
  notas: string | null;
  total: number;
  items: PedidoItem[];
}

export interface PresenciaResult {
  estado: 'DISPONIBLE' | 'OFFLINE' | 'EN_ENTREGA';
  pedidos: Pedido[];
}

// --- Login (backend con bloqueo por intentos) -------------------------------

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

// --- Reparto ----------------------------------------------------------------

export const enviarPresencia = async (estado: PresenciaEstado, coords?: { lat: number; lng: number }) =>
  ok<PresenciaResult>(
    await fetch(`${API_BASE}/reparto/presencia`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ estado, ...(coords ?? {}) }),
    }),
    'presencia',
  );

export const getMisPedidos = async () =>
  ok<Pedido[]>(await fetch(`${API_BASE}/reparto/mis-pedidos`, { headers: headers() }), 'mis-pedidos');

export const marcarEnCamino = async (id: string) =>
  ok<Pedido[]>(await fetch(`${API_BASE}/reparto/pedidos/${id}/en-camino`, { method: 'POST', headers: headers() }), 'en-camino');

export const marcarEntregado = async (id: string) =>
  ok<Pedido[]>(await fetch(`${API_BASE}/reparto/pedidos/${id}/entregado`, { method: 'POST', headers: headers() }), 'entregado');
