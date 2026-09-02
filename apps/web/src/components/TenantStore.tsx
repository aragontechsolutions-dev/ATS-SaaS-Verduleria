import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  createOrder,
  getOrder,
  getStoreCatalog,
  NotFoundError,
  type CreateOrderInput,
  type OrderResult,
  type OrderView,
  type StoreCatalog,
  type StoreProduct,
  type TipoEntrega,
} from '../lib/api';
import { esPeso, formatMoney, unidadCorta } from '../lib/format';

const ESTADO_LABEL: Record<string, string> = {
  NUEVO: 'Recibido', CONFIRMADO: 'Confirmado', PREPARANDO: 'En preparación',
  EN_CAMINO: 'En camino', ENTREGADO: 'Entregado', CANCELADO: 'Cancelado',
};

type Load = { e: 'load' } | { e: 'ok'; data: StoreCatalog } | { e: '404' } | { e: 'error' };
type Step = 'shop' | 'checkout' | 'done';

const ACCENT = '#0F8A7C';

export function TenantStore({ slug }: { slug: string }) {
  const [s, setS] = useState<Load>({ e: 'load' });
  const [qty, setQty] = useState<Record<string, number>>({});
  const [step, setStep] = useState<Step>('shop');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderResult | null>(null);

  useEffect(() => {
    let vivo = true;
    getStoreCatalog(slug)
      .then((data) => vivo && setS({ e: 'ok', data }))
      .catch((err) => vivo && setS({ e: err instanceof NotFoundError ? '404' : 'error' }));
    return () => { vivo = false; };
  }, [slug]);

  useEffect(() => { if (s.e === 'ok') document.title = `${s.data.nombre} · Tienda`; }, [s]);

  const style = useMemo(() => ({ '--sh-accent': ACCENT }) as CSSProperties, []);

  // Seguimiento de un pedido por código (?codigo=XXXX).
  const trackCodigo = new URLSearchParams(window.location.search).get('codigo');
  if (trackCodigo) return <TrackView slug={slug} codigo={trackCodigo} />;

  if (s.e === 'load') return <div className="sh-center">Cargando tienda…</div>;
  if (s.e === '404') {
    return (
      <div className="sh-center sh-404">
        <h1>Tienda no disponible</h1>
        <p>Esta verdulería todavía no abrió su tienda online.</p>
        <a href={`/v/${encodeURIComponent(slug)}`}>Ver su página</a>
      </div>
    );
  }
  if (s.e === 'error') return <div className="sh-center">No se pudo cargar la tienda. Probá de nuevo.</div>;

  const cat = s.data;
  const productById = new Map(cat.productos.map((p) => [p.id, p]));
  const lines = Object.entries(qty)
    .filter(([, c]) => c > 0)
    .map(([id, c]) => ({ product: productById.get(id)!, cantidad: c }))
    .filter((l) => l.product);
  const subtotal = lines.reduce((acc, l) => acc + l.product.precio * l.cantidad, 0);
  const cartCount = lines.length;

  function setQ(id: string, n: number) {
    setQty((q) => ({ ...q, [id]: Math.max(0, Number(n.toFixed(3))) }));
  }

  async function confirmar(input: CreateOrderInput) {
    const res = await createOrder(slug, input);
    setOrder(res);
    setQty({});
    setStep('done');
  }

  return (
    <div className="sh" style={style}>
      <header className="sh-top">
        <a className="sh-back" href={`/v/${encodeURIComponent(slug)}`}>‹ {cat.nombre}</a>
        {step === 'shop' && cartCount > 0 && (
          <button className="sh-cartbtn" onClick={() => setStep('checkout')}>
            🛒 {cartCount} · {formatMoney(subtotal)}
          </button>
        )}
      </header>

      {step === 'shop' && (
        <ShopView cat={cat} qty={qty} setQ={setQ} catFilter={catFilter} setCatFilter={setCatFilter} />
      )}
      {step === 'shop' && cartCount > 0 && (
        <div className="sh-bar">
          <span>{cartCount} {cartCount === 1 ? 'producto' : 'productos'} · <strong>{formatMoney(subtotal)}</strong> aprox.</span>
          <button className="sh-btn sh-btn--primary" onClick={() => setStep('checkout')}>Hacer pedido</button>
        </div>
      )}

      {step === 'checkout' && (
        <CheckoutView cat={cat} lines={lines} subtotal={subtotal} onBack={() => setStep('shop')} onConfirm={confirmar} />
      )}

      {step === 'done' && order && (
        <Confirmation order={order} slug={slug} onMore={() => { setOrder(null); setStep('shop'); }} />
      )}
    </div>
  );
}

// --- Catálogo ----------------------------------------------------------------

function ShopView({
  cat, qty, setQ, catFilter, setCatFilter,
}: {
  cat: StoreCatalog;
  qty: Record<string, number>;
  setQ: (id: string, n: number) => void;
  catFilter: string | null;
  setCatFilter: (id: string | null) => void;
}) {
  const productos = catFilter ? cat.productos.filter((p) => p.categoriaId === catFilter) : cat.productos;

  return (
    <>
      {cat.categorias.length > 1 && (
        <div className="sh-cats">
          <button className={`sh-chip ${!catFilter ? 'is-on' : ''}`} onClick={() => setCatFilter(null)}>Todo</button>
          {cat.categorias.map((c) => (
            <button key={c.id} className={`sh-chip ${catFilter === c.id ? 'is-on' : ''}`} onClick={() => setCatFilter(c.id)}>
              {c.nombre}
            </button>
          ))}
        </div>
      )}
      <div className="sh-grid">
        {productos.map((p) => <ProductCard key={p.id} p={p} cantidad={qty[p.id] ?? 0} setQ={setQ} />)}
      </div>
      {productos.length === 0 && <p className="sh-empty">No hay productos en esta categoría.</p>}
    </>
  );
}

function ProductCard({ p, cantidad, setQ }: { p: StoreProduct; cantidad: number; setQ: (id: string, n: number) => void }) {
  const peso = esPeso(p.unidadVenta);
  const paso = peso ? 0.25 : 1;
  const inicial = peso ? 1 : 1;
  const enCarrito = cantidad > 0;

  return (
    <div className={`sh-card ${!p.disponible ? 'is-out' : ''}`}>
      <div className="sh-card__img" style={p.imagenUrl ? { backgroundImage: `url(${p.imagenUrl})` } : undefined}>
        {!p.imagenUrl && <span className="sh-card__ph">🥬</span>}
        {!p.disponible && <span className="sh-card__out">Sin stock</span>}
      </div>
      <div className="sh-card__body">
        <strong className="sh-card__name">{p.nombre}</strong>
        {p.descripcionOnline && <p className="sh-card__desc">{p.descripcionOnline}</p>}
        <div className="sh-card__price">{formatMoney(p.precio)} <span>/{unidadCorta(p.unidadVenta)}</span></div>

        {!p.disponible ? (
          <button className="sh-add" disabled>No disponible</button>
        ) : !enCarrito ? (
          <button className="sh-add" onClick={() => setQ(p.id, inicial)}>Agregar</button>
        ) : (
          <div className="sh-qty">
            <button onClick={() => setQ(p.id, cantidad - paso)} aria-label="Quitar">−</button>
            <span>{peso ? `${cantidad.toFixed(3)} kg` : `${cantidad}`}</span>
            <button onClick={() => setQ(p.id, cantidad + paso)} aria-label="Agregar">+</button>
          </div>
        )}
        {enCarrito && <div className="sh-card__sub">{formatMoney(p.precio * cantidad)}{peso ? ' aprox.' : ''}</div>}
      </div>
    </div>
  );
}

// --- Checkout ----------------------------------------------------------------

function CheckoutView({
  cat, lines, subtotal, onBack, onConfirm,
}: {
  cat: StoreCatalog;
  lines: Array<{ product: StoreProduct; cantidad: number }>;
  subtotal: number;
  onBack: () => void;
  onConfirm: (input: CreateOrderInput) => Promise<void>;
}) {
  const puedeDelivery = cat.config.deliveryActivo && cat.zonas.length > 0;
  const puedePickup = cat.config.pickupActivo;
  const [tipo, setTipo] = useState<TipoEntrega>(puedeDelivery ? 'DELIVERY' : 'PICKUP');
  const [zonaId, setZonaId] = useState(cat.zonas[0]?.id ?? '');
  const [franja, setFranja] = useState(cat.config.franjas[0] ?? '');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [notas, setNotas] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const zona = cat.zonas.find((z) => z.id === zonaId) ?? null;
  const costoEnvio = tipo === 'DELIVERY' && zona ? zona.costoEnvio : 0;
  const total = subtotal + costoEnvio;
  const minimo = tipo === 'DELIVERY' && zona ? zona.pedidoMinimo : 0;
  const faltaMinimo = minimo > 0 && subtotal < minimo;

  const hayPeso = lines.some((l) => esPeso(l.product.unidadVenta));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (faltaMinimo) { setErr(`El pedido mínimo para ${zona!.nombre} es ${formatMoney(minimo)}.`); return; }
    setBusy(true);
    try {
      await onConfirm({
        tipoEntrega: tipo,
        zonaId: tipo === 'DELIVERY' ? zonaId : undefined,
        franja: cat.config.franjas.length ? franja : undefined,
        clienteNombre: nombre.trim(),
        clienteTelefono: telefono.trim(),
        direccion: tipo === 'DELIVERY' ? direccion.trim() : undefined,
        notas: notas.trim() || undefined,
        items: lines.map((l) => ({ productId: l.product.id, cantidad: l.cantidad })),
      });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'No se pudo enviar el pedido.');
      setBusy(false);
    }
  }

  return (
    <form className="sh-checkout" onSubmit={submit}>
      <button type="button" className="sh-linkback" onClick={onBack}>‹ Seguir comprando</button>
      <h2>Tu pedido</h2>

      <div className="sh-summary">
        {lines.map((l) => (
          <div className="sh-sumrow" key={l.product.id}>
            <span>{l.product.nombre} <em>{esPeso(l.product.unidadVenta) ? `${l.cantidad.toFixed(3)} kg` : `×${l.cantidad}`}</em></span>
            <span>{formatMoney(l.product.precio * l.cantidad)}</span>
          </div>
        ))}
      </div>

      {hayPeso && (
        <p className="sh-note">Los productos por peso se cobran al peso real cuando se preparan; el total puede variar un poco.</p>
      )}

      <h3>Entrega</h3>
      <div className="sh-seg">
        {puedeDelivery && (
          <button type="button" className={tipo === 'DELIVERY' ? 'is-on' : ''} onClick={() => setTipo('DELIVERY')}>Envío a domicilio</button>
        )}
        {puedePickup && (
          <button type="button" className={tipo === 'PICKUP' ? 'is-on' : ''} onClick={() => setTipo('PICKUP')}>Retiro en el local</button>
        )}
      </div>

      {tipo === 'DELIVERY' && (
        <>
          <label className="sh-field">Zona de reparto
            <select value={zonaId} onChange={(e) => setZonaId(e.target.value)}>
              {cat.zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nombre} · envío {formatMoney(z.costoEnvio)}{z.pedidoMinimo > 0 ? ` · mín. ${formatMoney(z.pedidoMinimo)}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="sh-field">Dirección
            <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, número, apto, referencias" required />
          </label>
        </>
      )}

      {cat.config.franjas.length > 0 && (
        <label className="sh-field">¿Cuándo lo querés?
          <select value={franja} onChange={(e) => setFranja(e.target.value)}>
            {cat.config.franjas.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
      )}

      <label className="sh-field">Nombre
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} />
      </label>
      <label className="sh-field">Teléfono
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} required minLength={6} inputMode="tel" placeholder="Para coordinar la entrega" />
      </label>
      <label className="sh-field">Notas (opcional)
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Ej.: bien maduro, timbre 2…" />
      </label>

      {cat.config.notaCheckout && <p className="sh-note">{cat.config.notaCheckout}</p>}

      <div className="sh-totals">
        <div><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
        {tipo === 'DELIVERY' && <div><span>Envío</span><span>{formatMoney(costoEnvio)}</span></div>}
        <div className="sh-totals__big"><span>Total {hayPeso ? 'aprox.' : ''}</span><span>{formatMoney(total)}</span></div>
      </div>

      <p className="sh-pay">💵 El pago es <strong>al recibir</strong> (efectivo o tarjeta en la puerta).</p>

      {faltaMinimo && <p className="sh-err">Te faltan {formatMoney(minimo - subtotal)} para llegar al mínimo de {zona!.nombre}.</p>}
      {err && <p className="sh-err">{err}</p>}

      <button className="sh-btn sh-btn--primary sh-btn--full" type="submit" disabled={busy || faltaMinimo}>
        {busy ? 'Enviando…' : `Confirmar pedido · ${formatMoney(total)}`}
      </button>
    </form>
  );
}

// --- Seguimiento -------------------------------------------------------------

function TrackView({ slug, codigo }: { slug: string; codigo: string }) {
  const [st, setSt] = useState<{ e: 'load' } | { e: 'ok'; o: OrderView } | { e: '404' } | { e: 'error' }>({ e: 'load' });

  useEffect(() => {
    let vivo = true;
    getOrder(slug, codigo)
      .then((o) => vivo && setSt({ e: 'ok', o }))
      .catch((err) => vivo && setSt({ e: err instanceof NotFoundError ? '404' : 'error' }));
    return () => { vivo = false; };
  }, [slug, codigo]);

  const style = useMemo(() => ({ '--sh-accent': ACCENT }) as CSSProperties, []);
  const volver = `/v/${encodeURIComponent(slug)}/tienda`;

  if (st.e === 'load') return <div className="sh-center">Buscando tu pedido…</div>;
  if (st.e === '404') return <div className="sh-center sh-404"><h1>Pedido no encontrado</h1><p>Revisá el código.</p><a href={volver}>Ir a la tienda</a></div>;
  if (st.e === 'error') return <div className="sh-center">No se pudo cargar el pedido.</div>;

  const o = st.o;
  const pasos = ['NUEVO', 'CONFIRMADO', 'PREPARANDO', 'EN_CAMINO', 'ENTREGADO'];
  const idx = pasos.indexOf(o.estado);

  return (
    <div className="sh" style={style}>
      <header className="sh-top"><a className="sh-back" href={volver}>‹ Tienda</a></header>
      <div className="sh-track">
        <h2>Pedido #{o.numero}</h2>
        <p className="sh-track__code">Código {o.codigo}</p>

        {o.estado === 'CANCELADO' ? (
          <p className="sh-err">Este pedido fue cancelado.</p>
        ) : (
          <ol className="sh-steps">
            {pasos.map((p, i) => (
              <li key={p} className={i <= idx ? 'is-done' : ''}>{ESTADO_LABEL[p]}</li>
            ))}
          </ol>
        )}

        <div className="sh-summary">
          {o.items.map((it, i) => (
            <div className="sh-sumrow" key={i}>
              <span>{it.concepto} <em>{it.esPesable ? `${it.cantidad.toFixed(3)} kg` : `×${it.cantidad}`}</em></span>
              <span>{formatMoney(it.subtotal)}</span>
            </div>
          ))}
        </div>
        <div className="sh-totals">
          <div><span>Subtotal</span><span>{formatMoney(o.subtotal)}</span></div>
          {o.tipoEntrega === 'DELIVERY' && <div><span>Envío{o.zonaNombre ? ` · ${o.zonaNombre}` : ''}</span><span>{formatMoney(o.costoEnvio)}</span></div>}
          <div className="sh-totals__big"><span>Total</span><span>{formatMoney(o.total)}</span></div>
        </div>
        <p className="sh-note">
          {o.tipoEntrega === 'DELIVERY' ? `Envío a: ${o.direccion ?? ''}` : 'Retiro en el local'}
          {o.franja ? ` · ${o.franja}` : ''}
        </p>
      </div>
    </div>
  );
}

// --- Confirmación ------------------------------------------------------------

function Confirmation({ order, slug, onMore }: { order: OrderResult; slug: string; onMore: () => void }) {
  return (
    <div className="sh-done">
      <div className="sh-done__check">✓</div>
      <h2>¡Pedido recibido!</h2>
      <p>Tu pedido <strong>#{order.numero}</strong> quedó registrado. Te vamos a contactar para coordinar la entrega.</p>
      <div className="sh-code">
        <span>Código de seguimiento</span>
        <strong>{order.codigo}</strong>
      </div>
      <p className="sh-done__total">Total {formatMoney(order.total)} · se paga al recibir</p>
      <div className="sh-done__actions">
        <a className="sh-btn" href={`/v/${encodeURIComponent(slug)}/tienda?codigo=${order.codigo}`}>Ver estado</a>
        <button className="sh-btn sh-btn--primary" onClick={onMore}>Hacer otro pedido</button>
      </div>
    </div>
  );
}
