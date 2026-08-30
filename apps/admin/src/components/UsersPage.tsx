import { useCallback, useEffect, useState } from 'react';
import { getUsers, resetUserPassword, unlockUser, updateUser } from '../lib/api';
import type { Role, TenantUser } from '../lib/api';
import { UserModal } from './UserModal';
import { SkeletonRows } from './Skeleton';
import { useToast } from '../lib/toast';

const ROLES: Role[] = ['ADMIN', 'ENCARGADO', 'CAJERO', 'DEPOSITO', 'REPARTIDOR', 'COMPRADOR', 'CONTADOR', 'MAYORISTA'];

export function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setUsers(await getUsers());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error cargando usuarios');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeRole(u: TenantUser, role: Role) {
    try {
      await updateUser(u.membershipId, { role });
      toast.success(`Rol de ${u.nombre} cambiado a ${role}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el rol');
    }
    void load();
  }
  async function toggleActivo(u: TenantUser) {
    try {
      await updateUser(u.membershipId, { activo: !u.activo });
      toast.success(`${u.nombre} ${u.activo ? 'desactivado' : 'activado'}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el estado');
    }
    void load();
  }
  async function resetear(u: TenantUser) {
    if (!window.confirm(`¿Resetear la contraseña de ${u.nombre}? Se generará una temporal y deberá cambiarla al entrar.`)) return;
    try {
      const { password } = await resetUserPassword(u.membershipId);
      window.alert(`Contraseña temporal de ${u.email}:\n\n${password}\n\nCompartila con el usuario. Deberá cambiarla al iniciar sesión.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo resetear');
    }
    void load();
  }
  async function desbloquear(u: TenantUser) {
    try {
      await unlockUser(u.membershipId);
      toast.success(`${u.nombre} desbloqueado. Deberá cambiar su contraseña al entrar.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo desbloquear');
    }
    void load();
  }

  return (
    <>
      <section className="panel">
        <div className="panel__head">
          <h2>Usuarios</h2>
          <button className="btn btn--primary" onClick={() => setCreating(true)}>+ Nuevo usuario</button>
        </div>

        {loading ? (
          <SkeletonRows rows={5} cols={4} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Activo</th>
                  <th>Acciones</th>
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
                    <td>
                      {u.bloqueado
                        ? <span className="badge badge--suspendida">🔒 Bloqueado</span>
                        : u.mustChangePassword
                          ? <span className="badge badge--trial">Cambio pendiente</span>
                          : <span className="badge badge--activa">OK</span>}
                    </td>
                    <td><input type="checkbox" checked={u.activo} onChange={() => toggleActivo(u)} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {u.bloqueado && <button className="btn btn--ghost btn--sm" onClick={() => desbloquear(u)}>Desbloquear</button>}
                        <button className="btn btn--ghost btn--sm" onClick={() => resetear(u)}>Resetear clave</button>
                      </div>
                    </td>
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
