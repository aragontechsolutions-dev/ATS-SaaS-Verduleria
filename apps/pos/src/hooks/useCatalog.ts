import { useCallback, useEffect, useState } from 'react';
import { fetchCatalog } from '../lib/api';
import { getCatalog, getCatalogMeta, saveCatalog } from '../lib/db';
import type { CatalogProduct } from '../lib/types';

export interface CatalogState {
  products: CatalogProduct[];
  listaPrecio: string | null;
  updatedAt: string | null;
  loading: boolean;
  /** true si los datos vienen del cache local (sin conexión). */
  fromCache: boolean;
  refresh: () => Promise<void>;
}

/**
 * Carga el catálogo: primero desde IndexedDB (instantáneo, offline), y en
 * paralelo intenta refrescar desde el backend y re-cachear.
 */
export function useCatalog(): CatalogState {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [listaPrecio, setListaPrecio] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(true);

  const loadLocal = useCallback(async () => {
    const [local, meta] = await Promise.all([getCatalog(), getCatalogMeta()]);
    if (local.length) {
      setProducts(local);
      setListaPrecio(meta?.listaPrecio ?? null);
      setUpdatedAt(meta?.updatedAt ?? null);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const remote = await fetchCatalog();
      await saveCatalog(remote.products, { updatedAt: remote.updatedAt, listaPrecio: remote.listaPrecio });
      setProducts(remote.products);
      setListaPrecio(remote.listaPrecio);
      setUpdatedAt(remote.updatedAt);
      setFromCache(false);
    } catch {
      setFromCache(true); // sin conexión: nos quedamos con el cache local
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadLocal();
      setLoading(false);
      await refresh();
    })();
  }, [loadLocal, refresh]);

  return { products, listaPrecio, updatedAt, loading, fromCache, refresh };
}
