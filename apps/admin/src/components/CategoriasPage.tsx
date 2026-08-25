import { useCallback, useEffect, useState } from 'react';
import { createCategoria, getCategorias, updateCategoria } from '../lib/api';
import type { Categoria, IvaIndicador } from '../lib/api';
import { SkeletonRows } from './Skeleton';
import { useToast } from '../lib/toast';

const IVAS: IvaIndicador[] = ['MINIMA', 'BASICA', 'EXENTO', 'SUSPENSO'];

export function CategoriasPage() {
  const toast = useToast();
  const [cats, setCats] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState('');
  const [iva, setIva] = useState<IvaIndicador>('MINIMA');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setCats(await getCategorias());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error cargando categorías');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    const n = nombre.trim();
    try {
      await createCategoria({ nombre: n, ivaIndicadorDefault: iva });
      setNombre('');
      toast.success(`Categoría “${n}” agregada correctamente`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear la categoría');
    }
  }

  async function renombrar(c: Categoria) {
    const nuevo = window.prompt('Nuevo nombre', c.nombre);
    if (!nuevo || nuevo === c.nombre) return;
    try {
      await updateCategoria(c.id, { nombre: nuevo.trim() });
      toast.success('Categoría renombrada correctamente');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo renombrar');
    }
    void load();
  }

  async function cambiarIva(c: Categoria, v: IvaIndicador) {
    try {
      await updateCategoria(c.id, { ivaIndicadorDefault: v });
      toast.success(`IVA de “${c.nombre}” actualizado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el IVA');
    }
    void load();
  }

  return (
    <>
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
          <SkeletonRows rows={4} cols={3} />
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
