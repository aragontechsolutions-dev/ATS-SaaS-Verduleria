import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPromo, deletePromo, getProducts, getPromos, updatePromo } from '../lib/api';
import type { Product, Promo, PromoTipo } from '../lib/api';
import { ProductSearchSelect } from './ProductSearchSelect';
import { SkeletonRows } from './Skeleton';
import { useToast } from '../lib/toast';

const money = new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 });

function resumen(p: Promo): string {
  if (p.tipo === 'NXM') return `Lleva ${p.llevaN}, paga ${p.pagaM} (${p.llevaN}x${p.pagaM})`;
  return `${p.llevaN} x ${money.format(p.precioTotal ?? 0)}`;
}

export function PromocionesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Promo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  // Formulario de alta.
  const [productId, setProductId] = useState('');
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<PromoTipo>('NXM');
  const [llevaN, setLlevaN] = useState(2);
  const [pagaM, setPagaM] = useState(1);
  const [precioTotal, setPrecioTotal] = useState('');
  const [guardando, setGuardando] = useState(false);

  const unitarios = useMemo(() => products.filter((p) => !p.esPesable), [products]);

  const load = useCallback(async () => {
    try {
      const [ps, prods] = await Promise.all([getPromos(), getProducts()]);
      setRows(ps);
      setProducts(prods);
      setLocked(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error';
      if (msg.includes('permisos') || msg.includes('403')) setLocked(true);
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  async function crear() {
    if (!productId) return toast.error('Elegí un producto.');
    if (nombre.trim().length < 1) return toast.error('Ponele un nombre a la promo.');
    if (tipo === 'NXM' && !(pagaM >= 1 && pagaM < llevaN)) return toast.error('En NxM, "paga" debe ser menor que "lleva".');
    const precio = parseFloat(precioTotal.replace(',', '.')) || 0;
    if (tipo === 'CANTIDAD' && !(precio > 0)) return toast.error('Indicá el precio total.');
    setGuardando(true);
    try {
      await createPromo({
        productId,
        nombre: nombre.trim(),
        tipo,
        llevaN,
        pagaM: tipo === 'NXM' ? pagaM : undefined,
        precioTotal: tipo === 'CANTIDAD' ? precio : undefined,
      });
      setProductId(''); setNombre(''); setPrecioTotal('');
      toast.success('Promoción creada');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear');
    } finally {
      setGuardando(false);
    }
  }

  async function toggle(p: Promo) {
    try {
      await updatePromo(p.id, { activo: !p.activo });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar');
    }
  }

  async function eliminar(p: Promo) {
    if (!window.confirm(`¿Eliminar la promo "${p.nombre}"?`)) return;
    try {
      await deletePromo(p.id);
      toast.success('Promoción eliminada');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  }

  if (locked) {
    return <section className="panel"><h2>Promociones</h2><p className="muted">No tenés permisos para gestionar promociones.</p></section>;
  }

  return (
    <>
      <section className="panel">
        <div className="panel__head"><h2>Nueva promoción</h2></div>
        <p className="muted" style={{ marginTop: -6 }}>2x1 / NxM y "N por un precio". Se aplican solas en el POS a productos por unidad.</p>
        <div className="form-grid">
          <label className="field">
            Producto (por unidad)
            <ProductSearchSelect products={unitarios} value={productId} onChange={setProductId} placeholder="Buscar producto…" />
          </label>
          <label className="field">
            Nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: 2x1 morrones" />
          </label>
          <label className="field">
            Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value as PromoTipo)}>
              <option value="NXM">Lleva N, paga M (2x1, 3x2…)</option>
              <option value="CANTIDAD">N por un precio (3 x $100)</option>
            </select>
          </label>
          <label className="field">
            Lleva (N)
            <input type="number" min={2} value={llevaN} onChange={(e) => setLlevaN(Math.max(2, parseInt(e.target.value, 10) || 2))} />
          </label>
          {tipo === 'NXM' ? (
            <label className="field">
              Paga (M)
              <input type="number" min={1} value={pagaM} onChange={(e) => setPagaM(Math.max(1, parseInt(e.target.value, 10) || 1))} />
            </label>
          ) : (
            <label className="field">
              Precio total
              <input type="number" min={0} value={precioTotal} onChange={(e) => setPrecioTotal(e.target.value)} placeholder="100" />
            </label>
          )}
        </div>
        <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => void crear()} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Crear promoción'}
        </button>
      </section>

      <section className="panel">
        <div className="panel__head"><h2>Promociones ({rows.length})</h2></div>
        {loading ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <p className="muted">No hay promociones.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Producto</th><th>Promo</th><th>Detalle</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.5 }}>
                    <td>{p.productoNombre}</td>
                    <td>{p.nombre}</td>
                    <td>{resumen(p)}</td>
                    <td>
                      <button className="btn btn--ghost btn--sm" onClick={() => void toggle(p)}>
                        {p.activo ? '● Activa' : '○ Inactiva'}
                      </button>
                    </td>
                    <td><button className="btn btn--ghost btn--sm" onClick={() => void eliminar(p)}>Eliminar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
