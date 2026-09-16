import { useEffect, useMemo, useState } from 'react';
import {
  crearRemito, getCustomers, getProducts, getRemito, getRemitos, getSettings, setEstadoRemito,
  type Customer, type Product, type RemitoRow, type RemitoEstado, type RemitoItemInput, type Settings,
} from '../lib/api';
import { ProductSearchSelect } from './ProductSearchSelect';
import { useToast } from '../lib/toast';

const cant = (n: number) => n.toLocaleString('es-UY', { maximumFractionDigits: 3 });
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-UY');

const ESTADO_LABEL: Record<RemitoEstado, string> = { BORRADOR: 'Borrador', DESPACHADO: 'Despachado', ANULADO: 'Anulado' };

export function RemitosPage() {
  const toast = useToast();
  const [rows, setRows] = useState<RemitoRow[] | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    try { setRows(await getRemitos()); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Error'); setRows([]); }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  async function cambiarEstado(r: RemitoRow, estado: RemitoEstado) {
    try {
      await setEstadoRemito(r.id, estado);
      toast.success(`Remito ${ESTADO_LABEL[estado].toLowerCase()}`);
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo'); }
  }

  async function imprimir(id: string) {
    try {
      const [r, s] = await Promise.all([getRemito(id), getSettings().catch(() => null)]);
      abrirImpresion(r, s);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo abrir'); }
  }

  return (
    <>
      <section className="panel">
        <div className="panel__head">
          <h2>Remitos de traslado</h2>
          <button className="btn btn--primary" onClick={() => setCreating(true)}>+ Nuevo remito</button>
        </div>
        <p className="hint">Comprobante de entrega (no fiscal) para la mercadería mayorista que se lleva el cliente o el transporte. El e-Remito fiscal (DGI) es aparte.</p>

        {rows === null ? (
          <p className="muted">Cargando…</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>N.º</th><th>Fecha</th><th>Cliente</th><th>Transporte</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>#{r.numero}</td>
                    <td>{fecha(r.fecha)}</td>
                    <td><strong>{r.clienteNombre}</strong>{r.clienteDoc && <span className="muted"> · {r.clienteDoc}</span>}</td>
                    <td>{r.transportista || '—'}{r.matricula ? ` · ${r.matricula}` : ''}</td>
                    <td><span className={`badge badge--${r.estado.toLowerCase()}`}>{ESTADO_LABEL[r.estado]}</span></td>
                    <td className="num row-actions">
                      <button className="btn btn--sm btn--ghost" onClick={() => void imprimir(r.id)}>🖨️ Imprimir</button>
                      {r.estado === 'BORRADOR' && <button className="btn btn--sm btn--ghost" onClick={() => void cambiarEstado(r, 'DESPACHADO')}>Despachar</button>}
                      {r.estado !== 'ANULADO' && <button className="btn btn--sm btn--ghost" onClick={() => { if (confirm('¿Anular remito?')) void cambiarEstado(r, 'ANULADO'); }}>Anular</button>}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="muted">Sin remitos. Creá el primero.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {creating && <NuevoRemitoModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load(); }} />}
    </>
  );
}

interface Linea extends RemitoItemInput { key: string }

function NuevoRemitoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [clientes, setClientes] = useState<Customer[]>([]);
  const [productos, setProductos] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [clienteLibre, setClienteLibre] = useState('');
  const [transportista, setTransportista] = useState('');
  const [matricula, setMatricula] = useState('');
  const [destino, setDestino] = useState('');
  const [notas, setNotas] = useState('');
  const [items, setItems] = useState<Linea[]>([]);
  const [prodSel, setProdSel] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCustomers(true).then((cs) => setClientes(cs.filter((c) => c.esMayorista && c.activo))).catch(() => setClientes([]));
    getProducts().then(setProductos).catch(() => setProductos([]));
  }, []);

  const prodById = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  function agregarItem() {
    const p = prodById.get(prodSel);
    const c = parseFloat(cantidad.replace(',', '.')) || 0;
    if (!p || c <= 0) { toast.error('Elegí un producto y una cantidad.'); return; }
    setItems((prev) => [...prev, { key: `${p.id}-${Date.now()}`, productId: p.id, concepto: p.nombre, unidad: p.unidadVenta, cantidad: c }]);
    setProdSel('');
    setCantidad('');
  }

  async function guardar() {
    if (items.length === 0) { toast.error('Agregá al menos un producto.'); return; }
    if (!customerId && !clienteLibre.trim()) { toast.error('Elegí o escribí el cliente.'); return; }
    setSaving(true);
    try {
      const r = await crearRemito({
        customerId: customerId || undefined,
        clienteNombre: customerId ? undefined : clienteLibre.trim(),
        transportista: transportista.trim() || undefined,
        matricula: matricula.trim() || undefined,
        destino: destino.trim() || undefined,
        notas: notas.trim() || undefined,
        items: items.map(({ productId, concepto, unidad, cantidad }) => ({ productId, concepto, unidad, cantidad })),
      });
      toast.success(`Remito #${r.numero} creado`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear');
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <h3>Nuevo remito</h3>

        <div className="row2">
          <label className="field">
            Cliente mayorista
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">— otro (escribir) —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.documento ? ` · ${c.documento}` : ''}</option>)}
            </select>
          </label>
          {!customerId && (
            <label className="field">
              Nombre del cliente
              <input value={clienteLibre} onChange={(e) => setClienteLibre(e.target.value)} placeholder="Razón social / nombre" />
            </label>
          )}
        </div>

        <div className="row3">
          <label className="field">Transportista<input value={transportista} onChange={(e) => setTransportista(e.target.value)} placeholder="Nombre" /></label>
          <label className="field">Matrícula<input value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="Patente del camión" /></label>
          <label className="field">Destino<input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Dirección de entrega" /></label>
        </div>

        <div className="rem-add">
          <div className="rem-add__prod"><ProductSearchSelect products={productos} value={prodSel} onChange={setProdSel} /></div>
          <input className="rem-add__cant" type="number" inputMode="decimal" placeholder="Cant." value={cantidad} onChange={(e) => setCantidad(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarItem(); } }} />
          <button className="btn btn--ghost" onClick={agregarItem}>Agregar</button>
        </div>

        <div className="rem-items">
          {items.length === 0 ? (
            <p className="muted">Sin ítems. Agregá productos con la cantidad real a despachar.</p>
          ) : items.map((it) => (
            <div className="rem-item" key={it.key}>
              <span>{it.concepto}</span>
              <span className="muted">{cant(it.cantidad)} {it.unidad.toLowerCase()}</span>
              <button className="btn btn--sm btn--ghost" onClick={() => setItems((prev) => prev.filter((x) => x.key !== it.key))} aria-label="Quitar">✕</button>
            </div>
          ))}
        </div>

        <label className="field">Notas<input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones (opcional)" /></label>

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn--primary" onClick={() => void guardar()} disabled={saving}>{saving ? 'Guardando…' : 'Crear remito'}</button>
        </div>
      </div>
    </div>
  );
}

/** Abre una ventana con el remito formateado y lanza la impresión. */
function abrirImpresion(r: import('../lib/api').RemitoFull, s: Settings | null) {
  const esc = (t: string | null | undefined) => (t ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
  const emisor = s ? `${esc(s.razonSocial || s.nombre)}${s.rut ? ` · RUT ${esc(s.rut)}` : ''}` : '';
  const emisorExtra = s ? [s.direccion, s.telefono].filter(Boolean).map(esc).join(' · ') : '';
  const filas = r.items.map((it) => `<tr><td>${esc(it.concepto)}</td><td class="r">${cant(it.cantidad)}</td><td>${esc(it.unidad.toLowerCase())}</td></tr>`).join('');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Remito #${r.numero}</title>
  <style>
    body{font-family:system-ui,Arial,sans-serif;color:#111;padding:28px;max-width:720px;margin:0 auto}
    h1{font-size:20px;margin:0} .muted{color:#666} .r{text-align:right}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px}
    .num{font-size:18px;font-weight:800}
    .box{border:1px solid #ccc;border-radius:8px;padding:10px 12px;margin:10px 0;font-size:14px}
    table{width:100%;border-collapse:collapse;margin-top:12px;font-size:14px}
    th,td{border-bottom:1px solid #ddd;padding:7px 8px;text-align:left} th{background:#f3f3f3}
    .firmas{display:flex;justify-content:space-between;margin-top:48px;font-size:13px;color:#444}
    .firmas div{border-top:1px solid #999;width:44%;text-align:center;padding-top:6px}
    .aviso{margin-top:18px;font-size:11px;color:#888}
    @media print{ .noprint{display:none} }
  </style></head><body>
    <div class="head">
      <div><h1>${emisor || 'REMITO'}</h1><div class="muted">${emisorExtra}</div></div>
      <div style="text-align:right"><div class="num">REMITO N.º ${r.numero}</div><div class="muted">${fecha(r.fecha)}</div></div>
    </div>
    <div class="box"><strong>Cliente:</strong> ${esc(r.clienteNombre)}${r.clienteDoc ? ` · ${esc(r.clienteDoc)}` : ''}${r.destino ? `<br><strong>Destino:</strong> ${esc(r.destino)}` : ''}</div>
    <div class="box"><strong>Transporte:</strong> ${esc(r.transportista) || '—'}${r.matricula ? ` · Matrícula: ${esc(r.matricula)}` : ''}</div>
    <table><thead><tr><th>Descripción</th><th class="r">Cantidad</th><th>Unidad</th></tr></thead><tbody>${filas}</tbody></table>
    ${r.notas ? `<p class="muted" style="margin-top:12px"><strong>Notas:</strong> ${esc(r.notas)}</p>` : ''}
    <div class="firmas"><div>Entregó</div><div>Recibió (aclaración y firma)</div></div>
    <p class="aviso">Documento no fiscal. No sustituye la factura ni el e-Remito de DGI.</p>
    <button class="noprint" onclick="window.print()" style="margin-top:20px;padding:10px 16px">Imprimir</button>
  </body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => { try { w.print(); } catch { /* el usuario puede usar el botón */ } }, 400);
}
