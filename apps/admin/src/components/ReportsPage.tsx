import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDaily, getSummary, getTopProducts } from '../lib/api';
import type { DailyPoint, ReportSummary, TopProduct } from '../lib/api';

const money = new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 });

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
  const [preset, setPreset] = useState<Preset>('hoy');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: Preset) => {
    setLoading(true);
    setError(null);
    try {
      const r = rangeFor(p);
      const [s, t, d] = await Promise.all([
        getSummary(r),
        getTopProducts(r),
        getDaily(p === '30d' ? 30 : 7),
      ]);
      setSummary(s);
      setTop(t);
      setDaily(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando reportes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(preset);
  }, [preset, load]);

  const maxDaily = useMemo(() => Math.max(1, ...daily.map((d) => d.total)), [daily]);

  return (
    <>
      {error && <div className="banner banner--err">{error}</div>}

      <div className="segmented">
        {(['hoy', '7d', '30d'] as Preset[]).map((p) => (
          <button key={p} className={`seg ${preset === p ? 'seg--on' : ''}`} onClick={() => setPreset(p)}>
            {p === 'hoy' ? 'Hoy' : p === '7d' ? 'Últimos 7 días' : 'Últimos 30 días'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <>
          <section className="tiles">
            <div className="tile"><span className="tile__label">Vendido</span><span className="tile__value">{money.format(summary?.totalVendido ?? 0)}</span></div>
            <div className="tile"><span className="tile__label">Ventas</span><span className="tile__value">{summary?.ventas ?? 0}</span></div>
            <div className="tile"><span className="tile__label">Ticket prom.</span><span className="tile__value">{money.format(summary?.ticketPromedio ?? 0)}</span></div>
            <div className="tile"><span className="tile__label">IVA</span><span className="tile__value">{money.format(summary?.ivaTotal ?? 0)}</span></div>
          </section>

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
        </>
      )}
    </>
  );
}
