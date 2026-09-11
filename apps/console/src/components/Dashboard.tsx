import { useCallback, useEffect, useState } from 'react';
import { getOverview, getPlans, getTenants, updateTenant } from '../lib/api';
import type { Overview, Plan, TenantRow } from '../lib/api';
import { NewClientModal } from './NewClientModal';
import { CfeConfigModal } from './CfeConfigModal';
import { DescuentoModal } from './DescuentoModal';
import { MercadoPagoModal } from './MercadoPagoModal';
import { DemoModal } from './DemoModal';

export function Dashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [cfeTenant, setCfeTenant] = useState<TenantRow | null>(null);
  const [descTenant, setDescTenant] = useState<TenantRow | null>(null);
  const [pagosTenant, setPagosTenant] = useState<TenantRow | null>(null);
  const [demoTenant, setDemoTenant] = useState<TenantRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [o, t, p] = await Promise.all([getOverview(), getTenants(), getPlans()]);
      setOverview(o);
      setTenants(t);
      setPlans(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleActivo(t: TenantRow) {
    await updateTenant(t.id, { activo: !t.activo }).catch((e) => setError(String(e)));
    void load();
  }
  async function cambiarPlan(t: TenantRow, planCode: string) {
    await updateTenant(t.id, { planCode }).catch((e) => setError(String(e)));
    void load();
  }

  return (
    <>
      {error && <div className="banner banner--err">{error}</div>}

        <section className="tiles">
          <div className="tile">
            <span className="tile__label">Clientes</span>
            <span className="tile__value">{overview?.tenants ?? '—'}</span>
          </div>
          <div className="tile">
            <span className="tile__label">Activos</span>
            <span className="tile__value">{overview?.activos ?? '—'}</span>
          </div>
          {overview?.suscripcionesPorEstado.map((s) => (
            <div className="tile" key={s.estado}>
              <span className="tile__label">{s.estado}</span>
              <span className="tile__value">{s._count}</span>
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>Clientes</h2>
            <button className="btn btn--primary" onClick={() => setCreating(true)}>+ Nuevo cliente</button>
          </div>

          {loading ? (
            <p className="muted">Cargando…</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Verdulería</th>
                    <th>Plan</th>
                    <th>Estado</th>
                    <th>Usuarios</th>
                    <th>Productos</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id} className={t.activo ? '' : 'row--off'}>
                      <td>
                        <strong>{t.nombre}</strong>
                        <span className="muted"> /{t.slug}</span>
                      </td>
                      <td>
                        <select value={t.plan ?? ''} onChange={(e) => cambiarPlan(t, e.target.value)}>
                          {!t.plan && <option value="">—</option>}
                          {plans.map((p) => (
                            <option key={p.code} value={p.code}>{p.nombre}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`badge badge--${t.estado.toLowerCase()}`}>{t.estado}</span>
                        {t.descuento && <span className="badge badge--desc" title={t.descuento.motivo ?? ''}>−{t.descuento.pct}%</span>}
                      </td>
                      <td>{t.usuarios}</td>
                      <td>{t.productos}</td>
                      <td>
                        <button className="btn btn--sm btn--ghost" onClick={() => setCfeTenant(t)}>Fiscal</button>{' '}
                        <button className="btn btn--sm btn--ghost" onClick={() => setPagosTenant(t)}>Pagos</button>{' '}
                        <button className="btn btn--sm btn--ghost" onClick={() => setDescTenant(t)}>Descuento</button>{' '}
                        <button className="btn btn--sm btn--ghost" onClick={() => setDemoTenant(t)}>Demo</button>{' '}
                        <button className="btn btn--sm btn--ghost" onClick={() => toggleActivo(t)}>
                          {t.activo ? 'Suspender' : 'Reactivar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tenants.length === 0 && (
                    <tr><td colSpan={6} className="muted">Todavía no hay clientes. Creá el primero.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

      {creating && (
        <NewClientModal
          plans={plans}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
        />
      )}

      {cfeTenant && (
        <CfeConfigModal
          tenant={cfeTenant}
          onClose={() => setCfeTenant(null)}
          onSaved={() => void load()}
        />
      )}

      {descTenant && (
        <DescuentoModal
          tenant={descTenant}
          onClose={() => setDescTenant(null)}
          onSaved={() => void load()}
        />
      )}

      {pagosTenant && (
        <MercadoPagoModal tenant={pagosTenant} onClose={() => setPagosTenant(null)} />
      )}

      {demoTenant && (
        <DemoModal tenant={demoTenant} onClose={() => setDemoTenant(null)} onSaved={() => void load()} />
      )}
    </>
  );
}
