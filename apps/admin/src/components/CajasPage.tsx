import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createTerminal,
  deleteTerminal,
  getSucursales,
  getTerminals,
  getUsers,
  setTerminalOperadores,
  updateTerminal,
} from '../lib/api';
import type { Sucursal, TenantUser, Terminal } from '../lib/api';
import { SkeletonRows } from './Skeleton';
import { useToast } from '../lib/toast';

// Roles que operan el POS y por lo tanto pueden asignarse a una caja.
const ROLES_OPERADOR = new Set(['CAJERO', 'ENCARGADO', 'ADMIN']);

/** Gestión de cajas por sucursal + asignación de cajeros. Se muestra dentro del
 *  módulo "Caja" del panel (sub-pestaña "Cajas"). */
export function CajasManager() {
  const toast = useToast();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [sucs, setSucs] = useState<Sucursal[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [sucursalId, setSucursalId] = useState('');
  const [nombre, setNombre] = useState('');
  const [editando, setEditando] = useState<Terminal | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, s, u] = await Promise.all([getTerminals(), getSucursales(), getUsers()]);
      setTerminals(t);
      setSucs(s);
      setUsers(u);
      setSucursalId((prev) => prev || s.find((x) => x.activo)?.id || '');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error cargando las cajas');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  // Usuarios que pueden operar una caja (para asignar), por nombre.
  const operadores = useMemo(
    () => users.filter((u) => u.activo !== false && ROLES_OPERADOR.has(u.role)),
    [users],
  );
  const nombreDe = useCallback((userId: string) => operadores.find((u) => u.userId === userId)?.nombre ?? users.find((u) => u.userId === userId)?.nombre ?? '—', [operadores, users]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const n = nombre.trim();
    if (!sucursalId || !n) { toast.error('Elegí la sucursal y escribí el nombre de la caja.'); return; }
    try {
      await createTerminal({ sucursalId, nombre: n });
      setNombre('');
      toast.success(`Caja “${n}” creada`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear la caja');
    }
  }

  async function renombrar(t: Terminal) {
    const nuevo = window.prompt('Nuevo nombre de la caja', t.nombre);
    if (!nuevo || nuevo.trim() === t.nombre) return;
    try {
      await updateTerminal(t.id, { nombre: nuevo.trim() });
      toast.success('Caja renombrada');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo renombrar');
    }
  }

  async function toggle(t: Terminal) {
    try {
      await updateTerminal(t.id, { activo: !t.activo });
      toast.success(`${t.nombre} ${t.activo ? 'desactivada' : 'activada'}`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el estado');
    }
  }

  async function eliminar(t: Terminal) {
    if (!window.confirm(`¿Eliminar la caja “${t.nombre}”?`)) return;
    try {
      const r = await deleteTerminal(t.id);
      toast.success(r.deactivated ? 'La caja tenía turnos: se desactivó en vez de borrar.' : 'Caja eliminada');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  }

  return (
    <section className="panel">
      <div className="panel__head"><h2>Cajas</h2></div>
      <p className="muted">Cada caja pertenece a una sucursal. Asigná qué cajeros pueden operarla; si no asignás ninguno, la puede operar cualquiera.</p>

      <form className="cat-new" onSubmit={crear}>
        <select className="search" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
          <option value="">Sucursal…</option>
          {sucs.filter((s) => s.activo).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <input className="search" placeholder="Nombre de la caja (ej. Caja 1)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <button className="btn btn--primary" type="submit">Agregar</button>
      </form>

      {loading ? (
        <SkeletonRows rows={4} cols={5} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Sucursal</th><th>Caja</th><th>Cajeros habilitados</th><th>Activa</th><th></th></tr></thead>
            <tbody>
              {terminals.map((t) => (
                <tr key={t.id} className={t.activo ? '' : 'row--off'}>
                  <td>{t.sucursalNombre}</td>
                  <td><strong>{t.nombre}</strong></td>
                  <td>
                    {t.operadorIds.length === 0
                      ? <span className="muted">Todos</span>
                      : t.operadorIds.map(nombreDe).join(', ')}
                  </td>
                  <td><input type="checkbox" checked={t.activo} onChange={() => toggle(t)} /></td>
                  <td className="row-actions">
                    <button className="btn btn--sm btn--ghost" onClick={() => setEditando(t)}>Cajeros</button>
                    <button className="btn btn--sm btn--ghost" onClick={() => renombrar(t)}>Renombrar</button>
                    <button className="btn btn--sm btn--ghost" onClick={() => eliminar(t)}>Eliminar</button>
                  </td>
                </tr>
              ))}
              {terminals.length === 0 && <tr><td colSpan={5} className="muted">Todavía no hay cajas. Creá la primera arriba.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <OperadoresModal
          terminal={editando}
          operadores={operadores}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); void load(); }}
        />
      )}
    </section>
  );
}

function OperadoresModal({
  terminal,
  operadores,
  onClose,
  onSaved,
}: {
  terminal: Terminal;
  operadores: TenantUser[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [sel, setSel] = useState<Set<string>>(() => new Set(terminal.operadorIds));
  const [guardando, setGuardando] = useState(false);

  function toggle(userId: string) {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  async function guardar() {
    setGuardando(true);
    try {
      await setTerminalOperadores(terminal.id, [...sel]);
      toast.success(`Cajeros de “${terminal.nombre}” actualizados`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      setGuardando(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Cajeros · {terminal.nombre}</h3>
        <p className="modal__sub">{terminal.sucursalNombre}. Marcá quién puede abrir turno en esta caja. Sin marcar a nadie, la puede operar cualquiera.</p>

        <div className="oper-list">
          {operadores.length === 0 && <p className="muted">No hay cajeros para asignar.</p>}
          {operadores.map((u) => (
            <label key={u.userId} className="chk-row">
              <input type="checkbox" checked={sel.has(u.userId)} onChange={() => toggle(u.userId)} />
              {u.nombre} <span className="muted">· {u.role.toLowerCase()}</span>
            </label>
          ))}
        </div>

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button className="btn btn--primary" onClick={() => void guardar()} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
