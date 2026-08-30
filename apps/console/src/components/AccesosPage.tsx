import { useCallback, useEffect, useState } from 'react';
import { getLockedUsers, unlockPlatformUser } from '../lib/api';
import type { LockedUser } from '../lib/api';

export function AccesosPage() {
  const [rows, setRows] = useState<LockedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await getLockedUsers());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setRows([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function desbloquear(u: LockedUser) {
    setBusy(u.id);
    try {
      await unlockPlatformUser(u.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo desbloquear');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel__head"><h2>Accesos bloqueados</h2></div>
      <p className="muted">Usuarios bloqueados por intentos fallidos. Al desbloquear, deberán cambiar su contraseña al entrar.</p>
      {error && <p className="err">{error}</p>}
      {rows === null ? (
        <p className="muted">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No hay usuarios bloqueados.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Nombre</th><th>Email</th><th>Verdulería</th><th>Rol</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.nombre}</strong></td>
                  <td>{u.email}</td>
                  <td>{u.tenants.join(', ') || '—'}</td>
                  <td>{u.roles.join(', ') || '—'}</td>
                  <td><button className="btn btn--primary btn--sm" disabled={busy === u.id} onClick={() => desbloquear(u)}>Desbloquear</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
