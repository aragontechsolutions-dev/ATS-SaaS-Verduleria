import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  crearListaPrecio, getListasPrecio, getPreciosLista, guardarPreciosLista, preciosMasivo,
  type ListaPrecio, type PrecioListaItem, type TipoLista,
} from '../lib/api';
import { useToast } from '../lib/toast';

const money = (n: number) => '$' + n.toLocaleString('es-UY', { maximumFractionDigits: 2 });
const num = (s: string) => parseFloat(s.replace(',', '.')) || 0;

const TIPO_LABEL: Record<TipoLista, string> = {
  MOSTRADOR: 'Mostrador', MAYORISTA_A: 'Mayorista A', MAYORISTA_B: 'Mayorista B', POR_CLIENTE: 'Por cliente',
};

export function PreciosMayoristasPage() {
  const toast = useToast();
  const [listas, setListas] = useState<ListaPrecio[]>([]);
  const [listId, setListId] = useState<string | null>(null);
  const [items, setItems] = useState<PrecioListaItem[] | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);

  // Barra masiva
  const [modo, setModo] = useState<'margenCosto' | 'descuentoMostrador' | 'igualMostrador'>('margenCosto');
  const [valor, setValor] = useState('30');
  const [soloVacios, setSoloVacios] = useState(true);

  const cargarListas = useCallback(async () => {
    const ls = await getListasPrecio();
    const mayoristas = ls.filter((l) => l.tipo !== 'MOSTRADOR');
    setListas(mayoristas);
    setListId((prev) => prev ?? mayoristas[0]?.id ?? null);
  }, []);

  useEffect(() => { void cargarListas().catch((e) => toast.error(e instanceof Error ? e.message : 'Error')); }, [cargarListas, toast]);

  const cargarPrecios = useCallback(async (id: string) => {
    setItems(null);
    setEdits({});
    const r = await getPreciosLista(id);
    setItems(r.items);
  }, []);

  useEffect(() => { if (listId) void cargarPrecios(listId).catch((e) => toast.error(e instanceof Error ? e.message : 'Error')); }, [listId, cargarPrecios, toast]);

  async function nuevaLista() {
    const nombre = window.prompt('Nombre de la lista (ej. "Mayorista A")');
    if (!nombre) return;
    try {
      const l = await crearListaPrecio(nombre.trim(), 'MAYORISTA_A');
      await cargarListas();
      setListId(l.id);
      toast.success('Lista creada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear');
    }
  }

  const filtrados = useMemo(() => {
    if (!items) return [];
    const t = q.trim().toLowerCase();
    return t ? items.filter((i) => i.nombre.toLowerCase().includes(t)) : items;
  }, [items, q]);

  const dirty = Object.keys(edits).length > 0;

  async function guardar() {
    if (!listId || !dirty) return;
    const payload = Object.entries(edits).map(([productId, v]) => ({ productId, precio: num(v) }));
    setSaving(true);
    try {
      await guardarPreciosLista(listId, payload);
      toast.success(`Guardado (${payload.length})`);
      await cargarPrecios(listId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function aplicarMasivo() {
    if (!listId) return;
    setSaving(true);
    try {
      const r = await preciosMasivo(listId, { modo, valor: num(valor), soloVacios: modo !== 'igualMostrador' ? soloVacios : soloVacios });
      toast.success(`Aplicado a ${r.actualizados} productos`);
      await cargarPrecios(listId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo aplicar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pm">
      <div className="pm__head">
        <div>
          <h2 className="pm__title">🤝 Precios mayoristas</h2>
          <p className="muted">Cargá el precio <b>NETO</b> (sin IVA) por producto. En el POS, al vender a un cliente mayorista, se aplica esta lista + IVA 22%.</p>
        </div>
      </div>

      <div className="pm__bar">
        <label className="field field--inline">
          Lista
          <select value={listId ?? ''} onChange={(e) => setListId(e.target.value || null)}>
            {listas.length === 0 && <option value="">— sin listas —</option>}
            {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre} · {TIPO_LABEL[l.tipo]} ({l.items})</option>)}
          </select>
        </label>
        <button className="btn btn--ghost btn--sm" onClick={() => void nuevaLista()}>+ Nueva lista</button>
        <div className="pm__spacer" />
        <input className="pm__search" type="search" placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {listas.length === 0 ? (
        <div className="panel"><p className="muted">No tenés listas mayoristas. Creá una con “+ Nueva lista”.</p></div>
      ) : (
        <>
          <div className="pm__masivo">
            <span className="pm__masivo-t">Fijar en lote:</span>
            <select value={modo} onChange={(e) => setModo(e.target.value as typeof modo)}>
              <option value="margenCosto">Margen % sobre el costo</option>
              <option value="descuentoMostrador">Descuento % sobre mostrador</option>
              <option value="igualMostrador">Igualar al precio de mostrador</option>
            </select>
            {modo !== 'igualMostrador' && (
              <input className="pm__valor" type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
            )}
            {modo !== 'igualMostrador' && <span className="muted">%</span>}
            <label className="pm__chk"><input type="checkbox" checked={soloVacios} onChange={(e) => setSoloVacios(e.target.checked)} /> solo los que no tienen precio</label>
            <button className="btn btn--ghost btn--sm" onClick={() => void aplicarMasivo()} disabled={saving}>Aplicar</button>
          </div>

          <div className="panel pm__tablewrap">
            <table className="pm__table">
              <thead>
                <tr><th>Producto</th><th>Categoría</th><th className="r">Costo</th><th className="r">Mostrador</th><th className="r">Precio neto</th><th className="r">+ IVA 22%</th></tr>
              </thead>
              <tbody>
                {items === null ? (
                  <tr><td colSpan={6} className="muted">Cargando…</td></tr>
                ) : filtrados.length === 0 ? (
                  <tr><td colSpan={6} className="muted">Sin productos.</td></tr>
                ) : filtrados.map((it) => {
                  const val = edits[it.productId] ?? (it.precioNeto != null ? String(it.precioNeto) : '');
                  const neto = num(val);
                  return (
                    <tr key={it.productId}>
                      <td>{it.nombre}</td>
                      <td className="muted">{it.categoriaNombre ?? '—'}</td>
                      <td className="r muted">{money(it.costo)}</td>
                      <td className="r muted">{money(it.precioMostrador)}</td>
                      <td className="r">
                        <input
                          className="pm__inp"
                          type="number"
                          inputMode="decimal"
                          value={val}
                          placeholder="—"
                          onChange={(e) => setEdits((p) => ({ ...p, [it.productId]: e.target.value }))}
                        />
                        <small>/{it.unidadVenta.toLowerCase()}</small>
                      </td>
                      <td className="r pm__gross">{neto > 0 ? money(Math.round(neto * 1.22 * 100) / 100) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pm__foot">
            <span className="muted">{dirty ? `${Object.keys(edits).length} cambio(s) sin guardar` : 'Sin cambios'}</span>
            <button className="btn btn--primary" onClick={() => void guardar()} disabled={!dirty || saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
