import { useCallback, useEffect, useMemo, useState } from 'react';
import { getByCategory, getByHour, getDaily, getProfit, getSummary, getTopProducts } from '../lib/api';
import type { CategoryRow, DailyPoint, HourPoint, ProfitReport, ReportSummary, TopProduct } from '../lib/api';
import { SkeletonCards } from './Skeleton';
import { useToast } from '../lib/toast';

const money = new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 });

function margenClass(m: number | null): string {
  if (m == null) return 'muted';
  if (m < 15) return 'mrg mrg--bad';
  if (m < 30) return 'mrg mrg--warn';
  return 'mrg mrg--ok';
}

type Preset = 'hoy' | '7d' | '30d';

function rangeFor(preset: Preset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === '7d') from.setDate(from.getDate() - 6);
  if (preset === '30d') from.setDate(from.getDate() - 29);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export function ReportsPage() {
  const toast = useToast();
  const [preset, setPreset] = useState<Preset>('hoy');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [categorias, setCategorias] = useState<CategoryRow[]>([]);
  const [porHora, setPorHora] = useState<HourPoint[]>([]);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [profit, setProfit] = useState<ProfitReport | null>(null);
  const [profitLocked, setProfitLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: Preset) => {
    setLoading(true);
    try {
      const r = rangeFor(p);
      const [s, t, cat, hr, d] = await Promise.all([
        getSummary(r),
        getTopProducts(r),
        getByCategory(r),
        getByHour(r),
        getDaily(p === '30d' ? 30 : 7),
      ]);
      setSummary(s);
      setTop(t);
      setCategorias(cat);
      setPorHora(hr);
      setDaily(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error cargando reportes');
    } finally {
      setLoading(false);
    }
    // Rentabilidad es un reporte avanzado: si el plan no lo incluye devuelve 403,
    // así que lo cargamos aparte para no romper el resto de la página.
    try {
      setProfit(await getProfit(rangeFor(p)));
      setProfitLocked(false);
    } catch {
      setProfit(null);
      setProfitLocked(true);
    }
  }, [toast]);

  useEffect(() => {
    void load(preset);
  }, [preset, load]);

  const maxDaily = useMemo(() => Math.max(1, ...daily.map((d) => d.total)), [daily]);
  const maxHora = useMemo(() => Math.max(1, ...porHora.map((h) => h.total)), [porHora]);
  const totalCategorias = useMemo(() => categorias.reduce((s, c) => s + c.monto, 0), [categorias]);
  // Acota el gráfico por hora a la franja con actividad (evita 24 barras vacías).
  const horasActivas = useMemo(() => {
    const idx = porHora.map((h, i) => (h.total > 0 ? i : -1)).filter((i) => i >= 0);
    if (idx.length === 0) return porHora.slice(8, 21); // franja comercial por defecto
    return porHora.slice(Math.min(...idx), Math.max(...idx) + 1);
  }, [porHora]);

  return (
    <>
      <div className="segmented">
        {(['hoy', '7d', '30d'] as Preset[]).map((p) => (
          <button key={p} className={`seg ${preset === p ? 'seg--on' : ''}`} onClick={() => setPreset(p)}>
            {p === 'hoy' ? 'Hoy' : p === '7d' ? 'Últimos 7 días' : 'Últimos 30 días'}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonCards count={4} />
      ) : (
        <>
          <section className="tiles">
            <div className="tile"><span className="tile__label">Vendido</span><span className="tile__value">{money.format(summary?.totalVendido ?? 0)}</span></div>
            <div className="tile"><span className="tile__label">Ventas</span><span className="tile__value">{summary?.ventas ?? 0}</span></div>
            <div className="tile"><span className="tile__label">Ticket prom.</span><span className="tile__value">{money.format(summary?.ticketPromedio ?? 0)}</span></div>
            <div className="tile"><span className="tile__label">IVA</span><span className="tile__value">{money.format(summary?.ivaTotal ?? 0)}</span></div>
          </section>

          {profit && (
            <section className="panel">
              <div className="panel__head">
                <h2>Rentabilidad</h2>
                {profit.coberturaPct != null && profit.coberturaPct < 99.5 && (
                  <span className="pill">Cobertura de costos: {profit.coberturaPct}%</span>
                )}
              </div>
              <section className="tiles">
                <div className="tile tile--accent">
                  <span className="tile__label">Ganancia bruta</span>
                  <span className="tile__value">{money.format(profit.ganancia)}</span>
                </div>
                <div className="tile">
                  <span className="tile__label">Margen</span>
                  <span className="tile__value">{profit.margenPct != null ? `${profit.margenPct}%` : '—'}</span>
                </div>
                <div className="tile">
                  <span className="tile__label">Costo mercadería</span>
                  <span className="tile__value">{money.format(profit.costo)}</span>
                </div>
                <div className="tile">
                  <span className="tile__label">Ingresos</span>
                  <span className="tile__value">{money.format(profit.ingresos)}</span>
                </div>
              </section>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="num">Ingresos</th>
                      <th className="num">Costo</th>
                      <th className="num">Ganancia</th>
                      <th className="num">Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profit.productos.map((p, i) => (
                      <tr key={p.productId ?? `x${i}`}>
                        <td>
                          <strong>{p.nombre}</strong>
                          {p.parcial && <span className="muted" title="Parte de las ventas no tenía costo cargado"> · parcial</span>}
                        </td>
                        <td className="num">{money.format(p.ingresos)}</td>
                        <td className="num">{money.format(p.costo)}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{p.ganancia != null ? money.format(p.ganancia) : 's/d'}</td>
                        <td className="num"><span className={margenClass(p.margenPct)}>{p.margenPct != null ? `${p.margenPct}%` : '—'}</span></td>
                      </tr>
                    ))}
                    {profit.productos.length === 0 && <tr><td colSpan={5} className="muted">Sin ventas en el período.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="hint">Ganancia = precio de venta − costo real (con merma). Los productos sin costo cargado se muestran como “s/d”.</p>
            </section>
          )}
          {profitLocked && (
            <section className="panel">
              <div className="panel__head"><h2>Rentabilidad</h2></div>
              <p className="muted">Los reportes de rentabilidad están disponibles en el plan Pro o Full.</p>
            </section>
          )}

          <div className="cols">
            <section className="panel">
              <div className="panel__head"><h2>Ventas por día</h2></div>
              <div className="bars">
                {daily.map((d) => (
                  <div className="bar" key={d.dia} title={`${d.dia}: ${money.format(d.total)}`}>
                    <div className="bar__fill" style={{ height: `${(d.total / maxDaily) * 100}%` }} />
                    <span className="bar__label">{d.dia.slice(8)}/{d.dia.slice(5, 7)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel__head"><h2>Medios de pago</h2></div>
              {summary && summary.porMedio.length ? (
                <table className="table">
                  <tbody>
                    {summary.porMedio.map((m) => (
                      <tr key={m.medio}>
                        <td>{m.medio.toLowerCase().replace('_', ' ')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{money.format(m.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">Sin ventas en el período.</p>
              )}
            </section>
          </div>

          <section className="panel">
            <div className="panel__head"><h2>Ventas por hora</h2></div>
            <div className="bars">
              {horasActivas.map((h) => (
                <div className="bar" key={h.hora} title={`${String(h.hora).padStart(2, '0')}:00 — ${money.format(h.total)} · ${h.ventas} venta(s)`}>
                  <div className="bar__fill" style={{ height: `${(h.total / maxHora) * 100}%` }} />
                  <span className="bar__label">{String(h.hora).padStart(2, '0')}</span>
                </div>
              ))}
            </div>
            <p className="hint">Hora de Uruguay. Sirve para detectar los picos del día y planificar personal.</p>
          </section>

          <div className="cols">
            <section className="panel">
              <div className="panel__head"><h2>Ventas por categoría</h2></div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Categoría</th><th style={{ textAlign: 'right' }}>Cantidad</th><th style={{ textAlign: 'right' }}>Monto</th><th style={{ textAlign: 'right' }}>%</th></tr></thead>
                  <tbody>
                    {categorias.map((c, i) => (
                      <tr key={c.categoriaId ?? `x${i}`}>
                        <td><strong>{c.nombre}</strong></td>
                        <td style={{ textAlign: 'right' }}>{Number(c.cantidad).toLocaleString('es-UY')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{money.format(c.monto)}</td>
                        <td style={{ textAlign: 'right' }} className="muted">{totalCategorias > 0 ? `${Math.round((c.monto / totalCategorias) * 100)}%` : '—'}</td>
                      </tr>
                    ))}
                    {categorias.length === 0 && <tr><td colSpan={4} className="muted">Sin ventas en el período.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel">
              <div className="panel__head"><h2>Productos más vendidos</h2></div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Producto</th><th style={{ textAlign: 'right' }}>Cantidad</th><th style={{ textAlign: 'right' }}>Monto</th></tr></thead>
                  <tbody>
                    {top.map((p, i) => (
                      <tr key={p.productId ?? `x${i}`}>
                        <td><strong>{p.nombre}</strong></td>
                        <td style={{ textAlign: 'right' }}>{Number(p.cantidad).toLocaleString('es-UY')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{money.format(p.monto)}</td>
                      </tr>
                    ))}
                    {top.length === 0 && <tr><td colSpan={3} className="muted">Sin ventas en el período.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
