import { useCallback, useEffect, useMemo, useState } from 'react';
import { adjustStock, createWaste, getStock, getSucursales, getWaste } from '../lib/api';
import type { StockRow, Sucursal, WasteRow } from '../lib/api';

type ModalKind = 'merma' | 'ajuste';

function money(n: number): string {
  return n.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function margenClass(m: number | null): string {
  if (m == null) return 'muted';
  if (m < 15) return 'mrg mrg--bad';
  if (m < 30) return 'mrg mrg--warn';
  return 'mrg mrg--ok';
}

export function StockPage() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [waste, setWaste] = useState<WasteRow[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucFilter, setSucFilter] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ kind: ModalKind; row: StockRow } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, w, su] = await Promise.all([getStock(sucFilter || undefined), getWaste(), getSucursales()]);
      setRows(s);
      setWaste(w);
      setSucursales(su.filter((x) => x.activo));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando');
    } finally {
      setLoading(false);
    }
  }, [sucFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => r.nombre.toLowerCase().includes(t)) : rows;
  }, [rows, q]);

  const valorStock = useMemo(
    () => rows.reduce((s, r) => s + r.cantidad * r.costoPromedio, 0),
    [rows],
  );

  function flash(m: string) {
    setOkMsg(m);
    window.setTimeout(() => setOkMsg(null), 3000);
  }

  return (
    <>
      {error && <div className="banner banner--err">{error}</div>}
      {okMsg && <div className="banner banner--ok">{okMsg}</div>}

      <section className="panel">
        <div className="panel__head">
          <h2>Stock y márgenes</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="pill">Valor del stock: ${money(valorStock)}</span>
            {sucursales.length > 1 && (
              <select value={sucFilter} onChange={(e) => setSucFilter(e.target.value)}>
                <option value="">Todas las sucursales</option>
                {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            )}
            <input className="search" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <p className="muted">Cargando…</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Stock</th>
                  <th className="num">Costo/u</th>
                  <th className="num">Precio</th>
                  <th className="num">Margen</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.productId}>
                    <td>
                      <strong>{r.nombre}</strong>
                      {r.categoriaNombre && <span className="muted"> · {r.categoriaNombre}</span>}
                    </td>
                    <td className="num">{money(r.cantidad)} {r.unidadVenta.toLowerCase()}</td>
                    <td className="num">${money(r.costoPromedio)}</td>
                    <td className="num">${money(r.precio)}</td>
                    <td className="num">
                      <span className={margenClass(r.margenPct)}>
                        {r.margenPct == null ? '—' : `${r.margenPct}%`}
                      </span>
                    </td>
                    <td className="num">
                      <button className="btn btn--sm btn--ghost" onClick={() => setModal({ kind: 'ajuste', row: r })}>Ajuste</button>
                      <button className="btn btn--sm btn--ghost" onClick={() => setModal({ kind: 'merma', row: r })}>Merma</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} className="muted">Sin stock cargado. Registrá una compra.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">El costo incluye la merma estimada del producto. Margen &lt; 15% en rojo, &lt; 30% en amarillo.</p>
      </section>

      <section className="panel">
        <div className="panel__head"><h2>Últimas mermas</h2></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Fecha</th><th>Producto</th><th className="num">Cantidad</th><th className="num">Costo</th><th>Motivo</th></tr>
            </thead>
            <tbody>
              {waste.map((w) => (
                <tr key={w.id}>
                  <td>{new Date(w.fecha).toLocaleDateString('es-UY')}</td>
                  <td>{w.nombre}</td>
                  <td className="num">{money(w.cantidad)} {w.unidadVenta.toLowerCase()}</td>
                  <td className="num">${money(w.costoTotal)}</td>
                  <td>{w.motivo ?? '—'}</td>
                </tr>
              ))}
              {waste.length === 0 && <tr><td colSpan={5} className="muted">Sin mermas registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {modal && (
        <StockActionModal
          kind={modal.kind}
          row={modal.row}
          sucursalId={sucFilter || undefined}
          sucursalNombre={sucursales.find((s) => s.id === sucFilter)?.nombre ?? null}
          onClose={() => setModal(null)}
          onDone={(msg) => { setModal(null); flash(msg); void load(); }}
          onError={(m) => setError(m)}
        />
      )}
    </>
  );
}

function StockActionModal({
  kind,
  row,
  sucursalId,
  sucursalNombre,
  onClose,
  onDone,
  onError,
}: {
  kind: ModalKind;
  row: StockRow;
  sucursalId?: string;
  sucursalNombre: string | null;
  onClose: () => void;
  onDone: (msg: string) => void;
  onError: (m: string) => void;
}) {
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const esMerma = kind === 'merma';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(cantidad);
    if (Number.isNaN(n) || n === 0) return;
    setSaving(true);
    try {
      if (esMerma) {
        const r = await createWaste({ productId: row.productId, cantidad: Math.abs(n), sucursalId, motivo: motivo || undefined });
        onDone(`Merma registrada: −$${money(r.costoTotal)} en ${row.nombre}.`);
      } else {
        const r = await adjustStock({ productId: row.productId, cantidad: n, sucursalId, motivo: motivo || undefined });
        onDone(`Stock de ${row.nombre}: ${money(r.cantidad)} ${row.unidadVenta.toLowerCase()}.`);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo aplicar');
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>{esMerma ? 'Registrar merma' : 'Ajustar stock'} — {row.nombre}</h3>
        <p className="modal__sub">
          {sucursalNombre ? `Sucursal: ${sucursalNombre}. ` : ''}
          Stock actual: {money(row.cantidad)} {row.unidadVenta.toLowerCase()}.
          {esMerma ? ' Se descuenta al costo promedio.' : ' Usá negativo para restar, positivo para sumar.'}
        </p>
        <label className="field">
          {esMerma ? `Cantidad a descartar (${row.unidadVenta.toLowerCase()})` : `Diferencia (${row.unidadVenta.toLowerCase()})`}
          <input type="number" step="0.001" value={cantidad} onChange={(e) => setCantidad(e.target.value)}
            placeholder={esMerma ? 'ej. 2.5' : 'ej. -1.2 o 3'} autoFocus required />
        </label>
        <label className="field">
          Motivo
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder={esMerma ? 'pudrición, golpe, descarte…' : 'recuento, corrección…'} />
        </label>
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className={`btn ${esMerma ? 'btn--danger' : 'btn--primary'}`} disabled={saving}>
            {saving ? 'Guardando…' : esMerma ? 'Registrar merma' : 'Ajustar'}
          </button>
        </div>
      </form>
    </div>
  );
}
