import { useEffect, useMemo, useState } from 'react';
import { getMe } from '../lib/api';
import { MANUAL, ROLES, rolMeta, type Articulo, type RoleId } from '../lib/manual';

/** Un artículo es visible para un rol si aplica a "todos" o incluye ese rol. */
function visiblePara(a: Articulo, rol: RoleId): boolean {
  return a.roles === 'todos' || a.roles.includes(rol);
}

export function AyudaPage() {
  const [rol, setRol] = useState<RoleId | null>(null);
  const [cargando, setCargando] = useState(true);
  // Para el admin: ver el manual como un rol puntual (o "todos").
  const [verComo, setVerComo] = useState<RoleId | 'TODOS'>('TODOS');
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    getMe()
      .then((m) => {
        if (!vivo) return;
        setRol((m.role as RoleId) ?? 'CAJERO');
      })
      .catch(() => setRol('CAJERO'))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, []);

  const esAdmin = rol === 'ADMIN';
  // Rol efectivo para filtrar: el admin puede simular otros; el resto ve el suyo.
  const rolEfectivo: RoleId | 'TODOS' = esAdmin ? verComo : (rol ?? 'CAJERO');

  const secciones = useMemo(() => {
    const texto = q.trim().toLowerCase();
    const coincide = (a: Articulo) => {
      if (!texto) return true;
      const hay = [a.titulo, a.resumen, ...(a.pasos ?? []), ...(a.tips ?? []), a.app ?? '']
        .join(' ')
        .toLowerCase();
      return hay.includes(texto);
    };
    return MANUAL.map((s) => ({
      ...s,
      articulos: s.articulos.filter((a) => (rolEfectivo === 'TODOS' || visiblePara(a, rolEfectivo)) && coincide(a)),
    })).filter((s) => s.articulos.length > 0);
  }, [q, rolEfectivo]);

  const totalArticulos = useMemo(() => secciones.reduce((n, s) => n + s.articulos.length, 0), [secciones]);
  const miRol = rolMeta(rol ?? undefined);

  if (cargando) {
    return (
      <div className="manual">
        <div className="loading-row">Cargando manual…</div>
      </div>
    );
  }

  return (
    <div className="manual">
      <div className="manual__intro">
        <h2 className="manual__title">📖 Manual de uso</h2>
        {miRol && (
          <p className="muted manual__rolinfo">
            Ingresaste como <span className="pill">{miRol.icono} {miRol.nombre}</span>. {miRol.resumen}
          </p>
        )}
        {esAdmin && (
          <p className="muted manual__rolinfo">
            Como administrador ves todo el manual. Podés ver qué le aparece a cada rol con el selector de abajo.
          </p>
        )}
      </div>

      <div className="manual__controls">
        <input
          className="manual__search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en el manual…"
        />
        {esAdmin && (
          <label className="manual__vercomo">
            Ver como
            <select value={verComo} onChange={(e) => setVerComo(e.target.value as RoleId | 'TODOS')}>
              <option value="TODOS">Todos los roles</option>
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.icono} {r.nombre}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {totalArticulos === 0 ? (
        <div className="manual__empty">
          <p>No hay temas para tu búsqueda.</p>
        </div>
      ) : (
        secciones.map((s) => (
          <section className="manual__sec" key={s.id}>
            <h3 className="manual__sectitle">{s.icono} {s.titulo}</h3>
            <div className="manual__arts">
              {s.articulos.map((a) => {
                const open = abierto === a.id;
                return (
                  <article className={`manual-art ${open ? 'is-open' : ''}`} key={a.id}>
                    <button className="manual-art__head" onClick={() => setAbierto(open ? null : a.id)}>
                      <span className="manual-art__t">
                        <strong>{a.titulo}</strong>
                        <span className="muted manual-art__resumen">{a.resumen}</span>
                      </span>
                      <span className="manual-art__chevron">{open ? '▲' : '▼'}</span>
                    </button>
                    {open && (
                      <div className="manual-art__body">
                        {a.app && <div className="manual-art__app">📍 {a.app}</div>}
                        {a.pasos && a.pasos.length > 0 && (
                          <ol className="manual-art__pasos">
                            {a.pasos.map((p, i) => <li key={i}>{p}</li>)}
                          </ol>
                        )}
                        {a.tips && a.tips.length > 0 && (
                          <ul className="manual-art__tips">
                            {a.tips.map((t, i) => <li key={i}>💡 {t}</li>)}
                          </ul>
                        )}
                        {esAdmin && a.roles !== 'todos' && (
                          <div className="manual-art__roles">
                            Visible para: {a.roles.map((r) => rolMeta(r)?.nombre ?? r).join(', ')}
                          </div>
                        )}
                        {esAdmin && a.roles === 'todos' && (
                          <div className="manual-art__roles">Visible para: todos los roles</div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
