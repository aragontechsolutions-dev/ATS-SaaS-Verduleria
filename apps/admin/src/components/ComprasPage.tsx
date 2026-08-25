import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createPurchase,
  createSupplier,
  getProducts,
  getPurchases,
  getSuppliers,
  getSucursales,
  updateSupplier,
} from '../lib/api';
import type { Product, PurchaseRow, Sucursal, Supplier } from '../lib/api';
import { SkeletonRows } from './Skeleton';
import { useToast } from '../lib/toast';

interface Line {
  productId: string;
  cantidadCompra: string;
  costoUnitCompra: string;
  rindeVenta: string;
}

const emptyLine: Line = { productId: '', cantidadCompra: '', costoUnitCompra: '', rindeVenta: '' };

function money(n: number): string {
  return n.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function ComprasPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalId, setSucursalId] = useState('');
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [supplierId, setSupplierId] = useState('');
  const [notas, setNotas] = useState('');
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const [saving, setSaving] = useState(false);

  const [newSup, setNewSup] = useState({ nombre: '', telefono: '', esUam: false });

  const load = useCallback(async () => {
    try {
      const [p, s, c, su] = await Promise.all([getProducts(), getSuppliers(), getPurchases(), getSucursales()]);
      setProducts(p.filter((x) => x.activo));
      setSuppliers(s);
      setPurchases(c);
      setSucursales(su.filter((x) => x.activo));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error cargando compras');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(
    () => lines.reduce((s, l) => s + (parseFloat(l.cantidadCompra) || 0) * (parseFloat(l.costoUnitCompra) || 0), 0),
    [lines],
  );

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine }]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const items = lines
      .filter((l) => l.productId && parseFloat(l.cantidadCompra) > 0)
      .map((l) => ({
        productId: l.productId,
        cantidadCompra: parseFloat(l.cantidadCompra),
        costoUnitCompra: parseFloat(l.costoUnitCompra) || 0,
        rindeVenta: l.rindeVenta ? parseFloat(l.rindeVenta) : undefined,
      }));
    if (items.length === 0) {
      toast.error('Agregá al menos una línea con producto y cantidad.');
      return;
    }
    setSaving(true);
    try {
      const r = await createPurchase({ supplierId: supplierId || undefined, sucursalId: sucursalId || undefined, notas: notas || undefined, items });
      toast.success(`Compra registrada por $${money(r.total)} — stock actualizado`);
      setLines([{ ...emptyLine }]);
      setNotas('');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo registrar la compra');
    } finally {
      setSaving(false);
    }
  }

  async function addSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!newSup.nombre.trim()) return;
    const n = newSup.nombre.trim();
    try {
      await createSupplier({ nombre: n, telefono: newSup.telefono || undefined, esUam: newSup.esUam });
      setNewSup({ nombre: '', telefono: '', esUam: false });
      toast.success(`Proveedor “${n}” agregado correctamente`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo agregar el proveedor');
    }
  }

  async function toggleSupplier(s: Supplier) {
    try {
      await updateSupplier(s.id, { activo: !s.activo });
      toast.success(`Proveedor ${s.nombre} ${s.activo ? 'desactivado' : 'activado'}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el estado');
    }
    void load();
  }

  const unidadCompra = (id: string) => products.find((p) => p.id === id)?.unidadVenta ?? '';

  return (
    <>
      <section className="panel">
        <div className="panel__head"><h2>Nueva compra</h2></div>

        {loading ? (
          <SkeletonRows rows={4} cols={4} />
        ) : (
          <form onSubmit={submit}>
            <div className="row2">
              <label className="field">
                Proveedor
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Sin proveedor</option>
                  {suppliers.filter((s) => s.activo).map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}{s.esUam ? ' (UAM)' : ''}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Notas
                <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="ej. remito 1234" />
              </label>
            </div>
            {sucursales.length > 1 && (
              <label className="field">
                Sucursal que recibe
                <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
                  <option value="">Principal ({sucursales[0]?.nombre})</option>
                  {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </label>
            )}

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="num">Cant. compra</th>
                    <th className="num">Costo/unid.</th>
                    <th className="num">Rinde (venta)</th>
                    <th className="num">Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const sub = (parseFloat(l.cantidadCompra) || 0) * (parseFloat(l.costoUnitCompra) || 0);
                    return (
                      <tr key={i}>
                        <td>
                          <select value={l.productId} onChange={(e) => setLine(i, { productId: e.target.value })}>
                            <option value="">Elegí…</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                        </td>
                        <td className="num"><input className="price-input" type="number" step="0.001" value={l.cantidadCompra} onChange={(e) => setLine(i, { cantidadCompra: e.target.value })} /></td>
                        <td className="num"><input className="price-input" type="number" step="0.01" value={l.costoUnitCompra} onChange={(e) => setLine(i, { costoUnitCompra: e.target.value })} /></td>
                        <td className="num">
                          <input className="price-input" type="number" step="0.001" value={l.rindeVenta}
                            onChange={(e) => setLine(i, { rindeVenta: e.target.value })}
                            placeholder={`auto ${unidadCompra(l.productId).toLowerCase()}`} />
                        </td>
                        <td className="num">${money(sub)}</td>
                        <td className="num"><button type="button" className="btn btn--sm btn--ghost" onClick={() => removeLine(i)}>✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="compra__foot">
              <button type="button" className="btn btn--ghost" onClick={addLine}>+ Agregar línea</button>
              <div className="compra__total">Total: <strong>${money(total)}</strong></div>
              <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Registrando…' : 'Registrar compra'}</button>
            </div>
            <p className="hint">Comprás por cajón/bolsa y el sistema calcula el costo por kilo con el rinde y la merma del producto. Dejá el rinde vacío para usar el factor de conversión.</p>
          </form>
        )}
      </section>

      <section className="panel">
        <div className="panel__head"><h2>Proveedores</h2></div>
        <form className="cat-new" onSubmit={addSupplier}>
          <input className="search" placeholder="Nuevo proveedor…" value={newSup.nombre} onChange={(e) => setNewSup({ ...newSup, nombre: e.target.value })} />
          <input className="search" placeholder="Teléfono" value={newSup.telefono} onChange={(e) => setNewSup({ ...newSup, telefono: e.target.value })} />
          <label className="chk"><input type="checkbox" checked={newSup.esUam} onChange={(e) => setNewSup({ ...newSup, esUam: e.target.checked })} /> UAM</label>
          <button className="btn btn--primary" type="submit">Agregar</button>
        </form>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Proveedor</th><th>Teléfono</th><th>UAM</th><th>Activo</th></tr></thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className={s.activo ? '' : 'row--off'}>
                  <td><strong>{s.nombre}</strong></td>
                  <td>{s.telefono ?? '—'}</td>
                  <td>{s.esUam ? '✓' : '—'}</td>
                  <td><input type="checkbox" checked={s.activo} onChange={() => toggleSupplier(s)} /></td>
                </tr>
              ))}
              {suppliers.length === 0 && <tr><td colSpan={4} className="muted">Sin proveedores.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head"><h2>Compras recientes</h2></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th>Proveedor</th><th className="num">Líneas</th><th className="num">Total</th><th>Notas</th></tr></thead>
            <tbody>
              {purchases.map((c) => (
                <tr key={c.id}>
                  <td>{new Date(c.fecha).toLocaleDateString('es-UY')}</td>
                  <td>{c.supplierNombre ?? '—'}</td>
                  <td className="num">{c.lineas}</td>
                  <td className="num">${money(c.total)}</td>
                  <td>{c.notas ?? '—'}</td>
                </tr>
              ))}
              {purchases.length === 0 && <tr><td colSpan={5} className="muted">Sin compras registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
