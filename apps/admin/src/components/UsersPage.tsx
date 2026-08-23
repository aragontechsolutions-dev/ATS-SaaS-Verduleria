import { useCallback, useEffect, useState } from 'react';
import { getUsers, updateUser } from '../lib/api';
import type { Role, TenantUser } from '../lib/api';
import { UserModal } from './UserModal';

const ROLES: Role[] = ['ADMIN', 'ENCARGADO', 'CAJERO', 'DEPOSITO', 'REPARTIDOR', 'COMPRADOR', 'CONTADOR', 'MAYORISTA'];

export function UsersPage() {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setUsers(await getUsers());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeRole(u: TenantUser, role: Role) {
    await updateUser(u.membershipId, { role }).catch((e) => setError(String(e)));
    void load();
  }
  async function toggleActivo(u: TenantUser) {
    await updateUser(u.membershipId, { activo: !u.activo }).catch((e) => setError(String(e)));
    void load();
  }

  return (
    <>
      {error && <div className="banner banner--err">{error}</div>}
      <section className="panel">
        <div className="panel__head">
          <h2>Usuarios</h2>
          <button className="btn btn--primary" onClick={() => setCreating(true)}>+ Nuevo usuario</button>
        </div>

        {loading ? (
          <p className="muted">Cargando…</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Activo</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.membershipId} className={u.activo ? '' : 'row--off'}>
                    <td><strong>{u.nombre}</strong></td>
                    <td>{u.email}</td>
                    <td>
                      <select value={u.role} onChange={(e) => changeRole(u, e.target.value as Role)}>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td><input type="checkbox" checked={u.activo} onChange={() => toggleActivo(u)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">Los cajeros que crees acá entran al POS con su email y contraseña.</p>
      </section>

      {creating && <UserModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load(); }} />}
    </>
  );
}
