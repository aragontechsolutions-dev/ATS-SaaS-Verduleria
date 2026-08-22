// Cliente HTTP del backend @ats/api. En dev, Vite proxya /api → :3000.
// El tenant y el usuario se mandan por header (foundations); en prod → JWT.
import type { CartItem, CashSession, CashSummary, CfeSummary, SalePayment } from './types';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

function tenantId(): string {
  return localStorage.getItem('ats.tenantId') ?? '';
}
function userId(): string {
  return localStorage.getItem('ats.userId') ?? '';
}

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = tenantId();
  const u = userId();
  if (t) h['x-tenant-id'] = t;
  if (u) h['x-user-id'] = u;
  return h;
}

async function ok<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`${label} HTTP ${res.status} ${detalle}`);
  }
  return res.json() as Promise<T>;
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
