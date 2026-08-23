import { useCallback, useEffect, useState } from 'react';
import { createCategoria, getCategorias, updateCategoria } from '../lib/api';
import type { Categoria, IvaIndicador } from '../lib/api';

const IVAS: IvaIndicador[] = ['MINIMA', 'BASICA', 'EXENTO', 'SUSPENSO'];

export function CategoriasPage() {
  const [cats, setCats] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState('');
  const [iva, setIva] = useState<IvaIndicador>('MINIMA');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCats(await getCategorias());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    try {
      await createCategoria({ nombre: nombre.trim(), ivaIndicadorDefault: iva });
      setNombre('');
      void load();
    } catch (err) {
      setError(String(err));
    }
  }

  async function renombrar(c: Categoria) {
    const nuevo = window.prompt('Nuevo nombre', c.nombre);
    if (!nuevo || nuevo === c.nombre) return;
    await updateCategoria(c.id, { nombre: nuevo.trim() }).catch((e) => setError(String(e)));
    void load();
  }

  async function cambiarIva(c: Categoria, v: IvaIndicador) {
    await updateCategoria(c.id, { ivaIndicadorDefault: v }).catch((e) => setError(String(e)));
    void load();
  }

  return (
    <>
      {error && <div className="banner banner--err">{error}</div>}
      <section className="panel">
        <div className="panel__head"><h2>Categorías</h2></div>

        <form className="cat-new" onSubmit={crear}>
          <input className="search" placeholder="Nueva categoría…" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <select value={iva} onChange={(e) => setIva(e.target.value as IvaIndicador)}>
            {IVAS.map((i) => <option key={i} value={i}>IVA {i}</option>)}
          </select>
          <button className="btn btn--primary" type="submit">Agregar</button>
        </form>

        {loading ? (
          <p className="muted">Cargando…</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Categoría</th><th>IVA por defecto</th><th></th></tr></thead>
              <tbody>
                {cats.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.nombre}</strong></td>
                    <td>
                      <select value={c.ivaIndicadorDefault} onChange={(e) => cambiarIva(c, e.target.value as IvaIndicador)}>
                        {IVAS.map((i) => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </td>
                    <td><button className="btn btn--sm btn--ghost" onClick={() => renombrar(c)}>Renombrar</button></td>
                  </tr>
                ))}
                {cats.length === 0 && <tr><td colSpan={3} className="muted">Sin categorías. Creá la primera.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">La categoría define el IVA por defecto que heredan sus productos nuevos.</p>
      </section>
    </>
  );
}
