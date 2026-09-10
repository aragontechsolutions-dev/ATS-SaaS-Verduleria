import { useEffect, useState } from 'react';
import { activarPagosTenant, crearEnlacePagos, desconectarPagosTenant, getTenantPagos, getTenantPoint, quitarPoint, seleccionarPoint, seleccionarProveedorPago } from '../lib/api';
import type { PagosConsole, PointConsole, TenantRow } from '../lib/api';

interface Props {
  tenant: TenantRow;
  onClose: () => void;
}

/**
 * Gestión del cobro online (Mercado Pago) de un tenant desde la Consola.
 * El comercio nunca toca esto: acá generás el enlace de "Conectar con MP" y se
 * lo pasás; una vez vinculado, activás el cobro. Así un curioso no lo desconfigura.
 */
export function MercadoPagoModal({ tenant, onClose }: Props) {
  const [cfg, setCfg] = useState<PagosConsole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [enlace, setEnlace] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    getTenantPagos(tenant.id)
      .then(setCfg)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [tenant.id]);

  async function generar() {
    setBusy(true); setError(null);
    try {
      const { url } = await crearEnlacePagos(tenant.id);
      setEnlace(url);
      setCfg(await getTenantPagos(tenant.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el enlace');
    } finally { setBusy(false); }
  }

  async function copiar() {
    if (!enlace) return;
    try { await navigator.clipboard.writeText(enlace); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* noop */ }
  }

  async function toggle(activo: boolean) {
    setBusy(true); setError(null);
    try { setCfg(await activarPagosTenant(tenant.id, activo)); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar'); }
    finally { setBusy(false); }
  }

  async function desconectar() {
    if (!confirm('¿Desconectar la cuenta de Mercado Pago de este comercio?')) return;
    setBusy(true); setError(null);
    try { setCfg(await desconectarPagosTenant(tenant.id)); setEnlace(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo desconectar'); }
    finally { setBusy(false); }
  }

  async function elegirProveedor(key: string) {
    setBusy(true); setError(null);
    try { setCfg(await seleccionarProveedorPago(tenant.id, key)); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar el proveedor'); }
    finally { setBusy(false); }
  }

  const esMP = cfg?.proveedor === 'MERCADO_PAGO';
  const integrados = cfg?.catalogo.filter((p) => p.integrado).length ?? 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Cobros · {tenant.nombre}</h2>

        {error && <p className="err">{error}</p>}
        {!cfg ? (
          <p className="muted">Cargando…</p>
        ) : (
          <>
            {/* Selector de proveedor (la gama) */}
            <div className="mp-gama">
              <h3>Proveedor de pago <span className="muted">· {integrados} integrado{integrados === 1 ? '' : 's'}</span></h3>
              <ul className="mp-gama__list">
                {cfg.catalogo.map((p) => {
                  const elegido = cfg.proveedor === p.key;
                  return (
                    <li key={p.key} className={`mp-gama__item ${elegido ? 'is-on' : ''}`} style={elegido ? { borderColor: p.color } : undefined}>
                      <span className="mp-gama__ico" style={{ background: p.color }} aria-hidden>{p.nombre.charAt(0)}</span>
                      <div className="mp-gama__body">
                        <strong>{p.nombre}</strong>{' '}
                        <span className={`mp-tag ${p.integrado ? 'mp-tag--ok' : 'mp-tag--soon'}`}>{p.integrado ? 'Integrado' : 'Próximamente'}</span>
                        <div className="muted mp-gama__desc">{p.descripcion}</div>
                      </div>
                      {elegido
                        ? <span className="muted">✓ elegido</span>
                        : <button className="btn btn--sm btn--ghost" disabled={busy} onClick={() => void elegirProveedor(p.key)}>Usar este</button>}
                    </li>
                  );
                })}
              </ul>
            </div>

            {!esMP ? (
              <p className="mp-soon">
                Proveedor seleccionado: <strong>{cfg.catalogo.find((p) => p.key === cfg.proveedor)?.nombre ?? cfg.proveedor}</strong>.
                {cfg.catalogo.find((p) => p.key === cfg.proveedor)?.integrado
                  ? ' Configuralo abajo.'
                  : ' Todavía no está integrado: queda marcado como el proveedor del comercio, pero no cobra online hasta que sumemos su integración (esperando documentación/credenciales).'}
              </p>
            ) : !cfg.encKeyDisponible ? (
              <p className="err">Falta configurar <code>PAYMENTS_ENC_KEY</code> en el servidor.</p>
            ) : !cfg.oauthDisponible ? (
              <p className="err">Falta configurar la app de Mercado Pago en el servidor (<code>MP_OAUTH_CLIENT_ID</code> / <code>MP_OAUTH_CLIENT_SECRET</code> / <code>MP_OAUTH_REDIRECT_URI</code>).</p>
            ) : (
              <>
            <div className="mp-status">
              {cfg.conectado ? (
                <p>
                  Estado: <strong style={{ color: '#128C7E' }}>Conectado</strong>
                  {cfg.cuenta ? <> · cuenta <strong>{cfg.cuenta}</strong></> : null}
                  {' '}· Ambiente <strong>{cfg.ambiente === 'produccion' ? 'Producción' : 'Prueba'}</strong>
                  {cfg.conexion === 'OAUTH' ? ' · vía "Conectar con MP"' : ' · token manual'}
                </p>
              ) : (
                <p>Estado: <strong>Sin conectar</strong></p>
              )}
            </div>

            <ol className="mp-steps">
              <li>
                <strong>1. Generá el enlace</strong> y pasáselo al comercio (WhatsApp/mail). Al abrirlo, autoriza con SU cuenta de Mercado Pago.
                <div className="mp-linkrow">
                  <button className="btn btn--sm btn--primary" onClick={() => void generar()} disabled={busy}>
                    {cfg.conectado ? 'Generar enlace para reconectar' : 'Generar enlace de conexión'}
                  </button>
                  {enlace && (
                    <button className="btn btn--sm btn--ghost" onClick={() => void copiar()}>{copiado ? '✓ Copiado' : '📋 Copiar enlace'}</button>
                  )}
                </div>
                {enlace && <textarea className="mp-linkbox" readOnly value={enlace} onFocus={(e) => e.currentTarget.select()} rows={2} />}
              </li>
              <li>
                <strong>2. Activá el cobro</strong> (una vez que el comercio quedó conectado).
                <label className="mp-check">
                  <input
                    type="checkbox"
                    checked={cfg.cobroOnlineActivo}
                    disabled={busy || !cfg.conectado}
                    onChange={(e) => void toggle(e.target.checked)}
                  />
                  Ofrecer pago online en la tienda
                </label>
              </li>
            </ol>

            {cfg.conectado && <PointSection tenant={tenant} />}

            {cfg.conectado && (
              <button className="btn btn--sm btn--ghost" onClick={() => void desconectar()} disabled={busy}>Desconectar cuenta</button>
            )}
              </>
            )}
          </>
        )}

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/** Configuración del lector Mercado Pago Point (cobro presencial en el mostrador). */
function PointSection({ tenant }: { tenant: TenantRow }) {
  const [p, setP] = useState<PointConsole | null>(null);
  const [busy, setBusy] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buscar() {
    setBusy(true); setError(null);
    try { setP(await getTenantPoint(tenant.id)); setBuscado(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo listar'); }
    finally { setBusy(false); }
  }

  async function elegir(deviceId: string) {
    setBusy(true); setError(null);
    try {
      await seleccionarPoint(tenant.id, deviceId);
      await buscar();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo configurar'); setBusy(false); }
  }

  async function quitar() {
    setBusy(true); setError(null);
    try { await quitarPoint(tenant.id); await buscar(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo quitar'); setBusy(false); }
  }

  return (
    <div className="mp-point">
      <h3>Lector Point (cobro en el mostrador)</h3>
      {p?.deviceId
        ? <p className="muted">Lector configurado: <strong>{p.deviceId}</strong> (modo integrado).</p>
        : <p className="muted">Sin lector configurado. Buscá los lectores de la cuenta y elegí uno.</p>}

      {error && <p className="err">{error}</p>}

      <div className="mp-linkrow">
        <button className="btn btn--sm btn--ghost" onClick={() => void buscar()} disabled={busy}>{busy ? '…' : 'Buscar lectores'}</button>
        {p?.deviceId && <button className="btn btn--sm btn--ghost" onClick={() => void quitar()} disabled={busy}>Quitar lector</button>}
      </div>

      {buscado && p && (
        p.dispositivos.length === 0
          ? <p className="muted">No se encontraron lectores en la cuenta. Encendé el Point, vinculalo a la cuenta MP y volvé a buscar.</p>
          : <ul className="mp-devs">
              {p.dispositivos.map((d) => (
                <li key={d.id}>
                  <span><strong>{d.id}</strong> {d.modo ? <span className="muted">· {d.modo}</span> : null}</span>
                  {p.deviceId === d.id
                    ? <span className="muted">✓ elegido</span>
                    : <button className="btn btn--sm btn--primary" onClick={() => void elegir(d.id)} disabled={busy}>Usar este</button>}
                </li>
              ))}
            </ul>
      )}
    </div>
  );
}
