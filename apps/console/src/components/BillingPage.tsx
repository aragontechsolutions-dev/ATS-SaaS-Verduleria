import { useCallback, useEffect, useState } from 'react';
import { generateInvoices, getBillingSummary, getInvoices, payInvoice, processOverdue } from '../lib/api';
import type { BillingSummary, Invoice } from '../lib/api';

const money = new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 });
const periodoActual = () => new Date().toISOString().slice(0, 7); // YYYY-MM

export function BillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, i] = await Promise.all([getBillingSummary(), getInvoices()]);
      setSummary(s);
      setInvoices(i);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      setMsg(await fn());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  const badge = (estado: string) => `badge badge--${estado.toLowerCase()}`;

  return (
    <>
      {error && <div className="banner banner--err">{error}</div>}
      {msg && <div className="banner banner--ok">{msg}</div>}

      <section className="tiles">
        <div className="tile"><span className="tile__label">MRR (mensual)</span><span className="tile__value">{money.format(summary?.mrr ?? 0)}</span></div>
        <div className="tile"><span className="tile__label">Pendiente</span><span className="tile__value">{money.format(summary?.pendiente.monto ?? 0)}</span></div>
        <div className="tile"><span className="tile__label">Vencido</span><span className="tile__value" style={{ color: (summary?.vencido.cantidad ?? 0) > 0 ? 'var(--warn)' : undefined }}>{money.format(summary?.vencido.monto ?? 0)}</span></div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>Facturas</h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn--ghost" disabled={busy} onClick={() => run(async () => {
              const r = await generateInvoices(periodoActual());
              return `Período ${r.periodo}: ${r.creadas} facturas nuevas (de ${r.suscripciones} suscripciones).`;
            })}>Generar período actual</button>
            <button className="btn btn--primary" disabled={busy} onClick={() => run(async () => {
              const r = await processOverdue();
              return `Procesados: ${r.vencidas} vencidas, ${r.suspendidos} suspendidos por impago.`;
            })}>Procesar vencidos</button>
          </div>
        </div>

        {loading ? (
          <p className="muted">Cargando…</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th><th>Plan</th><th>Período</th><th>Vence</th>
                  <th style={{ textAlign: 'right' }}>Monto</th><th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td><strong>{i.tenant}</strong></td>
                    <td>{i.plan}</td>
                    <td>{i.periodo}</td>
                    <td>{i.vencimiento.slice(0, 10)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{money.format(i.monto)}</td>
                    <td><span className={badge(i.estado)}>{i.estado}</span></td>
                    <td>
                      {i.estado !== 'PAGADA' && i.estado !== 'ANULADA' && (
                        <button className="btn btn--sm btn--ghost" disabled={busy}
                          onClick={() => run(async () => { await payInvoice(i.id); return 'Pago registrado.'; })}>
                          Marcar pagada
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr><td colSpan={7} className="muted">No hay facturas. Generá el período actual.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
