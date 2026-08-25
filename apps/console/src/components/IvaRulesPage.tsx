import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  classifyIva,
  createIvaRule,
  deleteIvaRule,
  getIvaRules,
  reclassifyIva,
  updateIvaRule,
} from '../lib/api';
import type { Clasificacion, IvaIndicador, IvaRule, IvaRuleInput } from '../lib/api';

const INDICADORES: Array<{ v: IvaIndicador; label: string }> = [
  { v: 'MINIMA', label: 'Mínima 10%' },
  { v: 'BASICA', label: 'Básica 22%' },
  { v: 'EXENTO', label: 'Exento' },
  { v: 'SUSPENSO', label: 'En suspenso' },
];
const tasaLabel = (v: IvaIndicador) => INDICADORES.find((i) => i.v === v)?.label ?? v;

export function IvaRulesPage() {
  const [rules, setRules] = useState<IvaRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [q, setQ] = useState('');

  // Alta de regla
  const [nuevo, setNuevo] = useState({ termino: '', ivaIndicador: 'MINIMA' as IvaIndicador, esEstadoNatural: true, esImportado: false, prioridad: 0 });

  // Probador
  const [prueba, setPrueba] = useState('');
  const [resultado, setResultado] = useState<Clasificacion | null>(null);

  const load = useCallback(async () => {
    try {
      setRules(await getIvaRules());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando reglas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function flash(m: string) {
    setOkMsg(m);
    window.setTimeout(() => setOkMsg(null), 3000);
  }

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rules.filter((r) => r.termino.includes(t) || (r.nota ?? '').toLowerCase().includes(t)) : rules;
  }, [rules, q]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevo.termino.trim()) return;
    try {
      await createIvaRule(nuevo);
      setNuevo({ termino: '', ivaIndicador: 'MINIMA', esEstadoNatural: true, esImportado: false, prioridad: 0 });
      flash('Regla agregada');
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
    }
  }

  async function patch(r: IvaRule, cambios: Partial<IvaRuleInput>) {
    setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...cambios } : x)));
    await updateIvaRule(r.id, cambios).catch((e) => { setError(String(e)); void load(); });
  }

  async function eliminar(r: IvaRule) {
    if (!window.confirm(`¿Eliminar la regla "${r.termino}"?`)) return;
    await deleteIvaRule(r.id).catch((e) => setError(String(e)));
    flash('Regla eliminada');
    void load();
  }

  async function probar() {
    if (!prueba.trim()) return;
    try {
      setResultado(await classifyIva(prueba));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo clasificar');
    }
  }

  async function reclasificar() {
    if (!window.confirm('Reaplicar el motor a TODO el catálogo (productos sin override del contador). ¿Continuar?')) return;
    try {
      const r = await reclassifyIva();
      flash(`Catálogo reclasificado: ${r.actualizados} de ${r.total} productos actualizados.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo reclasificar');
    }
  }

  return (
    <>
      {error && <div className="banner banner--err">{error}</div>}
      {okMsg && <div className="banner banner--ok">{okMsg}</div>}

      <section className="panel">
        <div className="panel__head">
          <h2>Motor de IVA — reglas globales</h2>
          <button className="btn btn--ghost" onClick={reclasificar}>Reclasificar catálogo</button>
        </div>
        <p className="muted" style={{ marginTop: -6 }}>
          Estas reglas asignan el IVA a los productos de todas las verdulerías por su nombre. El fallback es
          <strong> mínima 10% (estado natural)</strong>. Ante varios matches gana la de mayor prioridad.
        </p>

        <form className="cat-new" onSubmit={agregar} style={{ marginTop: 12 }}>
          <input className="search" placeholder="Término (ej. tomate)" value={nuevo.termino} onChange={(e) => setNuevo({ ...nuevo, termino: e.target.value })} />
          <select value={nuevo.ivaIndicador} onChange={(e) => setNuevo({ ...nuevo, ivaIndicador: e.target.value as IvaIndicador })}>
            {INDICADORES.map((i) => <option key={i.v} value={i.v}>{i.label}</option>)}
          </select>
          <label className="chk"><input type="checkbox" checked={nuevo.esEstadoNatural} onChange={(e) => setNuevo({ ...nuevo, esEstadoNatural: e.target.checked })} /> Estado natural</label>
          <label className="chk"><input type="checkbox" checked={nuevo.esImportado} onChange={(e) => setNuevo({ ...nuevo, esImportado: e.target.checked })} /> Importado</label>
          <input className="search" style={{ width: 90 }} type="number" placeholder="Prior." value={nuevo.prioridad} onChange={(e) => setNuevo({ ...nuevo, prioridad: parseInt(e.target.value, 10) || 0 })} />
          <button className="btn btn--primary" type="submit">Agregar</button>
        </form>

        <div style={{ margin: '10px 0' }}>
          <input className="search" placeholder="Buscar término…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {loading ? (
          <p className="muted">Cargando…</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Término</th><th>Tasa</th><th>Natural</th><th>Import.</th><th className="num">Prior.</th><th>Activa</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className={r.activo ? '' : 'row--off'}>
                    <td><strong>{r.termino}</strong>{r.nota && <span className="muted"> · {r.nota}</span>}</td>
                    <td>
                      <select value={r.ivaIndicador} onChange={(e) => patch(r, { ivaIndicador: e.target.value as IvaIndicador })}>
                        {INDICADORES.map((i) => <option key={i.v} value={i.v}>{i.label}</option>)}
                      </select>
                    </td>
                    <td><input type="checkbox" checked={r.esEstadoNatural} onChange={(e) => patch(r, { esEstadoNatural: e.target.checked })} /></td>
                    <td><input type="checkbox" checked={r.esImportado} onChange={(e) => patch(r, { esImportado: e.target.checked })} /></td>
                    <td className="num">
                      <input className="search" style={{ width: 64 }} type="number" value={r.prioridad} onChange={(e) => patch(r, { prioridad: parseInt(e.target.value, 10) || 0 })} />
                    </td>
                    <td><input type="checkbox" checked={r.activo} onChange={(e) => patch(r, { activo: e.target.checked })} /></td>
                    <td><button className="btn btn--sm btn--ghost" onClick={() => eliminar(r)}>✕</button></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} className="muted">Sin reglas.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel__head"><h2>Probar clasificación</h2></div>
        <form className="cat-new" onSubmit={(e) => { e.preventDefault(); void probar(); }}>
          <input className="search" placeholder="Nombre de producto (ej. Tomate cherry)" value={prueba} onChange={(e) => setPrueba(e.target.value)} />
          <button className="btn btn--primary" type="submit">Clasificar</button>
        </form>
        {resultado && (
          <p style={{ marginTop: 12 }}>
            → <strong>{tasaLabel(resultado.ivaIndicador)}</strong>
            {resultado.esEstadoNatural ? ' · estado natural' : ''}
            {resultado.esImportado ? ' · importado' : ''}
            {resultado.regla ? <span className="muted"> (regla: {resultado.regla})</span> : <span className="muted"> (sin regla → fallback)</span>}
          </p>
        )}
      </section>
    </>
  );
}
