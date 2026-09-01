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
  /** true = el contador fijó el IVA a mano; false = lo asignó el motor. */
  ivaOverride: boolean;
  /** Término de la regla del motor que asignó el IVA (o null). */
  ivaRegla: string | null;
  esEstadoNatural: boolean;
  esImportado: boolean;
  imagenUrl: string | null;
  proveedorId: string | null;
  stockMinimo: number | null;
  activo: boolean;
  precio: number;
}

export interface Clasificacion {
  ivaIndicador: IvaIndicador;
  esEstadoNatural: boolean;
  esImportado: boolean;
  regla: string | null;
  automatica: boolean;
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
  /** Solo se envía en override manual del contador (con ivaOverride=true). */
  ivaIndicador?: IvaIndicador;
  ivaOverride?: boolean;
  esEstadoNatural?: boolean;
  esImportado?: boolean;
  precio: number;
  categoriaId?: string;
  plu?: number;
  codigoBarras?: string;
  imagenUrl?: string;
  proveedorId?: string;
  stockMinimo?: number;
}

export const getMe = async () => ok<Me>(await fetch(`${API_BASE}/auth/me`, { headers: headers() }), 'me');

/** Vista previa del motor de IVA: qué tasa le asignaría a un nombre. */
export const classifyIva = async (nombre: string) =>
  ok<Clasificacion>(
    await fetch(`${API_BASE}/products/clasificar-iva`, { method: 'POST', headers: headers(), body: JSON.stringify({ nombre }) }),
    'classify-iva',
  );

export const getProducts = async () =>
  ok<Product[]>(await fetch(`${API_BASE}/products`, { headers: headers() }), 'products');

export const getCategorias = async () =>
  ok<Categoria[]>(await fetch(`${API_BASE}/products/categorias/all`, { headers: headers() }), 'categorias');

export const createCategoria = async (input: { nombre: string; ivaIndicadorDefault?: IvaIndicador }) =>
  ok<Categoria>(
    await fetch(`${API_BASE}/products/categorias`, { method: 'POST', headers: headers(), body: JSON.stringify(input) }),
    'createCategoria',
  );

export const updateCategoria = async (id: string, patch: { nombre?: string; ivaIndicadorDefault?: IvaIndicador }) =>
  ok<Categoria>(
    await fetch(`${API_BASE}/products/categorias/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(patch) }),
    'updateCategoria',
  );

export interface BulkPriceInput {
  operacion: 'PORCENTAJE' | 'FIJO';
  valor: number;
  categoriaId?: string;
  redondear?: number;
}

export const bulkPrices = async (input: BulkPriceInput) =>
  ok<{ actualizados: number }>(
    await fetch(`${API_BASE}/products/prices/bulk`, { method: 'POST', headers: headers(), body: JSON.stringify(input) }),
    'bulkPrices',
  );

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

// --- Compras / Stock / Merma ------------------------------------------------

export interface Supplier {
  id: string;
  nombre: string;
  rut: string | null;
  telefono: string | null;
  esUam: boolean;
  activo: boolean;
}

export interface SupplierInput {
  nombre: string;
  rut?: string;
  telefono?: string;
  esUam?: boolean;
}

export interface PurchaseLine {
  productId: string;
  cantidadCompra: number;
  costoUnitCompra: number;
  rindeVenta?: number;
}

export interface PurchaseInput {
  supplierId?: string;
  sucursalId?: string;
  fecha?: string;
  notas?: string;
  items: PurchaseLine[];
}

export interface Sucursal {
  id: string;
  nombre: string;
  codigo: number;
  direccion: string | null;
  activo: boolean;
}

export interface TransferInput {
  productId: string;
  fromSucursalId: string;
  toSucursalId: string;
  cantidad: number;
}

export interface PurchaseRow {
  id: string;
  fecha: string;
  supplierId: string | null;
  supplierNombre: string | null;
  total: number;
  lineas: number;
  notas: string | null;
}

export interface StockRow {
  productId: string;
  nombre: string;
  categoriaNombre: string | null;
  unidadVenta: string;
  cantidad: number;
  costoPromedio: number;
  precio: number;
  margenPct: number | null;
}

export type WasteMotivo = 'PODRIDO' | 'DANADO' | 'VENCIDO' | 'ROBO' | 'DESCARTE' | 'ERROR_PESO' | 'OTRO';

export interface WasteRow {
  id: string;
  fecha: string;
  productId: string;
  nombre: string;
  unidadVenta: string;
  cantidad: number;
  costoUnit: number;
  costoTotal: number;
  tipo: WasteMotivo | null;
  motivo: string | null;
}

export interface MermaReport {
  desde: string;
  hasta: string;
  totalCosto: number;
  registros: number;
  porProducto: Array<{ productId: string; nombre: string; unidadVenta: string; cantidad: number; costo: number; registros: number }>;
  porMotivo: Array<{ tipo: string; costo: number; registros: number }>;
}

export interface VencimientoRow {
  id: string;
  productId: string;
  nombre: string;
  unidadVenta: string;
  sucursalNombre: string | null;
  cantidad: number;
  fechaVencimiento: string;
  diasRestantes: number;
  vencido: boolean;
  nota: string | null;
  resuelto: boolean;
}

export const getSuppliers = async () =>
  ok<Supplier[]>(await fetch(`${API_BASE}/purchases/suppliers`, { headers: headers() }), 'suppliers');

export const createSupplier = async (input: SupplierInput) =>
  ok<Supplier>(
    await fetch(`${API_BASE}/purchases/suppliers`, { method: 'POST', headers: headers(), body: JSON.stringify(input) }),
    'createSupplier',
  );

export const updateSupplier = async (id: string, patch: Partial<SupplierInput> & { activo?: boolean }) =>
  ok<Supplier>(
    await fetch(`${API_BASE}/purchases/suppliers/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(patch) }),
    'updateSupplier',
  );

export const getPurchases = async () =>
  ok<PurchaseRow[]>(await fetch(`${API_BASE}/purchases`, { headers: headers() }), 'purchases');

export const createPurchase = async (input: PurchaseInput) =>
  ok<{ id: string; total: number }>(
    await fetch(`${API_BASE}/purchases`, { method: 'POST', headers: headers(), body: JSON.stringify(input) }),
    'createPurchase',
  );

export const getStock = async (sucursalId?: string) =>
  ok<StockRow[]>(
    await fetch(`${API_BASE}/purchases/stock${sucursalId ? `?sucursalId=${sucursalId}` : ''}`, { headers: headers() }),
    'stock',
  );

export const adjustStock = async (input: { productId: string; cantidad: number; sucursalId?: string; motivo?: string }) =>
  ok<{ productId: string; cantidad: number }>(
    await fetch(`${API_BASE}/purchases/stock/ajuste`, { method: 'POST', headers: headers(), body: JSON.stringify(input) }),
    'adjustStock',
  );

export const getWaste = async () =>
  ok<WasteRow[]>(await fetch(`${API_BASE}/purchases/waste`, { headers: headers() }), 'waste');

export const createWaste = async (input: { productId: string; cantidad: number; sucursalId?: string; tipo?: WasteMotivo; motivo?: string }) =>
  ok<{ id: string; costoTotal: number }>(
    await fetch(`${API_BASE}/purchases/waste`, { method: 'POST', headers: headers(), body: JSON.stringify(input) }),
    'createWaste',
  );

export interface SugeridoItem {
  productId: string;
  nombre: string;
  unidadVenta: string;
  unidadCompra: string;
  stockActual: number;
  ventaDiaria: number;
  diasCobertura: number | null;
  stockMinimo: number;
  sugeridoVenta: number;
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

export const getSugerido = async (dias = 4, sucursalId?: string) => {
  const p = new URLSearchParams({ dias: String(dias) });
  if (sucursalId) p.set('sucursalId', sucursalId);
  return ok<SugeridoGrupo[]>(await fetch(`${API_BASE}/purchases/sugerido?${p.toString()}`, { headers: headers() }), 'sugerido');
};

export const getMermaReport = async (qs: { from?: string; to?: string } = {}) => {
  const p = new URLSearchParams();
  if (qs.from) p.set('from', qs.from);
  if (qs.to) p.set('to', qs.to);
  const s = p.toString();
  return ok<MermaReport>(await fetch(`${API_BASE}/purchases/waste/report${s ? `?${s}` : ''}`, { headers: headers() }), 'mermaReport');
};

// --- Vencimientos -----------------------------------------------------------

export const getVencimientos = async (estado = 'vigentes', dias?: number) => {
  const p = new URLSearchParams({ estado });
  if (dias != null) p.set('dias', String(dias));
  return ok<VencimientoRow[]>(await fetch(`${API_BASE}/purchases/vencimientos?${p.toString()}`, { headers: headers() }), 'vencimientos');
};

export const createVencimiento = async (input: { productId: string; cantidad: number; fechaVencimiento: string; sucursalId?: string; nota?: string }) =>
  ok<{ id: string }>(
    await fetch(`${API_BASE}/purchases/vencimientos`, { method: 'POST', headers: headers(), body: JSON.stringify(input) }),
    'createVencimiento',
  );

export const resolveVencimiento = async (id: string, comoMerma: boolean) =>
  ok<{ id: string; resuelto: boolean; mermaId: string | null }>(
    await fetch(`${API_BASE}/purchases/vencimientos/${id}/resolve`, { method: 'POST', headers: headers(), body: JSON.stringify({ comoMerma }) }),
    'resolveVencimiento',
  );

export const deleteVencimiento = async (id: string) =>
  ok<{ id: string; deleted: boolean }>(
    await fetch(`${API_BASE}/purchases/vencimientos/${id}/delete`, { method: 'POST', headers: headers() }),
    'deleteVencimiento',
  );

// --- Sucursales -------------------------------------------------------------

export const getSucursales = async () =>
  ok<Sucursal[]>(await fetch(`${API_BASE}/sucursales`, { headers: headers() }), 'sucursales');

export const createSucursal = async (input: { nombre: string; direccion?: string }) =>
  ok<Sucursal>(
    await fetch(`${API_BASE}/sucursales`, { method: 'POST', headers: headers(), body: JSON.stringify(input) }),
    'createSucursal',
  );

export const updateSucursal = async (id: string, patch: { nombre?: string; direccion?: string; activo?: boolean }) =>
  ok<Sucursal>(
    await fetch(`${API_BASE}/sucursales/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(patch) }),
    'updateSucursal',
  );

export const transferStock = async (input: TransferInput) =>
  ok<{ productId: string; from: { nombre: string; cantidad: number }; to: { nombre: string; cantidad: number } }>(
    await fetch(`${API_BASE}/sucursales/transfer`, { method: 'POST', headers: headers(), body: JSON.stringify(input) }),
    'transferStock',
  );

// --- Cajas / terminales ------------------------------------------------------

export interface Terminal {
  id: string;
  nombre: string;
  activo: boolean;
  sucursalId: string;
  sucursalNombre: string;
  /** Cajeros habilitados; vacío = la puede operar cualquiera. */
  operadorIds: string[];
}

export const getTerminals = async () =>
  ok<Terminal[]>(await fetch(`${API_BASE}/terminals`, { headers: headers() }), 'terminals');

export const createTerminal = async (input: { sucursalId: string; nombre: string }) =>
  ok<Terminal>(
    await fetch(`${API_BASE}/terminals`, { method: 'POST', headers: headers(), body: JSON.stringify(input) }),
    'createTerminal',
  );

export const updateTerminal = async (id: string, patch: { nombre?: string; activo?: boolean }) =>
  ok<Terminal>(
    await fetch(`${API_BASE}/terminals/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(patch) }),
    'updateTerminal',
  );

export const deleteTerminal = async (id: string) =>
  ok<{ deleted: boolean; deactivated: boolean }>(
    await fetch(`${API_BASE}/terminals/${id}`, { method: 'DELETE', headers: headers() }),
    'deleteTerminal',
  );

export const setTerminalOperadores = async (id: string, userIds: string[]) =>
  ok<{ terminalId: string; operadorIds: string[] }>(
    await fetch(`${API_BASE}/terminals/${id}/operadores`, { method: 'PUT', headers: headers(), body: JSON.stringify({ userIds }) }),
    'setTerminalOperadores',
  );

// --- Mayoristas / cuenta corriente ------------------------------------------

export type TipoDocumento = 'NIE' | 'RUC' | 'CI' | 'OTROS' | 'PASAPORTE' | 'DNI' | 'NIFE';

export interface Customer {
  id: string;
  nombre: string;
  esMayorista: boolean;
  documento: string | null;
  razonSocial: string | null;
  telefono: string | null;
  email: string | null;
  priceListId: string | null;
  limiteCredito: number;
  saldo: number;
  puntos: number;
  activo: boolean;
}

export interface LoyaltyMovement {
  id: string;
  fecha: string;
  tipo: 'GANADOS' | 'CANJEADOS' | 'AJUSTE';
  puntos: number;
  saldo: number;
  descripcion: string | null;
}

export interface CustomerLoyalty {
  customerId: string;
  nombre: string;
  puntos: number;
  movimientos: LoyaltyMovement[];
}

export interface CustomerInput {
  nombre: string;
  esMayorista?: boolean;
  tipoDocumento?: TipoDocumento;
  documento?: string;
  razonSocial?: string;
  telefono?: string;
  email?: string;
  limiteCredito?: number;
}

export interface AccountMovement {
  id: string;
  fecha: string;
  monto: number;
  tipo: 'CARGO' | 'PAGO';
  concepto: string | null;
}

export interface CustomerAccount {
  customer: Customer;
  saldo: number;
  limiteCredito: number;
  disponible: number | null;
  movimientos: AccountMovement[];
}

export const getCustomers = async () =>
  ok<Customer[]>(await fetch(`${API_BASE}/customers`, { headers: headers() }), 'customers');

export const createCustomer = async (input: CustomerInput) =>
  ok<Customer>(await fetch(`${API_BASE}/customers`, { method: 'POST', headers: headers(), body: JSON.stringify(input) }), 'createCustomer');

export const updateCustomer = async (id: string, patch: Partial<CustomerInput> & { activo?: boolean }) =>
  ok<Customer>(await fetch(`${API_BASE}/customers/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(patch) }), 'updateCustomer');

export const getCustomerAccount = async (id: string) =>
  ok<CustomerAccount>(await fetch(`${API_BASE}/customers/${id}/account`, { headers: headers() }), 'account');

export const addCustomerPayment = async (id: string, input: { monto: number; concepto?: string }) =>
  ok<{ saldo: number }>(await fetch(`${API_BASE}/customers/${id}/payments`, { method: 'POST', headers: headers(), body: JSON.stringify(input) }), 'payment');

export const getCustomerLoyalty = async (id: string) =>
  ok<CustomerLoyalty>(await fetch(`${API_BASE}/customers/${id}/loyalty`, { headers: headers() }), 'loyalty');

export const adjustCustomerLoyalty = async (id: string, puntos: number, descripcion?: string) =>
  ok<{ puntos: number }>(
    await fetch(`${API_BASE}/customers/${id}/loyalty/ajuste`, { method: 'POST', headers: headers(), body: JSON.stringify({ puntos, descripcion }) }),
    'loyaltyAjuste',
  );

export const addCustomerCharge = async (id: string, input: { monto: number; concepto?: string }) =>
  ok<{ saldo: number }>(await fetch(`${API_BASE}/customers/${id}/charges`, { method: 'POST', headers: headers(), body: JSON.stringify(input) }), 'charge');

// --- Mi web (landing del tenant) --------------------------------------------

export interface LandingProducto {
  nombre: string;
  precio: string;
  imagenUrl: string;
}

export interface LandingConfig {
  tema: { color: string };
  hero: { mostrar: boolean; titulo: string; lema: string; imagenUrl: string };
  productos: { mostrar: boolean; titulo: string; productIds: string[]; items: LandingProducto[] };
  horarios: { mostrar: boolean; texto: string; direccion: string; mapaUrl: string; lat: number; lng: number };
  contacto: { mostrar: boolean; whatsapp: string; telefono: string; instagram: string; facebook: string };
}

export interface LandingState {
  slug: string;
  /** URL pública completa del landing (la arma el backend con WEB_URL). '' si no está configurada. */
  publicUrl: string;
  estaPublicado: boolean;
  draft: LandingConfig;
}

export const getLanding = async () =>
  ok<LandingState>(await fetch(`${API_BASE}/landing`, { headers: headers() }), 'landing');

export const saveLanding = async (config: LandingConfig) =>
  ok<{ draft: LandingConfig }>(
    await fetch(`${API_BASE}/landing`, { method: 'PUT', headers: headers(), body: JSON.stringify({ config }) }),
    'saveLanding',
  );

export const publishLanding = async () =>
  ok<{ estaPublicado: boolean }>(
    await fetch(`${API_BASE}/landing/publish`, { method: 'POST', headers: headers() }),
    'publishLanding',
  );

export const unpublishLanding = async () =>
  ok<{ estaPublicado: boolean }>(
    await fetch(`${API_BASE}/landing/unpublish`, { method: 'POST', headers: headers() }),
    'unpublishLanding',
  );

// --- Usuarios ---------------------------------------------------------------

export type Role =
  | 'ADMIN' | 'ENCARGADO' | 'CAJERO' | 'DEPOSITO'
  | 'REPARTIDOR' | 'COMPRADOR' | 'MAYORISTA' | 'CONTADOR';

export interface TenantUser {
  membershipId: string;
  userId: string;
  email: string;
  nombre: string;
  role: Role;
  activo: boolean;
  bloqueado?: boolean;
  mustChangePassword?: boolean;
}

export interface CreateUserInput {
  email: string;
  nombre: string;
  role: Role;
  password?: string;
}

export interface CreateUserResult {
  email: string;
  password?: string;
  loginCreado: boolean;
}

export const getUsers = async () =>
  ok<TenantUser[]>(await fetch(`${API_BASE}/users`, { headers: headers() }), 'users');

export const createUser = async (input: CreateUserInput) =>
  ok<CreateUserResult>(
    await fetch(`${API_BASE}/users`, { method: 'POST', headers: headers(), body: JSON.stringify(input) }),
    'createUser',
  );

export const updateUser = async (membershipId: string, patch: { role?: Role; activo?: boolean }) =>
  ok<unknown>(
    await fetch(`${API_BASE}/users/${membershipId}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(patch) }),
    'updateUser',
  );

// --- Reportes ---------------------------------------------------------------

export interface ReportSummary {
  desde: string;
  ventas: number;
  totalVendido: number;
  ivaTotal: number;
  ticketPromedio: number;
  porMedio: Array<{ medio: string; monto: number }>;
}

export interface TopProduct {
  productId: string | null;
  nombre: string;
  monto: number;
  cantidad: number;
}

export interface DailyPoint {
  dia: string;
  total: number;
}

function range(qs: { from?: string; to?: string }): string {
  const p = new URLSearchParams();
  if (qs.from) p.set('from', qs.from);
  if (qs.to) p.set('to', qs.to);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const getSummary = async (qs: { from?: string; to?: string } = {}) =>
  ok<ReportSummary>(await fetch(`${API_BASE}/reports/summary${range(qs)}`, { headers: headers() }), 'summary');

export const getTopProducts = async (qs: { from?: string; to?: string } = {}) =>
  ok<TopProduct[]>(await fetch(`${API_BASE}/reports/top-products${range(qs)}`, { headers: headers() }), 'top');

export const getDaily = async (days = 7) =>
  ok<DailyPoint[]>(await fetch(`${API_BASE}/reports/daily?days=${days}`, { headers: headers() }), 'daily');

export interface CategoryRow {
  categoriaId: string | null;
  nombre: string;
  monto: number;
  cantidad: number;
}

export interface HourPoint {
  hora: number;
  ventas: number;
  total: number;
}

export const getByCategory = async (qs: { from?: string; to?: string } = {}) =>
  ok<CategoryRow[]>(await fetch(`${API_BASE}/reports/by-category${range(qs)}`, { headers: headers() }), 'by-category');

export const getByHour = async (qs: { from?: string; to?: string } = {}) =>
  ok<HourPoint[]>(await fetch(`${API_BASE}/reports/by-hour${range(qs)}`, { headers: headers() }), 'by-hour');

export interface ProfitProduct {
  productId: string | null;
  nombre: string;
  cantidad: number;
  ingresos: number;
  costo: number;
  ganancia: number | null;
  margenPct: number | null;
  parcial: boolean;
}

export interface ProfitReport {
  desde: string;
  ingresos: number;
  costo: number;
  ganancia: number;
  margenPct: number | null;
  coberturaPct: number | null;
  ingresosSinCosto: number;
  productos: ProfitProduct[];
}

export const getProfit = async (qs: { from?: string; to?: string } = {}) =>
  ok<ProfitReport>(await fetch(`${API_BASE}/reports/profit${range(qs)}`, { headers: headers() }), 'profit');

// --- Configuración del tenant (fiscal + CFE) --------------------------------

export type RegimenFiscal =
  | 'MONOTRIBUTO' | 'MONOTRIBUTO_MIDES' | 'LITERAL_E' | 'IVA_MINIMO' | 'REGIMEN_GENERAL';

export interface Settings {
  nombre: string;
  slug: string;
  razonSocial: string | null;
  rut: string | null;
  regimenFiscal: RegimenFiscal;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  limiteEfectivoCaja: number | null;
  loyaltyActivo: boolean;
  loyaltyAcumulaCada: number;
  loyaltyValorPunto: number;
  cfe: {
    provider: string;
    ambiente: 'test' | 'produccion';
    emisorRut: string;
    sucursalDefault: number;
    certificadoEstado: string;
  } | null;
}

export interface SettingsInput {
  nombre?: string;
  razonSocial?: string;
  rut?: string;
  regimenFiscal?: RegimenFiscal;
  direccion?: string;
  telefono?: string;
  email?: string;
  limiteEfectivoCaja?: number;
  loyaltyActivo?: boolean;
  loyaltyAcumulaCada?: number;
  loyaltyValorPunto?: number;
  cfeAmbiente?: 'test' | 'produccion';
  emisorRut?: string;
  sucursalDefault?: number;
}

export const getSettings = async () =>
  ok<Settings>(await fetch(`${API_BASE}/settings`, { headers: headers() }), 'settings');

export const updateSettings = async (input: SettingsInput) =>
  ok<Settings>(
    await fetch(`${API_BASE}/settings`, { method: 'PATCH', headers: headers(), body: JSON.stringify(input) }),
    'updateSettings',
  );

// --- Caja: operaciones (histórico + en vivo) --------------------------------

export interface CashOperation {
  id: string;
  fecha: string;
  tipo: 'APERTURA' | 'CIERRE' | 'VENTA' | 'INGRESO' | 'EGRESO' | 'SANGRIA';
  descripcion: string;
  monto: number;
  medio?: string | null;
  userId?: string | null;
  userNombre?: string | null;
  sessionId?: string | null;
  terminal?: string | null;
  comprobante?: string | null;
}

export interface CashOpsFilters {
  from?: string;
  to?: string;
  userId?: string;
  sucursalId?: string;
  terminalId?: string;
}

function cashQuery(f: CashOpsFilters): string {
  const q = new URLSearchParams();
  if (f.from) q.set('from', f.from);
  if (f.to) q.set('to', f.to);
  if (f.userId) q.set('userId', f.userId);
  if (f.sucursalId) q.set('sucursalId', f.sucursalId);
  if (f.terminalId) q.set('terminalId', f.terminalId);
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

export const getCashOperations = async (f: CashOpsFilters = {}) =>
  ok<CashOperation[]>(
    await fetch(`${API_BASE}/cash-sessions/operations${cashQuery(f)}`, { headers: headers() }),
    'cash-operations',
  );

export interface ArqueoTurno {
  sessionId: string;
  fechaApertura: string;
  fechaCierre: string | null;
  abierta: boolean;
  terminal: string | null;
  sucursalNombre: string | null;
  userNombre: string | null;
  montoApertura: number;
  ventas: number;
  totalVendido: number;
  montoCierre: number | null;
  diferencia: number | null;
  esRelevo: boolean;
}

export const getArqueos = async (f: CashOpsFilters = {}) =>
  ok<ArqueoTurno[]>(
    await fetch(`${API_BASE}/cash-sessions/arqueos${cashQuery(f)}`, { headers: headers() }),
    'cash-arqueos',
  );

export interface Corte {
  tipo: 'X' | 'Z';
  sessionId: string;
  terminal: string | null;
  sucursalNombre: string | null;
  userNombre: string | null;
  aperturaAt: string;
  cierreAt: string | null;
  montoApertura: number;
  ingresos: number;
  egresos: number;
  sangrias: number;
  ventas: number;
  totalVendido: number;
  porMedio: Record<string, number>;
  efectivoEsperado: number;
  montoCierre: number | null;
  diferencia: number | null;
  arqueoDetalle: Record<string, { esperado: number; contado: number; diferencia: number }> | null;
  generadoAt: string;
}

export const getCorte = async (sessionId: string) =>
  ok<Corte>(await fetch(`${API_BASE}/cash-sessions/${sessionId}/corte`, { headers: headers() }), 'cash-corte');

// --- Promociones ------------------------------------------------------------

export type PromoTipo = 'NXM' | 'CANTIDAD';

export interface Promo {
  id: string;
  productId: string;
  productoNombre: string;
  nombre: string;
  tipo: PromoTipo;
  llevaN: number;
  pagaM: number | null;
  precioTotal: number | null;
  desde: string | null;
  hasta: string | null;
  activo: boolean;
}

export interface PromoInput {
  productId: string;
  nombre: string;
  tipo: PromoTipo;
  llevaN: number;
  pagaM?: number;
  precioTotal?: number;
  activo?: boolean;
}

export const getPromos = async () =>
  ok<Promo[]>(await fetch(`${API_BASE}/products/promos`, { headers: headers() }), 'promos');

export const createPromo = async (input: PromoInput) =>
  ok<Promo>(await fetch(`${API_BASE}/products/promos`, { method: 'POST', headers: headers(), body: JSON.stringify(input) }), 'createPromo');

export const updatePromo = async (id: string, patch: Partial<PromoInput>) =>
  ok<Promo>(await fetch(`${API_BASE}/products/promos/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(patch) }), 'updatePromo');

export const deletePromo = async (id: string) =>
  ok<{ ok: boolean }>(await fetch(`${API_BASE}/products/promos/${id}`, { method: 'DELETE', headers: headers() }), 'deletePromo');

// --- Login mediado por backend (bloqueo por intentos) + gestión de accesos ---

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

export const resetUserPassword = async (membershipId: string) =>
  ok<{ email: string; password: string }>(
    await fetch(`${API_BASE}/users/${membershipId}/reset-password`, { method: 'POST', headers: headers() }),
    'resetPassword',
  );

export const unlockUser = async (membershipId: string) =>
  ok<{ ok: boolean }>(await fetch(`${API_BASE}/users/${membershipId}/unlock`, { method: 'POST', headers: headers() }), 'unlockUser');

// --- Auditoría (bitácora del tenant) ----------------------------------------

export interface AuditEvent {
  id: string;
  fecha: string;
  tipo: string;
  descripcion: string | null;
  monto: number | null;
  usuario: string | null;
  refId: string | null;
  meta: unknown;
}

export const getAuditEvents = async (params: { tipo?: string; from?: string; to?: string; limit?: number } = {}) => {
  const qs = new URLSearchParams();
  if (params.tipo) qs.set('tipo', params.tipo);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return ok<AuditEvent[]>(await fetch(`${API_BASE}/audit${suffix}`, { headers: headers() }), 'audit');
};
