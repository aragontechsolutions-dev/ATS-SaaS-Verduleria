import { useEffect, useState } from 'react';
import { getDemoEstado, guardarBaseDemo, quitarDemo, resetDemo, type DemoEstado, type TenantRow } from '../lib/api';

interface Props {
  tenant: TenantRow;
  onClose: () => void;
  onSaved: () => void;
}

/** Gestión de la cuenta demo: guardar la base, resetear ahora, dejar de ser demo. */
export function DemoModal({ tenant, onClose, onSaved }: Props) {
  const [estado, setEstado] = useState<DemoEstado | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDemoEstado(tenant.id).then(setEstado).catch((e) => setError(e instanceof Error ? e.message : 'Error'));
  }, [tenant.id]);

  async function accion(fn: () => Promise<unknown>, exito: string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await fn();
      setMsg(exito);
      const e = await getDemoEstado(tenant.id).catch(() => null);
      if (e) setEstado(e);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar');
    } finally {
      setBusy(false);
    }
  }

  const actividad = estado?.demoActividadAt ? new Date(estado.demoActividadAt).toLocaleString('es-UY') : '—';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Demo · {tenant.nombre}</h3>
        <p className="muted">
          Dejá esta verdulería con los datos que querés mostrar (categorías, productos, usuarios) y
          tocá <b>Guardar como base</b>. Cuando entre un visitante nuevo tras 30 minutos de inactividad,
          el sistema limpia lo que dejó otro y restaura esta base. Los usuarios de la demo no se pueden
          eliminar ni deshabilitar.
        </p>

        <div className="creds" style={{ marginTop: 4 }}>
          <div><span className="muted">Estado:</span> {estado ? (estado.esDemo ? '🧪 Es demo' : 'No es demo') : 'Cargando…'}</div>
          <div><span className="muted">Base guardada:</span> {estado ? (estado.tieneBase ? 'Sí ✓' : 'No — guardala') : '…'}</div>
          <div><span className="muted">Última actividad:</span> {actividad}</div>
        </div>

        {msg && <p className="ok-msg" style={{ color: 'var(--primary-dark, #0A5A52)' }}>{msg}</p>}
        {error && <p className="err">{error}</p>}

        <div className="modal__actions" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>Cerrar</button>
          {estado?.esDemo && (
            <button type="button" className="btn btn--ghost" onClick={() => void accion(() => quitarDemo(tenant.id), 'Ya no es demo.')} disabled={busy}>
              Quitar demo
            </button>
          )}
          {estado?.tieneBase && (
            <button type="button" className="btn btn--ghost" onClick={() => void accion(() => resetDemo(tenant.id), 'Demo restaurada a la base.')} disabled={busy}>
              Resetear ahora
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={() => void accion(() => guardarBaseDemo(tenant.id), 'Base guardada. El reset restaurará esta foto.')} disabled={busy}>
            {busy ? 'Procesando…' : estado?.tieneBase ? 'Actualizar base' : 'Guardar como base'}
          </button>
        </div>
      </div>
    </div>
  );
}
