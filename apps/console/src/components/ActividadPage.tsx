import { useEffect, useState } from 'react';
import { getActividad, getActividadTenant, type ActividadResumen, type ActividadDetalle } from '../lib/api';

const APP_LABEL: Record<string, string> = {
  admin: 'Panel', pos: 'Caja / POS', repartidor: 'Repartidor', comprador: 'Comprador', otros: 'Otros',
};
const DEV_LABEL: Record<string, string> = {
  ESCRITORIO: '🖥️ Escritorio', MOVIL: '📱 Móvil', TABLET: '📱 Tablet', OTRO: 'Otro',
};

function hace(iso: string | null): string {
  if (!iso) return 'nunca';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d === 1 ? '' : 's'}`;
}
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-UY');

export function ActividadPage() {
  const [rows, setRows] = useState<ActividadResumen[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<ActividadResumen | null>(null);

  async function load() {
    setError(null);
    try { setRows(await getActividad()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error'); setRows([]); }
  }
  useEffect(() => { void load(); }, []);

  return (
    <>
      <section className="panel">
        <div className="panel__head">
          <h2>Actividad de los clientes</h2>
          <button className="btn btn--ghost btn--sm" onClick={() => void load()}>↻ Actualizar</button>
        </div>
        <p className="muted">Última vez que cada cliente usó cada app, desde qué dispositivo e IP. Se actualiza mientras operan (no en tiempo real exacto).</p>
        {error && <p className="err">{error}</p>}

        {rows === null ? (
          <p className="muted">Cargando…</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Cliente</th><th>Última actividad</th><th>Apps en uso</th><th className="num">Usuarios</th><th className="num">Disp.</th><th>Última IP</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.tenantId} className={r.activo ? '' : 'row--off'}>
                    <td><strong>{r.nombre}</strong><span className="muted"> /{r.slug}</span></td>
                    <td title={r.lastSeenAt ?? ''}>{hace(r.lastSeenAt)}</td>
                    <td>{r.apps.length ? r.apps.map((a) => <span key={a} className="pill" style={{ marginRight: 4 }}>{APP_LABEL[a] ?? a}</span>) : <span className="muted">—</span>}</td>
                    <td className="num">{r.usuarios || '—'}</td>
                    <td className="num">{r.dispositivos || '—'}</td>
                    <td className="muted">{r.ultimaIp ?? '—'}</td>
                    <td className="num"><button className="btn btn--sm btn--ghost" onClick={() => setSel(r)} disabled={!r.dispositivos}>Ver</button></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} className="muted">Sin actividad registrada todavía.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {sel && <DetalleModal tenant={sel} onClose={() => setSel(null)} />}
    </>
  );
}

function DetalleModal({ tenant, onClose }: { tenant: ActividadResumen; onClose: () => void }) {
  const [rows, setRows] = useState<ActividadDetalle[] | null>(null);
  useEffect(() => { getActividadTenant(tenant.tenantId).then(setRows).catch(() => setRows([])); }, [tenant.tenantId]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <h3>Actividad · {tenant.nombre}</h3>
        {rows === null ? (
          <p className="muted">Cargando…</p>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr><th>Usuario</th><th>App</th><th>Dispositivo</th><th>IP</th><th className="num">Veces</th><th>Última vez</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td><strong>{r.usuario}</strong>{r.email && <span className="muted"> · {r.email}</span>}</td>
                    <td>{APP_LABEL[r.app] ?? r.app}</td>
                    <td>{DEV_LABEL[r.deviceType] ?? r.deviceType}</td>
                    <td className="muted">{r.ip ?? '—'}</td>
                    <td className="num">{r.visitas}</td>
                    <td title={`Primera vez: ${fechaHora(r.firstSeenAt)}`}>{fechaHora(r.lastSeenAt)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="muted">Sin actividad.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div className="modal__actions">
          <button className="btn btn--primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
