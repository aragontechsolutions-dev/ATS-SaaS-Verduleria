import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCategorias, getMe, getProducts, setVisibleOnline, updateProduct } from '../lib/api';
import type { Categoria, Product } from '../lib/api';
import { ProductModal } from './ProductModal';
import { BulkPriceModal } from './BulkPriceModal';
import { ImportCatalogModal } from './ImportCatalogModal';
import { SkeletonRows } from './Skeleton';
import { useToast } from '../lib/toast';

// Solo ADMIN y CONTADOR pueden fijar el IVA a mano (override del motor).
const ROLES_OVERRIDE_IVA = ['ADMIN', 'CONTADOR'];

export function ProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [importar, setImportar] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [aplicando, setAplicando] = useState(false);
  const [canOverrideIva, setCanOverrideIva] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([getProducts(), getCategorias()]);
      setProducts(p);
      setCategorias(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error cargando');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    getMe().then((me) => setCanOverrideIva(ROLES_OVERRIDE_IVA.includes(me.role ?? ''))).catch(() => {});
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? products.filter((p) => p.nombre.toLowerCase().includes(t) || String(p.plu ?? '').includes(t)) : products;
  }, [products, q]);

  // Paginación (client-side): resetea a la página 1 al filtrar o cambiar el tamaño.
  const totalPaginas = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { setPage(0); }, [q, pageSize]);
  useEffect(() => { if (page > totalPaginas - 1) setPage(totalPaginas - 1); }, [page, totalPaginas]);
  const pagina = filtered.slice(page * pageSize, page * pageSize + pageSize);

  async function savePrice(p: Product, nuevo: number) {
    if (nuevo === p.precio || Number.isNaN(nuevo)) return;
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, precio: nuevo } : x)));
    try {
      await updateProduct(p.id, { precio: nuevo });
      toast.success(`Precio de ${p.nombre} actualizado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el precio');
      void load();
    }
  }

  async function toggleActivo(p: Product) {
    try {
      await updateProduct(p.id, { activo: !p.activo });
      toast.success(`${p.nombre} ${p.activo ? 'desactivado' : 'activado'}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el estado');
    }
    void load();
  }

  function toggleSel(id: string) {
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function seleccionar(ids: string[], on: boolean) {
    setSel((s) => { const n = new Set(s); for (const id of ids) on ? n.add(id) : n.delete(id); return n; });
  }
  async function aplicarVisibilidad(visible: boolean) {
    const ids = [...sel];
    if (!ids.length) return;
    setAplicando(true);
    try {
      await setVisibleOnline(ids, visible);
      toast.success(`${ids.length} producto${ids.length === 1 ? '' : 's'} ${visible ? 'visible' : 'oculto'}${ids.length === 1 ? '' : 's'} en la tienda`);
      setSel(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setAplicando(false);
    }
  }

  return (
    <>
        <section className="panel">
          <div className="panel__head">
            <h2>Productos</h2>
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="search" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="search" style={{ maxWidth: 130 }} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} title="Productos por página">
                <option value={10}>10 por pág.</option>
                <option value={20}>20 por pág.</option>
                <option value={50}>50 por pág.</option>
                <option value={100}>100 por pág.</option>
              </select>
              <button className="btn btn--ghost" onClick={() => setImportar(true)}>Importar CSV</button>
              <button className="btn btn--ghost" onClick={() => setBulk(true)}>Precios en masa</button>
              <button className="btn btn--primary" onClick={() => setCreating(true)}>+ Nuevo producto</button>
            </div>
          </div>

          {sel.size > 0 && (
            <div className="bulkbar">
              <span><strong>{sel.size}</strong> seleccionado{sel.size === 1 ? '' : 's'}</span>
              {sel.size < filtered.length && (
                <button className="btn btn--sm btn--ghost" onClick={() => seleccionar(filtered.map((p) => p.id), true)}>
                  Seleccionar los {filtered.length} del filtro
                </button>
              )}
              <span className="bulkbar__spacer" />
              <button className="btn btn--sm btn--primary" disabled={aplicando} onClick={() => void aplicarVisibilidad(true)}>🛒 Mostrar en tienda</button>
              <button className="btn btn--sm btn--ghost" disabled={aplicando} onClick={() => void aplicarVisibilidad(false)}>Quitar de la tienda</button>
              <button className="btn btn--sm btn--ghost" onClick={() => setSel(new Set())}>Limpiar</button>
            </div>
          )}

          {loading ? (
            <SkeletonRows rows={6} cols={5} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 34 }}>
                      <input
                        type="checkbox"
                        aria-label="Seleccionar la página"
                        checked={pagina.length > 0 && pagina.every((p) => sel.has(p.id))}
                        onChange={(e) => seleccionar(pagina.map((p) => p.id), e.target.checked)}
                      />
                    </th>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Unidad</th>
                    <th>IVA</th>
                    <th>Precio</th>
                    <th>Tienda</th>
                    <th>Activo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pagina.map((p) => (
                    <tr key={p.id} className={`${p.activo ? '' : 'row--off'} ${sel.has(p.id) ? 'row--sel' : ''}`}>
                      <td>
                        <input type="checkbox" aria-label={`Seleccionar ${p.nombre}`} checked={sel.has(p.id)} onChange={() => toggleSel(p.id)} />
                      </td>
                      <td>
                        <strong>{p.nombre}</strong>
                        {p.plu != null && <span className="muted"> · PLU {p.plu}</span>}
                        {p.esPesable && <span className="tag">⚖</span>}
                      </td>
                      <td>{p.categoriaNombre ?? '—'}</td>
                      <td>{p.unidadVenta.toLowerCase()}</td>
                      <td>{p.ivaIndicador}</td>
                      <td>
                        <input
                          className="price-input"
                          type="number"
                          step="0.01"
                          defaultValue={p.precio}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          onBlur={(e) => savePrice(p, parseFloat(e.target.value))}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          title={p.visibleOnline ? 'Visible en la tienda online' : 'Oculto en la tienda'}
                          checked={p.visibleOnline}
                          onChange={async () => {
                            try {
                              await setVisibleOnline([p.id], !p.visibleOnline);
                              void load();
                            } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo actualizar'); }
                          }}
                        />
                      </td>
                      <td>
                        <input type="checkbox" checked={p.activo} onChange={() => toggleActivo(p)} />
                      </td>
                      <td>
                        <button className="btn btn--sm btn--ghost" onClick={() => setEditing(p)}>Editar</button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="muted">Sin productos.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filtered.length > pageSize && (
            <div className="pager">
              <button className="btn btn--sm btn--ghost" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>‹ Anterior</button>
              <span className="pager__info">
                {page * pageSize + 1}–{Math.min(filtered.length, (page + 1) * pageSize)} de {filtered.length}
              </span>
              <button className="btn btn--sm btn--ghost" onClick={() => setPage((p) => Math.min(totalPaginas - 1, p + 1))} disabled={page >= totalPaginas - 1}>Siguiente ›</button>
            </div>
          )}
          <p className="hint">Tip: editá el precio directo en la columna y presioná Enter — se guarda solo.</p>
        </section>
      {creating && (
        <ProductModal categorias={categorias} canOverrideIva={canOverrideIva} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load(); }} />
      )}
      {editing && (
        <ProductModal product={editing} categorias={categorias} canOverrideIva={canOverrideIva} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />
      )}
      {bulk && (
        <BulkPriceModal
          categorias={categorias}
          onClose={() => setBulk(false)}
          onDone={(n) => { setBulk(false); toast.success(`Precios actualizados: ${n} producto${n === 1 ? '' : 's'}`); void load(); }}
        />
      )}
      {importar && (
        <ImportCatalogModal onClose={() => setImportar(false)} onImported={() => void load()} />
      )}
    </>
  );
}
