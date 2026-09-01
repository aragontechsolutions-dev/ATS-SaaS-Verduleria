import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSugerido } from '../lib/api';
import type { SugeridoGrupo } from '../lib/api';
import { SkeletonRows } from './Skeleton';
import { useToast } from '../lib/toast';

const money = new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 });
const cant = (n: number) => n.toLocaleString('es-UY', { maximumFractionDigits: 3 });

const DIAS_OPCIONES = [2, 3, 4, 7];

/** Sugerido de compra (reposición) agrupado por proveedor. */
export function SugeridoCompra() {
  const toast = useToast();
  const [grupos, setGrupos] = useState<SugeridoGrupo[] | null>(null);
  const [dias, setDias] = useState(4);
  const [abierto, setAbierto] = useState(false);

  const load = useCallback(async () => {
    setGrupos(null);
    try {
      setGrupos(await getSugerido(dias));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error calculando el sugerido');
      setGrupos([]);
    }
  }, [dias, toast]);

  useEffect(() => { if (abierto) void load(); }, [abierto, load]);

  const totalGeneral = useMemo(() => (grupos ?? []).reduce((s, g) => s + g.totalEstimado, 0), [grupos]);
  const totalItems = useMemo(() => (grupos ?? []).reduce((s, g) => s + g.items.length, 0), [grupos]);

  function imprimir(g: SugeridoGrupo) {
    const filas = g.items
      .map((it) => `<tr><td>${it.nombre}</td><td style="text-align:right">${cant(it.sugeridoCompra)} ${it.unidadCompra.toLowerCase()}</td><td style="text-align:right">${cant(it.sugeridoVenta)} ${it.unidadVenta.toLowerCase()}</td></tr>`)
      .join('');
    const w = window.open('', 'ATS_Sugerido', 'width=520,height=700');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Pedido · ${g.proveedorNombre}</title>
      <style>*{font-family:system-ui,Arial}body{padding:16px;color:#111}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:6px 4px;border-bottom:1px solid #ddd;text-align:left}</style></head><body>
      <h1>Pedido a ${g.proveedorNombre}</h1>
      <p>${new Date().toLocaleDateString('es-UY')} · ATS SISGESVER</p>
      <table><thead><tr><th>Producto</th><th style="text-align:right">Comprar</th><th style="text-align:right">Equivale a</th></tr></thead><tbody>${filas}</tbody></table>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>🛒 Sugerido de compra</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {abierto && (
            <label className="field" style={{ margin: 0 }}>
              Cobertura
              <select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
                {DIAS_OPCIONES.map((d) => <option key={d} value={d}>{d} días</option>)}
              </select>
            </label>
          )}
          <button className="btn btn--ghost btn--sm" onClick={() => setAbierto((v) => !v)}>
            {abierto ? 'Ocultar' : 'Calcular reposición'}
          </button>
        </div>
      </div>

      {!abierto ? (
        <p className="muted">Estima cuánto reponer según la venta de los últimos 30 días y el stock actual, agrupado por proveedor.</p>
      ) : grupos === null ? (
        <SkeletonRows rows={5} cols={4} />
      ) : grupos.length === 0 ? (
        <p className="muted">No hay nada para reponer con {dias} días de cobertura. 👌</p>
      ) : (
        <>
          <p className="muted">{totalItems} productos a reponer · costo estimado {money.format(totalGeneral)} (cobertura {dias} días, según venta de 30 días).</p>
          {grupos.map((g) => (
            <div key={g.proveedorId ?? 'sin'} className="sugerido-grupo">
              <div className="panel__head">
                <h3>{g.proveedorNombre} <span className="muted">· {money.format(g.totalEstimado)}</span></h3>
                <button className="btn btn--sm btn--ghost" onClick={() => imprimir(g)}>🖨 Imprimir pedido</button>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Producto</th><th className="num">Stock</th><th className="num">Venta/día</th><th className="num">Comprar</th><th className="num">Estimado</th></tr>
                  </thead>
                  <tbody>
                    {g.items.map((it) => (
                      <tr key={it.productId}>
                        <td>
                          <strong>{it.nombre}</strong>
                          {it.quiebre ? <span className="mrg mrg--bad" style={{ marginLeft: 6 }}>quiebre</span> : it.bajoMinimo ? <span className="mrg mrg--warn" style={{ marginLeft: 6 }}>bajo mínimo</span> : null}
                        </td>
                        <td className="num">{cant(it.stockActual)} {it.unidadVenta.toLowerCase()}{it.diasCobertura != null ? <span className="muted"> · {it.diasCobertura}d</span> : ''}</td>
                        <td className="num">{cant(it.ventaDiaria)}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{cant(it.sugeridoCompra)} {it.unidadCompra.toLowerCase()}</td>
                        <td className="num">{money.format(it.costoEstimado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="hint">“Comprar” está en unidad de compra (ej. cajón). Configurá proveedor habitual y stock mínimo en cada producto para afinar el sugerido.</p>
        </>
      )}
    </section>
  );
}
