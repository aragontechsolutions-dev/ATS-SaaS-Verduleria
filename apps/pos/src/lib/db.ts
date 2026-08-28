// IndexedDB (vía Dexie) como fuente de verdad LOCAL del POS.
//  - `catalog`: productos + precios cacheados para vender sin conexión.
//  - `outbox`: cola de ventas pendientes de subir al backend (con idempotencia).
import Dexie, { type Table } from 'dexie';
import type { CatalogProduct, OutboxSale } from './types';
import type { ParkedTicket } from '../state/cart';
import type { Promo } from './promo';

export interface CatalogMeta {
  key: string; // 'catalog'
  updatedAt: string;
  listaPrecio: string | null;
  promos?: Promo[];
}

class PosDatabase extends Dexie {
  catalog!: Table<CatalogProduct, string>;
  meta!: Table<CatalogMeta, string>;
  outbox!: Table<OutboxSale, string>;
  parked!: Table<ParkedTicket, string>;

  constructor() {
    super('ats-pos');
    this.version(1).stores({
      // índices: plu y codigoBarras para resolver escaneos rápido.
      catalog: 'id, plu, codigoBarras, nombre, categoriaId',
      meta: 'key',
      outbox: 'id, status, createdAt',
    });
    // v2: tickets suspendidos (venta en espera).
    this.version(2).stores({
      parked: 'id, createdAt',
    });
  }
}

export const db = new PosDatabase();

// --- Catálogo ---------------------------------------------------------------

export async function saveCatalog(
  products: CatalogProduct[],
  meta: { updatedAt: string; listaPrecio: string | null; promos?: Promo[] },
): Promise<void> {
  await db.transaction('rw', db.catalog, db.meta, async () => {
    await db.catalog.clear();
    await db.catalog.bulkPut(products);
    await db.meta.put({ key: 'catalog', ...meta });
  });
}

export async function getCatalog(): Promise<CatalogProduct[]> {
  return db.catalog.orderBy('nombre').toArray();
}

export async function getProductByPlu(plu: number): Promise<CatalogProduct | undefined> {
  return db.catalog.where('plu').equals(plu).first();
}

export async function getProductByBarcode(code: string): Promise<CatalogProduct | undefined> {
  return db.catalog.where('codigoBarras').equals(code).first();
}

export async function getCatalogMeta(): Promise<CatalogMeta | undefined> {
  return db.meta.get('catalog');
}

// --- Outbox (ventas) --------------------------------------------------------

export async function enqueueSale(sale: OutboxSale): Promise<void> {
  await db.outbox.put(sale);
}

export async function getPendingSales(): Promise<OutboxSale[]> {
  return db.outbox.where('status').anyOf('pending', 'error').sortBy('createdAt');
}

export async function updateSale(id: string, patch: Partial<OutboxSale>): Promise<void> {
  await db.outbox.update(id, patch);
}

export async function getSale(id: string): Promise<OutboxSale | undefined> {
  return db.outbox.get(id);
}

/** Todas las operaciones (ventas) guardadas, de la más nueva a la más vieja. */
export async function getAllSales(limit = 200): Promise<OutboxSale[]> {
  const all = await db.outbox.orderBy('createdAt').reverse().toArray();
  return all.slice(0, limit);
}

export async function countPending(): Promise<number> {
  return db.outbox.where('status').anyOf('pending', 'error', 'syncing').count();
}

// --- Tickets suspendidos (venta en espera) ----------------------------------

export async function parkTicket(ticket: ParkedTicket): Promise<void> {
  await db.parked.put(ticket);
}

export async function getParkedTickets(): Promise<ParkedTicket[]> {
  return db.parked.orderBy('createdAt').reverse().toArray();
}

export async function deleteParked(id: string): Promise<void> {
  await db.parked.delete(id);
}

export async function countParked(): Promise<number> {
  return db.parked.count();
}
