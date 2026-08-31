import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createVencimiento,
  deleteVencimiento,
  getMermaReport,
  getProducts,
  getSucursales,
  getVencimientos,
  resolveVencimiento,
} from '../lib/api';
import type { MermaReport, Product, Sucursal, VencimientoRow } from '../lib/api';
import { SkeletonRows } from './Skeleton';
import { MOTIVO_LABEL } from './mermaMotivos';
import { useToast } from '../lib/toast';

const money = new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 });
const cant = (n: number) => n.toLocaleString('es-UY', { maximumFractionDigits: 3 });

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function hace(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export function MermasPage() {
  const [vista, setVista] = useState<'reporte' | 'vencimientos'>('reporte');
  return (
    <>
      <div className="segmented">
        <button className={`seg ${vista === 'reporte' ? 'seg--on' : ''}`} onClick={() => setVista('reporte')}>Reporte de mermas</button>
        <button className={`seg ${vista === 'vencimientos' ? 'seg--on' : ''}`} onClick={() => setVista('vencimientos')}>Vencimientos</button>
      </div>
      {vista === 'reporte' ? <ReporteMermas /> : <Vencimientos />}
    </>
  );
}

function ReporteMermas() {
  const toast = useToast();
  const [rep, setRep] = useState<MermaReport | null>(null);
  const [from, setFrom] = useState(hace(29));
  const [to, setTo] = useState(hoyISO());

  const load = useCallback(async () => {
    setRep(null);
    try {
      setRep(await getMermaReport({ from: `${from}T00:00:00`, to: `${to}T23:59:59` }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error cargando el reporte');
    }
  }, [from, to, toast]);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <section className="tiles">
        <div className="tile"><span className="tile__label">Perdido en mermas</span><span className="tile__value">{money.format(rep?.totalCosto ?? 0)}</span></div>
        <div className="tile"><span className="tile__label">Registros</span><span className="tile__value">{rep?.registros ?? 0}</span></div>
        <div className="tile"><span className="tile__label">Productos afectados</span><span className="tile__value">{rep?.porProducto.length ?? 0}</span></div>
      </section>

      <section className="panel">
        <div className="panel__head"><h2>Mermas por producto</h2></div>
        <div className="cat-new">
          <label className="field">Desde<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field">Hasta<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        {!rep ? (
          <SkeletonRows rows={6} cols={4} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Producto</th><th className="num">Cantidad</th><th className="num">Registros</th><th className="num">Costo perdido</th></tr></thead>
              <tbody>
                {rep.porProducto.map((p) => (
                  <tr key={p.productId}>
                    <td><strong>{p.nombre}</strong></td>
                    <td className="num">{cant(p.cantidad)} {p.unidadVenta.toLowerCase()}</td>
                    <td className="num">{p.registros}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{money.format(p.costo)}</td>
                  </tr>
                ))}
                {rep.porProducto.length === 0 && <tr><td colSpan={4} className="muted">Sin mermas en el período.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {rep && rep.porMotivo.length > 0 && (
        <section className="panel">
          <div className="panel__head"><h2>Por motivo</h2></div>
          <table className="table">
            <tbody>
              {rep.porMotivo.map((m) => (
                <tr key={m.tipo}>
                  <td>{MOTIVO_LABEL[m.tipo] ?? m.tipo}</td>
                  <td className="muted" style={{ textAlign: 'right' }}>{m.registros} reg.</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{money.format(m.costo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

function Vencimientos() {
  const toast = useToast();
  const [rows, setRows] = useState<VencimientoRow[] | null>(null);
  const [estado, setEstado] = useState('vigentes');
  const [products, setProducts] = useState<Product[]>([]);
  const [sucs, setSucs] = useState<Sucursal[]>([]);

  // Formulario de alta
  const [productId, setProductId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [fecha, setFecha] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [nota, setNota] = useState('');

  const load = useCallback(async () => {
    setRows(null);
    try {
      setRows(await getVencimientos(estado));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error cargando vencimientos');
      setRows([]);
    }
  }, [estado, toast]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    getProducts().then((p) => setProducts(p.filter((x) => x.activo))).catch(() => {});
    getSucursales().then(setSucs).catch(() => {});
  }, []);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(cantidad);
    if (!productId || Number.isNaN(n) || n <= 0 || !fecha) { toast.error('Completá producto, cantidad y fecha.'); return; }
    try {
      await createVencimiento({ productId, cantidad: n, fechaVencimiento: fecha, sucursalId: sucursalId || undefined, nota: nota || undefined });
      setCantidad(''); setNota('');
      toast.success('Vencimiento registrado');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo registrar');
    }
  }

  async function resolver(v: VencimientoRow, comoMerma: boolean) {
    try {
      const r = await resolveVencimiento(v.id, comoMerma);
      toast.success(comoMerma && r.mermaId ? `${v.nombre}: descartado como merma` : `${v.nombre}: marcado como resuelto`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo resolver');
    }
  }

  async function eliminar(v: VencimientoRow) {
    if (!window.confirm(`¿Eliminar el vencimiento de ${v.nombre}?`)) return;
    try { await deleteVencimiento(v.id); toast.success('Eliminado'); void load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo eliminar'); }
  }

  const alertas = useMemo(() => (rows ?? []).filter((v) => !v.resuelto && v.diasRestantes <= 3).length, [rows]);

  return (
    <>
      <section className="panel">
        <div className="panel__head"><h2>Registrar vencimiento</h2></div>
        <form className="cat-new" onSubmit={agregar}>
          <select className="search" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Producto…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <input className="search" style={{ maxWidth: 120 }} type="number" step="0.001" placeholder="Cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          <input className="search" style={{ maxWidth: 160 }} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          {sucs.filter((s) => s.activo).length > 1 && (
            <select className="search" style={{ maxWidth: 160 }} value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
              <option value="">Sucursal…</option>
              {sucs.filter((s) => s.activo).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          )}
          <input className="search" placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
          <button className="btn btn--primary" type="submit">Agregar</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>Vencimientos {alertas > 0 && <span className="mrg mrg--bad" style={{ marginLeft: 8 }}>{alertas} por vencer/vencidos</span>}</h2>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="vigentes">Vigentes</option>
            <option value="por_vencer">Por vencer (7 días)</option>
            <option value="vencidos">Vencidos</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        {rows === null ? (
          <SkeletonRows rows={6} cols={5} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Producto</th><th>Sucursal</th><th className="num">Cantidad</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {rows.map((v) => {
                  const badge = v.resuelto ? 'mrg' : v.vencido ? 'mrg mrg--bad' : v.diasRestantes <= 3 ? 'mrg mrg--warn' : 'mrg mrg--ok';
                  const txt = v.resuelto ? 'resuelto' : v.vencido ? `vencido hace ${Math.abs(v.diasRestantes)}d` : v.diasRestantes === 0 ? 'vence hoy' : `en ${v.diasRestantes}d`;
                  return (
                    <tr key={v.id} className={v.resuelto ? 'row--off' : ''}>
                      <td><strong>{v.nombre}</strong>{v.nota ? <span className="muted"> · {v.nota}</span> : ''}</td>
                      <td>{v.sucursalNombre ?? '—'}</td>
                      <td className="num">{cant(v.cantidad)} {v.unidadVenta.toLowerCase()}</td>
                      <td>{new Date(v.fechaVencimiento).toLocaleDateString('es-UY')}</td>
                      <td><span className={badge}>{txt}</span></td>
                      <td className="row-actions">
                        {!v.resuelto && (
                          <>
                            <button className="btn btn--sm btn--ghost" onClick={() => void resolver(v, true)} title="Descartar como merma">Merma</button>
                            <button className="btn btn--sm btn--ghost" onClick={() => void resolver(v, false)} title="Ya se vendió/usó">Resuelto</button>
                          </>
                        )}
                        <button className="btn btn--sm btn--ghost" onClick={() => void eliminar(v)}>Eliminar</button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={6} className="muted">Sin vencimientos para el filtro.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">Al vencer, usá “Merma” para descartar la cantidad y que impacte en el costo y el reporte de mermas.</p>
      </section>
    </>
  );
}
