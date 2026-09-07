import { useEffect, useState } from 'react';
import { activarPagosTenant, crearEnlacePagos, desconectarPagosTenant, getTenantPagos } from '../lib/api';
import type { PagosConsole, TenantRow } from '../lib/api';

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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Cobros online · {tenant.nombre}</h2>

        {error && <p className="err">{error}</p>}
        {!cfg ? (
          <p className="muted">Cargando…</p>
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

            {cfg.conectado && (
              <button className="btn btn--sm btn--ghost" onClick={() => void desconectar()} disabled={busy}>Desconectar cuenta</button>
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
