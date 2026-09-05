import { useCallback, useEffect, useRef, useState } from 'react';
import { despacharPedido, getOrders, getReparto, pesajeOrder, setLocalUbicacion, setOrderEstado } from '../lib/api';
import type { OnlineOrderEstado, OrderAdmin, OrderItemAdmin, OrdersResponse, RepartoEstado } from '../lib/api';
import { Spinner } from './Skeleton';
import { useToast } from '../lib/toast';

const money = (n: number) => `$${n.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esPeso = (u: string) => u === 'KG' || u === 'GRAMO';

const ESTADOS: OnlineOrderEstado[] = ['NUEVO', 'CONFIRMADO', 'PREPARANDO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'];
const ESTADO_LABEL: Record<OnlineOrderEstado, string> = {
  NUEVO: 'Nuevos', CONFIRMADO: 'Confirmados', PREPARANDO: 'Preparando',
  EN_CAMINO: 'En camino', ENTREGADO: 'Entregados', CANCELADO: 'Cancelados',
};

const POLL_MS = 20000;
const SOUND_KEY = 'ats.admin.pedidos.sonido';

/** Beep corto con WebAudio (sin assets). */
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new Ctx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = 'sine'; osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
    osc.start(); osc.stop(ac.currentTime + 0.42);
    osc.onended = () => void ac.close();
  } catch { /* sin audio */ }
}

export function PedidosPage() {
  const toast = useToast();
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<OnlineOrderEstado | 'TODOS'>('NUEVO');
  const [sonido, setSonido] = useState<boolean>(() => {
    try { return localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; }
  });
  const [pesando, setPesando] = useState<OrderAdmin | null>(null);
  const [reparto, setReparto] = useState<RepartoEstado | null>(null);
  const prevNuevos = useRef<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [d, r] = await Promise.all([getOrders(), getReparto().catch(() => null)]);
      setData(d);
      if (r) setReparto(r);
      const nuevos = d.counts.NUEVO ?? 0;
      if (prevNuevos.current != null && nuevos > prevNuevos.current && sonido) {
        beep();
        toast.info(`Nuevo pedido · ${nuevos} sin confirmar`);
      }
      prevNuevos.current = nuevos;
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setError(m);
    }
  }, [sonido, toast]);

  async function despachar(o: OrderAdmin) {
    try {
      const r = await despacharPedido(o.id);
      setReparto(r);
      const asignado = !r.enCola.some((c) => c.id === o.id);
      toast.success(asignado ? `Pedido #${o.numero} asignado a un repartidor` : `Pedido #${o.numero} en cola de reparto`);
      void cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo despachar');
    }
  }

  useEffect(() => {
    void cargar();
    const t = window.setInterval(() => void cargar(), POLL_MS);
    return () => window.clearInterval(t);
  }, [cargar]);

  function toggleSonido() {
    const v = !sonido;
    setSonido(v);
    try { localStorage.setItem(SOUND_KEY, v ? '1' : '0'); } catch { /* noop */ }
    if (v) beep(); // gesto del usuario: habilita el audio del navegador
  }

  async function cambiarEstado(o: OrderAdmin, estado: OnlineOrderEstado) {
    try {
      await setOrderEstado(o.id, estado);
      toast.success(`Pedido #${o.numero} → ${ESTADO_LABEL[estado]}`);
      void cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar');
    }
  }

  if (!data && !error) return <p className="loading-row"><Spinner /> Cargando pedidos…</p>;
  if (!data) return <div className="banner banner--err">{error}</div>;

  const orders = filtro === 'TODOS' ? data.orders : data.orders.filter((o) => o.estado === filtro);

  return (
    <div>
      <div className="ped-toolbar">
        <div className="ped-tabs">
          <button className={`ped-tab ${filtro === 'TODOS' ? 'is-on' : ''}`} onClick={() => setFiltro('TODOS')}>
            Todos <span>{data.orders.length}</span>
          </button>
          {ESTADOS.map((e) => (
            <button key={e} className={`ped-tab ${filtro === e ? 'is-on' : ''}`} onClick={() => setFiltro(e)}>
              {ESTADO_LABEL[e]} <span>{data.counts[e] ?? 0}</span>
            </button>
          ))}
        </div>
        <button className={`btn btn--ghost btn--sm ${sonido ? 'is-on' : ''}`} onClick={toggleSonido} title="Avisar con sonido los pedidos nuevos">
          {sonido ? '🔔 Avisos ON' : '🔕 Avisos OFF'}
        </button>
      </div>

      <RepartoPanel reparto={reparto} onChange={setReparto} />

      {orders.length === 0 ? (
        <p className="ped-empty">No hay pedidos {filtro !== 'TODOS' ? `en “${ESTADO_LABEL[filtro]}”` : ''}.</p>
      ) : (
        <div className="ped-list">
          {orders.map((o) => (
            <OrderCard key={o.id} o={o} onEstado={cambiarEstado} onPesar={() => setPesando(o)} onDespachar={() => despachar(o)} />
          ))}
        </div>
      )}

      {pesando && (
        <PesajeModal
          order={pesando}
          onClose={() => setPesando(null)}
          onSaved={() => { setPesando(null); void cargar(); }}
        />
      )}
    </div>
  );
}

const REP_ESTADO_LABEL: Record<string, string> = {
  DISPONIBLE: '🟢 Disponible', EN_ENTREGA: '🛵 En entrega', OFFLINE: '⚪ Desconectado',
};

/** Panorama del reparto: ubicación del local, repartidores y cola. */
function RepartoPanel({ reparto, onChange }: { reparto: RepartoEstado | null; onChange: (r: RepartoEstado) => void }) {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [ubicando, setUbicando] = useState(false);
  if (!reparto) return null;

  const reps = reparto.repartidores;
  const activos = reps.filter((r) => r.estado !== 'OFFLINE').length;

  function usarMiUbicacion() {
    if (!navigator.geolocation) return toast.error('Este navegador no da ubicación');
    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await setLocalUbicacion(pos.coords.latitude, pos.coords.longitude);
          onChange(r);
          toast.success('Ubicación del local guardada');
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
        } finally { setUbicando(false); }
      },
      () => { setUbicando(false); toast.error('No se pudo obtener la ubicación'); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <section className="reparto-panel">
      <button className="reparto-panel__head" onClick={() => setAbierto((v) => !v)}>
        <span>🛵 Reparto — {activos} repartidor{activos === 1 ? '' : 'es'} activo{activos === 1 ? '' : 's'}
          {reparto.enCola.length > 0 ? ` · ${reparto.enCola.length} en cola` : ''}</span>
        <span>{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && (
        <div className="reparto-panel__body">
          <div className="reparto-local">
            <span>{reparto.local ? `📍 Local ubicado (${reparto.local.lat.toFixed(4)}, ${reparto.local.lng.toFixed(4)})` : '⚠️ El local no tiene ubicación — la asignación no usará cercanía.'}</span>
            <button className="btn btn--sm btn--ghost" onClick={usarMiUbicacion} disabled={ubicando}>
              {ubicando ? 'Ubicando…' : '📍 Usar mi ubicación'}
            </button>
          </div>

          <div className="reparto-reps">
            {reps.length === 0 && <p className="muted">Ningún repartidor se conectó todavía.</p>}
            {reps.map((r) => (
              <div key={r.userId} className="reparto-rep">
                <strong>{r.nombre}</strong>
                <span>{REP_ESTADO_LABEL[r.estado] ?? r.estado}</span>
                <span className="muted">{r.pedidosEncima > 0 ? `${r.pedidosEncima} pedido(s)` : '—'}</span>
                <span className="muted">{r.ubicacionAt ? new Date(r.ubicacionAt).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' }) : 'sin GPS'}</span>
              </div>
            ))}
          </div>

          {reparto.enCola.length > 0 && (
            <div className="reparto-cola">
              <p className="muted">En cola (esperando repartidor libre):</p>
              {reparto.enCola.map((c) => (
                <div key={c.id} className="reparto-cola__item">#{c.numero} · {c.cliente} · {c.direccion ?? ''}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function OrderCard({ o, onEstado, onPesar, onDespachar }: {
  o: OrderAdmin;
  onEstado: (o: OrderAdmin, e: OnlineOrderEstado) => void;
  onPesar: () => void;
  onDespachar: () => void;
}) {
  const terminal = o.estado === 'ENTREGADO' || o.estado === 'CANCELADO';
  const puedeDespachar = o.tipoEntrega === 'DELIVERY' && !o.asignado && (o.estado === 'CONFIRMADO' || o.estado === 'PREPARANDO');
  const hora = new Date(o.createdAt).toLocaleString('es-UY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const hayPeso = o.items.some((i) => i.esPesable);

  return (
    <div className={`ped-card estado-${o.estado.toLowerCase()}`}>
      <div className="ped-card__head">
        <div>
          <strong>#{o.numero}</strong> <span className={`ped-badge estado-${o.estado.toLowerCase()}`}>{ESTADO_LABEL[o.estado]}</span>
          <span className="ped-card__code">{o.codigo}</span>
        </div>
        <span className="ped-card__time">{hora}</span>
      </div>

      <div className="ped-card__cli">
        <strong>{o.clienteNombre}</strong> · <a href={`tel:${o.clienteTelefono}`}>{o.clienteTelefono}</a>
      </div>
      <div className="ped-card__entrega">
        {o.tipoEntrega === 'DELIVERY'
          ? `🛵 ${o.zonaNombre ?? 'Envío'} — ${o.direccion ?? ''}`
          : '🏪 Retiro en el local'}
        {o.franja ? ` · ${o.franja}` : ''}
      </div>

      <ul className="ped-items">
        {o.items.map((i) => (
          <li key={i.id}>
            <span>{i.concepto} <em>{esPeso(i.unidad) ? `${i.cantidadEfectiva.toFixed(3)} kg${i.cantidadReal != null ? ' ✓' : ' (est.)'}` : `×${i.cantidadEfectiva}`}</em></span>
            <span>{money(i.subtotal)}</span>
          </li>
        ))}
      </ul>
      {o.notas && <p className="ped-card__notas">📝 {o.notas}</p>}

      <div className="ped-card__totals">
        <span>Subtotal {money(o.subtotal)}{o.tipoEntrega === 'DELIVERY' ? ` · envío ${money(o.costoEnvio)}` : ''}</span>
        <strong>Total {money(o.total)}{hayPeso ? ' aprox.' : ''}</strong>
      </div>

      {o.saleId && (
        <div className="ped-card__cfe">
          🧾 {o.comprobante
            ? o.comprobante.serie && o.comprobante.numero != null
              ? `${o.comprobante.tipo === 'TICKET_INTERNO' ? 'Ticket interno' : 'e-Ticket'} ${o.comprobante.serie}-${o.comprobante.numero}`
              : o.comprobante.tipo === 'TICKET_INTERNO' ? 'Ticket interno' : `Comprobante ${o.comprobante.estado}`
            : 'Venta registrada'}
        </div>
      )}

      {o.tipoEntrega === 'DELIVERY' && !terminal && (o.asignado || o.listoParaRepartir) && (
        <div className="ped-card__reparto">
          {o.asignado ? '🛵 Asignado a un repartidor' : '⏳ En cola de reparto (esperando repartidor libre)'}
        </div>
      )}

      {!terminal && (
        <div className="ped-card__actions">
          {o.estado === 'NUEVO' && <button className="btn btn--sm" onClick={() => onEstado(o, 'CONFIRMADO')}>Confirmar</button>}
          <button className="btn btn--sm btn--primary" onClick={onPesar}>⚖ Preparar / pesar</button>
          {puedeDespachar && (
            <button className="btn btn--sm" title="Asigna automáticamente al repartidor libre más cercano al local" onClick={onDespachar}>🛵 Despachar</button>
          )}
          <button
            className="btn btn--sm"
            title="Marca el pedido como entregado y genera la venta + comprobante"
            onClick={() => { if (confirm(`¿Marcar el pedido #${o.numero} como entregado? Se registra la venta y se emite el comprobante.`)) onEstado(o, 'ENTREGADO'); }}
          >✓ Entregado</button>
          <button className="btn btn--sm btn--ghost" onClick={() => { if (confirm(`¿Cancelar el pedido #${o.numero}?`)) onEstado(o, 'CANCELADO'); }}>Cancelar</button>
        </div>
      )}
    </div>
  );
}

function PesajeModal({ order, onClose, onSaved }: { order: OrderAdmin; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const i of order.items) init[i.id] = String(i.cantidadEfectiva);
    return init;
  });
  const [saving, setSaving] = useState(false);

  const num = (s: string) => Number((s || '').replace(',', '.')) || 0;
  const lineTotal = (i: OrderItemAdmin) => i.precioUnit * num(vals[i.id]);
  const subtotal = order.items.reduce((s, i) => s + lineTotal(i), 0);
  const total = subtotal + order.costoEnvio;

  async function guardar() {
    setSaving(true);
    try {
      await pesajeOrder(order.id, order.items.map((i) => ({ itemId: i.id, cantidad: num(vals[i.id]) })));
      toast.success(`Pedido #${order.numero} preparado`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Preparar pedido #{order.numero}</h3>
        <p className="modal__sub">Ajustá el peso/cantidad real de cada ítem. El total se recalcula solo.</p>
        <div className="pesaje-list">
          {order.items.map((i) => (
            <div className="pesaje-row" key={i.id}>
              <div className="pesaje-row__nom">
                <strong>{i.concepto}</strong>
                <small>{money(i.precioUnit)}/{esPeso(i.unidad) ? 'kg' : 'un'} · pedido {esPeso(i.unidad) ? `${i.cantidad.toFixed(3)} kg` : `×${i.cantidad}`}</small>
              </div>
              <input
                type="number" min={0} step={esPeso(i.unidad) ? '0.001' : '1'}
                value={vals[i.id]}
                onChange={(e) => setVals({ ...vals, [i.id]: e.target.value })}
              />
              <span className="pesaje-row__sub">{money(lineTotal(i))}</span>
            </div>
          ))}
        </div>
        <div className="pesaje-total">
          <span>Subtotal {money(subtotal)}{order.tipoEntrega === 'DELIVERY' ? ` · envío ${money(order.costoEnvio)}` : ''}</span>
          <strong>Total {money(total)}</strong>
        </div>
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose} disabled={saving}>Cerrar</button>
          <button className="btn btn--primary" onClick={() => void guardar()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar preparación'}
          </button>
        </div>
      </div>
    </div>
  );
}
