// Cliente HTTP del backend @ats/api. En dev, Vite proxya /api → :3000.
// El tenant y el usuario se mandan por header (foundations); en prod → JWT.
import type { CartItem, CashSession, CashSummary, CfeSummary, IvaIndicador, MedioPago, PosCustomer, SalePayment, TipoDocumentoCliente } from './types';

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

export interface LoginTokens {
  access_token: string;
  refresh_token: string;
}

export interface LoginError extends Error {
  code?: 'LOCKED' | 'BAD_CREDENTIALS' | string;
  remaining?: number | null;
  status?: number;
}

/** Login mediado por el backend (cuenta fallos y bloquea). No usa `ok()`. */
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

export interface MeResponse {
  tenantId: string;
  userId?: string;
  role?: string;
  nombre?: string | null;
  /** Primer acceso: hay que cambiar la contraseña temporal. */
  mustChangePassword?: boolean;
}

export async function getMe(): Promise<MeResponse> {
  return ok(await fetch(`${API_BASE}/auth/me`, { headers: headers() }), 'me');
}

/** Marca en el backend que ya se cambió la contraseña temporal (limpia el flag). */
export async function notifyPasswordChanged(): Promise<void> {
  await ok(await fetch(`${API_BASE}/auth/password-changed`, { method: 'POST', headers: headers() }), 'password-changed');
}

// --- Catálogo ---------------------------------------------------------------

export interface CatalogApiResponse {
  updatedAt: string;
  listaPrecio: string | null;
  products: import('./types').CatalogProduct[];
  promos?: import('./promo').Promo[];
}

export async function fetchCatalog(): Promise<CatalogApiResponse> {
  return ok(await fetch(`${API_BASE}/catalog`, { headers: headers() }), 'catalog');
}

// --- Ventas -----------------------------------------------------------------

export interface CreateSalePayload {
  idempotencyKey: string;
  fecha: string;
  cashSessionId?: string;
  customerId?: string;
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

// --- Clientes (identificación del comprador para CFE) -----------------------

export async function searchCustomers(q: string): Promise<PosCustomer[]> {
  const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  return ok(await fetch(`${API_BASE}/pos/customers/search${qs}`, { headers: headers() }), 'customers-search');
}

export interface QuickCustomerPayload {
  nombre: string;
  tipoDocumento: TipoDocumentoCliente;
  documento: string;
  razonSocial?: string;
  direccion?: string;
}

export async function quickCreateCustomer(payload: QuickCustomerPayload): Promise<PosCustomer> {
  return ok(
    await fetch(`${API_BASE}/pos/customers`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) }),
    'customers-quick',
  );
}

// --- Cuenta corriente (cobranza) --------------------------------------------

export interface Deudor {
  id: string;
  nombre: string;
  documento: string | null;
  saldo: number;
  limiteCredito: number;
}

export async function getDeudores(q: string): Promise<Deudor[]> {
  const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  return ok(await fetch(`${API_BASE}/pos/customers/deudores${qs}`, { headers: headers() }), 'deudores');
}

export interface CobranzaPayload {
  monto: number;
  medio: MedioPago;
  cashSessionId?: string;
  concepto?: string;
}

export async function postCobranza(customerId: string, payload: CobranzaPayload): Promise<{ saldo: number }> {
  return ok(
    await fetch(`${API_BASE}/pos/customers/${customerId}/cobranza`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload),
    }),
    'cobranza',
  );
}

// --- Devoluciones (nota de crédito) -----------------------------------------

export interface DevolucionItemPayload {
  productId?: string;
  concepto: string;
  unidad: string;
  cantidad: number;
  precioUnit: number;
  descuento?: number;
  ivaIndicador: IvaIndicador;
}

export interface CreateDevolucionPayload {
  idempotencyKey: string;
  originalSaleId: string;
  cashSessionId?: string;
  medio: MedioPago;
  motivo?: string;
  items: DevolucionItemPayload[];
}

export async function postDevolucion(payload: CreateDevolucionPayload): Promise<CreateSaleResponse> {
  return ok(
    await fetch(`${API_BASE}/sales/devoluciones`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) }),
    'devolucion',
  );
}

// --- Auditoría (eventos emitidos por el POS) --------------------------------

export type PosAuditTipo = 'CAJON_ABIERTO' | 'ANULACION_LINEA' | 'PRECIO_MODIFICADO';

/** Registra un evento de auditoría del POS. Best-effort: nunca corta el flujo. */
export async function postAuditEvent(
  tipo: PosAuditTipo,
  opts: { descripcion?: string; monto?: number; refId?: string; cashSessionId?: string; meta?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await fetch(`${API_BASE}/audit`, { method: 'POST', headers: headers(), body: JSON.stringify({ tipo, ...opts }) });
  } catch {
    /* sin conexión: se pierde el evento del cliente, no es crítico */
  }
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

export async function openCash(
  montoApertura: number,
  sucursalId?: string,
  terminalId?: string,
): Promise<CashSession> {
  return ok(
    await fetch(`${API_BASE}/cash-sessions/open`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ montoApertura, sucursalId, terminalId }),
    }),
    'cash-open',
  );
}

// --- Cajas / terminales (las que puede operar el cajero) ---------------------

export interface PosTerminal {
  id: string;
  nombre: string;
  sucursalId: string;
  sucursalNombre: string;
}

export interface MyTerminals {
  /** Cajas que este cajero puede operar. */
  terminals: PosTerminal[];
  /** Si el comercio ya definió cajas (aunque este cajero no tenga ninguna). */
  hayCajas: boolean;
}

/** Cajas gestionadas que el cajero actual puede operar (para elegir al abrir). */
export async function getMyTerminals(sucursalId?: string): Promise<MyTerminals> {
  const qs = sucursalId ? `?sucursalId=${encodeURIComponent(sucursalId)}` : '';
  return ok(await fetch(`${API_BASE}/terminals/mine${qs}`, { headers: headers() }), 'terminals-mine');
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
  arqueoDetalle: Record<string, import('./types').ArqueoMedio>;
}

export async function closeCash(
  sessionId: string,
  montoCierre: number,
  conteos?: Record<string, number>,
  notas?: string,
): Promise<CloseCashResult> {
  return ok(
    await fetch(`${API_BASE}/cash-sessions/${sessionId}/close`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ montoCierre, conteos, notas }),
    }),
    'cash-close',
  );
}

export async function addCashMovement(
  sessionId: string,
  tipo: 'INGRESO' | 'EGRESO',
  monto: number,
  motivo?: string,
): Promise<unknown> {
  return ok(
    await fetch(`${API_BASE}/cash-sessions/${sessionId}/movements`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ tipo, monto, motivo }),
    }),
    'cash-movement',
  );
}
