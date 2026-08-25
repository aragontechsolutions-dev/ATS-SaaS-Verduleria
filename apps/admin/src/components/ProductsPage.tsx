import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCategorias, getMe, getProducts, updateProduct } from '../lib/api';
import type { Categoria, Product } from '../lib/api';
import { ProductModal } from './ProductModal';
import { BulkPriceModal } from './BulkPriceModal';
import { SkeletonRows } from './Skeleton';
import { useToast } from '../lib/toast';

// Solo ADMIN y CONTADOR pueden fijar el IVA a mano (override del motor).
const ROLES_OVERRIDE_IVA = ['ADMIN', 'CONTADOR'];

export function ProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [bulk, setBulk] = useState(false);
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

  return (
    <>
        <section className="panel">
          <div className="panel__head">
            <h2>Productos</h2>
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="search" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn btn--ghost" onClick={() => setBulk(true)}>Precios en masa</button>
              <button className="btn btn--primary" onClick={() => setCreating(true)}>+ Nuevo producto</button>
            </div>
          </div>

          {loading ? (
            <SkeletonRows rows={6} cols={5} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Unidad</th>
                    <th>IVA</th>
                    <th>Precio</th>
                    <th>Activo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className={p.activo ? '' : 'row--off'}>
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
                        <input type="checkbox" checked={p.activo} onChange={() => toggleActivo(p)} />
                      </td>
                      <td>
                        <button className="btn btn--sm btn--ghost" onClick={() => setEditing(p)}>Editar</button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="muted">Sin productos.</td></tr>
                  )}
                </tbody>
              </table>
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
    </>
  );
}
