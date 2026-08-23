// Cliente HTTP del backend @ats/api. En dev, Vite proxya /api → :3000.
// El tenant y el usuario se mandan por header (foundations); en prod → JWT.
import type { CartItem, CashSession, CashSummary, CfeSummary, SalePayment } from './types';

import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

// Cache del access token de Supabase, mantenido al día por onAuthStateChange
// (login, refresh automático, logout). Permite construir headers de forma sync.
let currentToken: string | null = null;
supabase.auth.getSession().then(({ data }) => {
  currentToken = data.session?.access_token ?? null;
});
supabase.auth.onAuthStateChange((_event, session) => {
  currentToken = session?.access_token ?? null;
});

export function getToken(): string | null {
  return currentToken;
}

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (currentToken) h['Authorization'] = `Bearer ${currentToken}`;
  return h;
}

async function ok<T>(res: Response, label: string): Promise<T> {
  if (res.status === 401) {
    // Token inválido/no habilitado: cerramos la sesión de Supabase.
    void supabase.auth.signOut();
    throw new Error('SESION_EXPIRADA');
  }
  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`${label} HTTP ${res.status} ${detalle}`);
  }
  return res.json() as Promise<T>;
}

// --- Auth (contexto de la app; el login lo hace Supabase) -------------------

export interface MeResponse {
  tenantId: string;
  userId?: string;
  role?: string;
}

export async function getMe(): Promise<MeResponse> {
  return ok(await fetch(`${API_BASE}/auth/me`, { headers: headers() }), 'me');
}

// --- Catálogo ---------------------------------------------------------------

export interface CatalogApiResponse {
  updatedAt: string;
  listaPrecio: string | null;
  products: import('./types').CatalogProduct[];
}

export async function fetchCatalog(): Promise<CatalogApiResponse> {
  return ok(await fetch(`${API_BASE}/catalog`, { headers: headers() }), 'catalog');
}

// --- Ventas -----------------------------------------------------------------

export interface CreateSalePayload {
  idempotencyKey: string;
  fecha: string;
  cashSessionId?: string;
  items: Array<Pick<CartItem, 'productId' | 'concepto' | 'unidad' | 'cantidad' | 'precioUnit' | 'ivaIndicador' | 'descuento'>>;
  payments: SalePayment[];
}

export interface CreateSaleResponse {
  id: string;
  idempotencyKey: string;
  total: string | number;
}

export async function postSale(payload: CreateSalePayload): Promise<CreateSaleResponse> {
  return ok(await fetch(`${API_BASE}/sales`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) }), 'sales');
}

// --- CFE (e-Ticket) ---------------------------------------------------------

export async function emitCfe(saleServerId: string): Promise<CfeSummary> {
  return ok(
    await fetch(`${API_BASE}/cfe/ventas/${saleServerId}/emitir`, { method: 'POST', headers: headers() }),
    'cfe-emitir',
  );
}

export async function getCfePdf(cfeDocId: string, tipo: 'A4' | 'ticket80' = 'ticket80'): Promise<Blob> {
  const res = await fetch(`${API_BASE}/cfe/${cfeDocId}/pdf?tipo=${tipo}`, { headers: headers() });
  if (!res.ok) throw new Error(`cfe-pdf HTTP ${res.status}`);
  return res.blob();
}

// --- Sucursales -------------------------------------------------------------

export interface Sucursal {
  id: string;
  nombre: string;
  codigo: number;
  activo: boolean;
}

export async function getSucursales(): Promise<Sucursal[]> {
  return ok(await fetch(`${API_BASE}/sucursales`, { headers: headers() }), 'sucursales');
}

// --- Caja / arqueo ----------------------------------------------------------

export async function openCash(montoApertura: number, sucursalId?: string): Promise<CashSession> {
  return ok(
    await fetch(`${API_BASE}/cash-sessions/open`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ montoApertura, sucursalId }),
    }),
    'cash-open',
  );
}

export async function currentCash(): Promise<CashSession | null> {
  return ok(await fetch(`${API_BASE}/cash-sessions/current`, { headers: headers() }), 'cash-current');
}

export async function cashSummary(sessionId: string): Promise<CashSummary> {
  return ok(await fetch(`${API_BASE}/cash-sessions/${sessionId}/summary`, { headers: headers() }), 'cash-summary');
}

export interface CloseCashResult {
  resumen: CashSummary;
  diferencia: number;
}

export async function closeCash(sessionId: string, montoCierre: number, notas?: string): Promise<CloseCashResult> {
  return ok(
    await fetch(`${API_BASE}/cash-sessions/${sessionId}/close`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ montoCierre, notas }),
    }),
    'cash-close',
  );
}
