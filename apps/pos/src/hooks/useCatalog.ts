import { useCallback, useEffect, useState } from 'react';
import { fetchCatalog } from '../lib/api';
import { getCatalog, getCatalogMeta, saveCatalog } from '../lib/db';
import { saveServerSecurity } from '../lib/security';
import type { CatalogProduct } from '../lib/types';
import type { Promo } from '../lib/promo';

export interface CatalogState {
  products: CatalogProduct[];
  promos: Promo[];
  listaPrecio: string | null;
  updatedAt: string | null;
  /** Límite de efectivo en cajón (config del tenant; null = sin límite). */
  limiteEfectivoCaja: number | null;
  /** Config de fidelización (puntos). */
  loyalty: { activo: boolean; acumulaCada: number; valorPunto: number };
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
  const [promos, setPromos] = useState<Promo[]>([]);
  const [listaPrecio, setListaPrecio] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [limiteEfectivoCaja, setLimite] = useState<number | null>(null);
  const [loyalty, setLoyalty] = useState<{ activo: boolean; acumulaCada: number; valorPunto: number }>({ activo: false, acumulaCada: 0, valorPunto: 0 });
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(true);

  const loadLocal = useCallback(async () => {
    const [local, meta] = await Promise.all([getCatalog(), getCatalogMeta()]);
    if (local.length) {
      setProducts(local);
      setPromos(meta?.promos ?? []);
      setListaPrecio(meta?.listaPrecio ?? null);
      setUpdatedAt(meta?.updatedAt ?? null);
      setLimite(meta?.limiteEfectivoCaja ?? null);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const remote = await fetchCatalog();
      const promosRemote = remote.promos ?? [];
      const limite = remote.limiteEfectivoCaja ?? null;
      await saveCatalog(remote.products, { updatedAt: remote.updatedAt, listaPrecio: remote.listaPrecio, promos: promosRemote, limiteEfectivoCaja: limite });
      setProducts(remote.products);
      setPromos(promosRemote);
      setListaPrecio(remote.listaPrecio);
      setUpdatedAt(remote.updatedAt);
      setLimite(limite);
      setLoyalty(remote.loyalty ?? { activo: false, acumulaCada: 0, valorPunto: 0 });
      // Cachea la seguridad de caja (PIN centralizado) para exigirla offline.
      saveServerSecurity(remote.security);
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

  return { products, promos, listaPrecio, updatedAt, limiteEfectivoCaja, loyalty, loading, fromCache, refresh };
}
