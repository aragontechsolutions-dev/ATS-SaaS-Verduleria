// Cliente HTTP del backend @ats/api. En dev, Vite proxya /api → :3000.
// El tenant se manda por header (foundations); en prod vendrá del JWT.
import type { CartItem, SalePayment } from './types';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

function tenantId(): string {
  return localStorage.getItem('ats.tenantId') ?? '';
}

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = tenantId();
  if (t) h['x-tenant-id'] = t;
  return h;
}

export interface CatalogApiResponse {
  updatedAt: string;
  listaPrecio: string | null;
  products: import('./types').CatalogProduct[];
}

export async function fetchCatalog(): Promise<CatalogApiResponse> {
  const res = await fetch(`${API_BASE}/catalog`, { headers: headers() });
  if (!res.ok) throw new Error(`catalog HTTP ${res.status}`);
  return res.json();
}

export interface CreateSalePayload {
  idempotencyKey: string;
  fecha: string;
  items: Array<Pick<CartItem, 'productId' | 'concepto' | 'unidad' | 'cantidad' | 'precioUnit' | 'ivaIndicador' | 'descuento'>>;
  payments: SalePayment[];
}

export interface CreateSaleResponse {
  id: string;
  idempotencyKey: string;
  total: string | number;
}

export async function postSale(payload: CreateSalePayload): Promise<CreateSaleResponse> {
  const res = await fetch(`${API_BASE}/sales`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`sales HTTP ${res.status} ${detalle}`);
  }
  return res.json();
}
