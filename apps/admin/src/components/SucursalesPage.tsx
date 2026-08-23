import { useCallback, useEffect, useState } from 'react';
import { createSucursal, getProducts, getSucursales, transferStock, updateSucursal } from '../lib/api';
import type { Product, Sucursal } from '../lib/api';

function money(n: number): string {
  return n.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

export function SucursalesPage() {
  const [sucs, setSucs] = useState<Sucursal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');

  // Transferencia
  const [tProd, setTProd] = useState('');
  const [tFrom, setTFrom] = useState('');
  const [tTo, setTTo] = useState('');
  const [tCant, setTCant] = useState('');
  const [transfering, setTransfering] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, p] = await Promise.all([getSucursales(), getProducts()]);
      setSucs(s);
      setProducts(p.filter((x) => x.activo));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function flash(m: string) {
    setOkMsg(m);
    window.setTimeout(() => setOkMsg(null), 3500);
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    try {
      await createSucursal({ nombre: nombre.trim(), direccion: direccion || undefined });
      setNombre('');
      setDireccion('');
      flash('Sucursal creada.');
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function renombrar(s: Sucursal) {
    const nuevo = window.prompt('Nuevo nombre', s.nombre);
    if (!nuevo || nuevo.trim() === s.nombre) return;
    await updateSucursal(s.id, { nombre: nuevo.trim() }).catch((e) => setError(String(e)));
    void load();
  }

  async function toggle(s: Sucursal) {
    await updateSucursal(s.id, { activo: !s.activo }).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    void load();
  }

  async function transferir(e: React.FormEvent) {
    e.preventDefault();
    const cant = parseFloat(tCant);
    if (!tProd || !tFrom || !tTo || Number.isNaN(cant) || cant <= 0) {
      setError('Completá producto, origen, destino y cantidad.');
      return;
    }
    if (tFrom === tTo) {
      setError('El origen y el destino deben ser distintos.');
      return;
    }
    setTransfering(true);
    setError(null);
    try {
      const r = await transferStock({ productId: tProd, fromSucursalId: tFrom, toSucursalId: tTo, cantidad: cant });
      flash(`Transferido: ${r.from.nombre} → ${r.to.nombre}. Ahora ${r.to.nombre} tiene ${money(r.to.cantidad)}.`);
      setTCant('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo transferir');
    } finally {
      setTransfering(false);
    }
  }

  const activas = sucs.filter((s) => s.activo);
  const puedeTransferir = activas.length >= 2;

  return (
    <>
      {error && <div className="banner banner--err">{error}</div>}
      {okMsg && <div className="banner banner--ok">{okMsg}</div>}

      <section className="panel">
        <div className="panel__head"><h2>Sucursales</h2></div>
        <form className="cat-new" onSubmit={crear}>
          <input className="search" placeholder="Nueva sucursal…" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <input className="search" placeholder="Dirección (opcional)" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          <button className="btn btn--primary" type="submit">Agregar</button>
        </form>

        {loading ? (
          <p className="muted">Cargando…</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Sucursal</th><th>Dirección</th><th>Activa</th><th></th></tr></thead>
              <tbody>
                {sucs.map((s) => (
                  <tr key={s.id} className={s.activo ? '' : 'row--off'}>
                    <td>{s.codigo}</td>
                    <td><strong>{s.nombre}</strong></td>
                    <td>{s.direccion ?? '—'}</td>
                    <td><input type="checkbox" checked={s.activo} onChange={() => toggle(s)} /></td>
                    <td><button className="btn btn--sm btn--ghost" onClick={() => renombrar(s)}>Renombrar</button></td>
                  </tr>
                ))}
                {sucs.length === 0 && <tr><td colSpan={5} className="muted">Sin sucursales.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">Agregar sucursales requiere el plan con multi-sucursal. El código DGI se asigna automático.</p>
      </section>

      <section className="panel">
        <div className="panel__head"><h2>Transferir stock entre sucursales</h2></div>
        {!puedeTransferir ? (
          <p className="muted">Necesitás al menos dos sucursales activas para transferir stock.</p>
        ) : (
          <form onSubmit={transferir}>
            <div className="row2">
              <label className="field">
                Producto
                <select value={tProd} onChange={(e) => setTProd(e.target.value)}>
                  <option value="">Elegí…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </label>
              <label className="field">
                Cantidad
                <input type="number" step="0.001" value={tCant} onChange={(e) => setTCant(e.target.value)} placeholder="ej. 10" />
              </label>
            </div>
            <div className="row2">
              <label className="field">
                Desde
                <select value={tFrom} onChange={(e) => setTFrom(e.target.value)}>
                  <option value="">Origen…</option>
                  {activas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </label>
              <label className="field">
                Hacia
                <select value={tTo} onChange={(e) => setTTo(e.target.value)}>
                  <option value="">Destino…</option>
                  {activas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </label>
            </div>
            <div className="modal__actions">
              <button type="submit" className="btn btn--primary" disabled={transfering}>{transfering ? 'Transfiriendo…' : 'Transferir'}</button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
