import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  addAddress,
  createOrder,
  deleteAddress,
  getAccount,
  getMyOrders,
  getOrder,
  getStoreCatalog,
  loginCustomer,
  NotFoundError,
  registerCustomer,
  type AccountView,
  type CreateOrderInput,
  type CustomerAddress,
  type MyOrder,
  type OrderResult,
  type OrderView,
  type StoreCatalog,
  type StoreCustomer,
  type StoreProduct,
  type TipoEntrega,
} from '../lib/api';
import { esPeso, formatMoney, unidadCorta } from '../lib/format';

export interface Session {
  token: string;
  customer: StoreCustomer;
  direcciones: CustomerAddress[];
}

function tokenKey(slug: string) { return `ats.store.token.${slug}`; }
function loadToken(slug: string): string | null {
  try { return localStorage.getItem(tokenKey(slug)); } catch { return null; }
}
function saveToken(slug: string, token: string | null) {
  try { if (token) localStorage.setItem(tokenKey(slug), token); else localStorage.removeItem(tokenKey(slug)); } catch { /* noop */ }
}

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
  const [session, setSession] = useState<Session | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let vivo = true;
    getStoreCatalog(slug)
      .then((data) => vivo && setS({ e: 'ok', data }))
      .catch((err) => vivo && setS({ e: err instanceof NotFoundError ? '404' : 'error' }));
    return () => { vivo = false; };
  }, [slug]);

  // Sesión del cliente: si hay token guardado, recupera la cuenta.
  useEffect(() => {
    const token = loadToken(slug);
    if (!token) return;
    let vivo = true;
    getAccount(slug, token)
      .then((acc) => { if (vivo) setSession({ token, customer: acc.customer, direcciones: acc.direcciones }); })
      .catch(() => { saveToken(slug, null); });
    return () => { vivo = false; };
  }, [slug]);

  useEffect(() => { if (s.e === 'ok') document.title = `${s.data.nombre} · Tienda`; }, [s]);

  const style = useMemo(() => ({ '--sh-accent': ACCENT }) as CSSProperties, []);

  // Seguimiento de un pedido por código (?codigo=XXXX).
  const trackCodigo = new URLSearchParams(window.location.search).get('codigo');
  if (trackCodigo) return <TrackView slug={slug} codigo={trackCodigo} />;

  if (s.e === 'load') return <StoreSkeleton />;
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
    const res = await createOrder(slug, input, session?.token);
    setOrder(res);
    setQty({});
    setStep('done');
    // Si guardó una dirección o sumó puntos, refrescamos la cuenta.
    if (session) getAccount(slug, session.token).then((acc) => setSession({ token: session.token, customer: acc.customer, direcciones: acc.direcciones })).catch(() => {});
  }

  function onAuthed(token: string, customer: StoreCustomer) {
    saveToken(slug, token);
    setAuthOpen(false);
    getAccount(slug, token)
      .then((acc) => setSession({ token, customer: acc.customer, direcciones: acc.direcciones }))
      .catch(() => setSession({ token, customer, direcciones: [] }));
  }

  function logout() {
    saveToken(slug, null);
    setSession(null);
    setOrdersOpen(false);
  }

  return (
    <div className="sh" style={style}>
      <header className="sh-top">
        <a className="sh-back" href={`/v/${encodeURIComponent(slug)}`} aria-label="Volver">‹</a>
        <span className="sh-top__name">{cat.nombre}</span>
        <div className="sh-top__right">
          {session ? (
            <button className="sh-acct" onClick={() => setOrdersOpen(true)} title="Mi cuenta">
              👤 {session.customer.nombre.split(' ')[0]} <span className="sh-acct__pts">⭐{session.customer.puntos}</span>
            </button>
          ) : (
            <button className="sh-acct" onClick={() => setAuthOpen(true)}>Ingresar</button>
          )}
        </div>
      </header>

      {step === 'shop' && (
        <ShopView
          cat={cat} qty={qty} setQ={setQ}
          catFilter={catFilter} setCatFilter={setCatFilter}
          search={search} setSearch={setSearch}
        />
      )}
      {step === 'shop' && cartCount > 0 && (
        <div className="sh-bar">
          <button className="sh-bar__btn" onClick={() => setStep('checkout')}>
            <span className="sh-bar__count">{cartCount}</span>
            <span>Ver pedido</span>
            <span className="sh-bar__total">{formatMoney(subtotal)}</span>
          </button>
        </div>
      )}

      {step === 'checkout' && (
        <CheckoutView cat={cat} lines={lines} subtotal={subtotal} session={session} onBack={() => setStep('shop')} onConfirm={confirmar} />
      )}

      {step === 'done' && order && (
        <Confirmation order={order} slug={slug} onMore={() => { setOrder(null); setStep('shop'); }} />
      )}

      {authOpen && <AuthModal slug={slug} onClose={() => setAuthOpen(false)} onAuthed={onAuthed} />}
      {ordersOpen && session && (
        <AccountModal slug={slug} session={session} onClose={() => setOrdersOpen(false)} onLogout={logout} />
      )}
    </div>
  );
}

// --- Catálogo ----------------------------------------------------------------

// Normaliza para buscar sin acentos ni mayúsculas.
const norm = (s: string) =>
  [...s.normalize('NFD')].filter((ch) => { const c = ch.codePointAt(0)!; return c < 0x300 || c > 0x36f; }).join('').toLowerCase();

function ShopView({
  cat, qty, setQ, catFilter, setCatFilter, search, setSearch,
}: {
  cat: StoreCatalog;
  qty: Record<string, number>;
  setQ: (id: string, n: number) => void;
  catFilter: string | null;
  setCatFilter: (id: string | null) => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  const q = norm(search.trim());
  const productos = cat.productos.filter((p) => {
    if (catFilter && p.categoriaId !== catFilter) return false;
    if (q && !(norm(p.nombre).includes(q) || (p.descripcionOnline && norm(p.descripcionOnline).includes(q)))) return false;
    return true;
  });

  return (
    <>
      <div className="sh-search">
        <span className="sh-search__ic" aria-hidden>🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar productos…"
          inputMode="search"
        />
        {search && <button className="sh-search__x" onClick={() => setSearch('')} aria-label="Limpiar">×</button>}
      </div>

      <InfoStrip cat={cat} />

      {cat.categorias.length > 1 && !q && (
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
      {productos.length === 0 && (
        <div className="sh-empty">
          <div className="sh-empty__ic">{q ? '🔍' : '🥬'}</div>
          <p>{q ? `Nada para “${search.trim()}”.` : 'No hay productos en esta categoría.'}</p>
          {q && <button className="sh-btn" onClick={() => setSearch('')}>Ver todo</button>}
        </div>
      )}
    </>
  );
}

function InfoStrip({ cat }: { cat: StoreCatalog }) {
  const zonas = cat.zonas;
  const items: string[] = [];
  if (cat.config.deliveryActivo && zonas.length) {
    const envioMin = Math.min(...zonas.map((z) => z.costoEnvio));
    items.push(envioMin > 0 ? `🛵 Envío desde ${formatMoney(envioMin)}` : '🛵 Envío gratis');
    const minPed = Math.min(...zonas.map((z) => z.pedidoMinimo).filter((m) => m > 0));
    if (Number.isFinite(minPed)) items.push(`Mínimo ${formatMoney(minPed)}`);
  }
  if (cat.config.pickupActivo) items.push('🏪 Retiro en el local');
  items.push('💵 Pagás al recibir');
  if (cat.config.franjas.length) items.push(`⏰ ${cat.config.franjas.length} franjas`);

  return (
    <div className="sh-info">
      {items.map((t, i) => <span className="sh-info__i" key={i}>{t}</span>)}
    </div>
  );
}

function ProductCard({ p, cantidad, setQ }: { p: StoreProduct; cantidad: number; setQ: (id: string, n: number) => void }) {
  const peso = esPeso(p.unidadVenta);
  const paso = peso ? 0.25 : 1;
  const enCarrito = cantidad > 0;

  return (
    <div className={`sh-card ${!p.disponible ? 'is-out' : ''} ${enCarrito ? 'is-in' : ''}`}>
      <div className="sh-card__img" style={p.imagenUrl ? { backgroundImage: `url(${p.imagenUrl})` } : undefined}>
        {!p.imagenUrl && <span className="sh-card__ph">🥬</span>}
        {!p.disponible && <span className="sh-card__out">Sin stock</span>}

        {/* Control de compra flotante sobre la foto (patrón quick-commerce). */}
        {p.disponible && (
          enCarrito ? (
            <div className="sh-qty">
              <button onClick={() => setQ(p.id, cantidad - paso)} aria-label="Quitar">−</button>
              <span>{peso ? `${cantidad.toFixed(3)}` : cantidad}<em>{peso ? 'kg' : ''}</em></span>
              <button onClick={() => setQ(p.id, cantidad + paso)} aria-label="Agregar">+</button>
            </div>
          ) : (
            <button className="sh-plus" onClick={() => setQ(p.id, 1)} aria-label={`Agregar ${p.nombre}`}>+</button>
          )
        )}
      </div>
      <div className="sh-card__body">
        <strong className="sh-card__name">{p.nombre}</strong>
        {p.descripcionOnline && <p className="sh-card__desc">{p.descripcionOnline}</p>}
        <div className="sh-card__foot">
          <span className="sh-card__price">{formatMoney(p.precio)}<span>/{unidadCorta(p.unidadVenta)}</span></span>
          {enCarrito && <span className="sh-card__sub">{formatMoney(p.precio * cantidad)}{peso ? '~' : ''}</span>}
        </div>
      </div>
    </div>
  );
}

function StoreSkeleton() {
  return (
    <div className="sh">
      <header className="sh-top"><span className="sk sk-line" style={{ width: 120 }} /></header>
      <div className="sh-search"><span className="sk sk-line" style={{ width: '100%', height: 20 }} /></div>
      <div className="sh-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div className="sh-card" key={i}>
            <div className="sh-card__img sk" />
            <div className="sh-card__body">
              <span className="sk sk-line" style={{ width: '80%' }} />
              <span className="sk sk-line" style={{ width: '40%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Checkout ----------------------------------------------------------------

function CheckoutView({
  cat, lines, subtotal, session, onBack, onConfirm,
}: {
  cat: StoreCatalog;
  lines: Array<{ product: StoreProduct; cantidad: number }>;
  subtotal: number;
  session: Session | null;
  onBack: () => void;
  onConfirm: (input: CreateOrderInput) => Promise<void>;
}) {
  const puedeDelivery = cat.config.deliveryActivo && cat.zonas.length > 0;
  const puedePickup = cat.config.pickupActivo;
  const [tipo, setTipo] = useState<TipoEntrega>(puedeDelivery ? 'DELIVERY' : 'PICKUP');
  const [zonaId, setZonaId] = useState(cat.zonas[0]?.id ?? '');
  const [franja, setFranja] = useState(cat.config.franjas[0] ?? '');
  const [nombre, setNombre] = useState(session?.customer.nombre ?? '');
  const [telefono, setTelefono] = useState(session?.customer.telefono ?? '');
  // Dirección: elegir una guardada o escribir una nueva.
  const dirs = session?.direcciones ?? [];
  const [dirSel, setDirSel] = useState<string>(dirs[0]?.id ?? 'nueva');
  const [direccion, setDireccion] = useState(dirs[0]?.direccion ?? '');
  const [guardarDir, setGuardarDir] = useState(false);
  const [notas, setNotas] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const usaGuardada = !!session && dirSel !== 'nueva';
  const direccionFinal = usaGuardada ? (dirs.find((d) => d.id === dirSel)?.direccion ?? '') : direccion;

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
        direccion: tipo === 'DELIVERY' ? direccionFinal.trim() : undefined,
        notas: notas.trim() || undefined,
        guardarDireccion: !!session && tipo === 'DELIVERY' && !usaGuardada && guardarDir,
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
          {dirs.length > 0 && (
            <label className="sh-field">Dirección guardada
              <select value={dirSel} onChange={(e) => setDirSel(e.target.value)}>
                {dirs.map((d) => <option key={d.id} value={d.id}>{d.etiqueta}: {d.direccion}</option>)}
                <option value="nueva">Otra dirección…</option>
              </select>
            </label>
          )}
          {!usaGuardada && (
            <>
              <label className="sh-field">Dirección
                <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, número, apto, referencias" required />
              </label>
              {session && (
                <label className="sh-check">
                  <input type="checkbox" checked={guardarDir} onChange={(e) => setGuardarDir(e.target.checked)} />
                  Guardar esta dirección en mi cuenta
                </label>
              )}
            </>
          )}
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

// --- Cuenta del cliente ------------------------------------------------------

function AuthModal({ slug, onClose, onAuthed }: { slug: string; onClose: () => void; onAuthed: (token: string, c: StoreCustomer) => void }) {
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const r = modo === 'login'
        ? await loginCustomer(slug, { email: email.trim(), password })
        : await registerCustomer(slug, { nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim() || undefined, password });
      onAuthed(r.token, r.customer);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'No se pudo continuar.');
      setBusy(false);
    }
  }

  return (
    <div className="sh-modal-bg" onClick={onClose}>
      <form className="sh-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="sh-seg">
          <button type="button" className={modo === 'login' ? 'is-on' : ''} onClick={() => setModo('login')}>Ingresar</button>
          <button type="button" className={modo === 'registro' ? 'is-on' : ''} onClick={() => setModo('registro')}>Crear cuenta</button>
        </div>
        <p className="sh-note">Con tu cuenta guardás tus direcciones, ves tus pedidos y sumás puntos.</p>
        {modo === 'registro' && (
          <>
            <label className="sh-field">Nombre
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} />
            </label>
            <label className="sh-field">Teléfono
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" />
            </label>
          </>
        )}
        <label className="sh-field">Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="sh-field">Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </label>
        {err && <p className="sh-err">{err}</p>}
        <button className="sh-btn sh-btn--primary sh-btn--full" type="submit" disabled={busy}>
          {busy ? 'Un momento…' : modo === 'login' ? 'Ingresar' : 'Crear cuenta'}
        </button>
        <button type="button" className="sh-linkback" onClick={onClose} style={{ marginTop: 8 }}>Cancelar</button>
      </form>
    </div>
  );
}

function AccountModal({ slug, session, onClose, onLogout }: { slug: string; session: Session; onClose: () => void; onLogout: () => void }) {
  const [acc, setAcc] = useState<AccountView>({ customer: session.customer, direcciones: session.direcciones });
  const [pedidos, setPedidos] = useState<MyOrder[] | null>(null);
  const [nuevaDir, setNuevaDir] = useState('');
  const [etiqueta, setEtiqueta] = useState('Casa');

  useEffect(() => {
    getMyOrders(slug, session.token).then(setPedidos).catch(() => setPedidos([]));
  }, [slug, session.token]);

  async function agregar() {
    if (nuevaDir.trim().length < 3) return;
    try {
      const a = await addAddress(slug, session.token, { etiqueta: etiqueta.trim() || 'Casa', direccion: nuevaDir.trim() });
      setAcc(a); setNuevaDir('');
    } catch { /* noop */ }
  }
  async function quitar(id: string) {
    try { setAcc(await deleteAddress(slug, session.token, id)); } catch { /* noop */ }
  }

  return (
    <div className="sh-modal-bg" onClick={onClose}>
      <div className="sh-modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px' }}>Hola, {acc.customer.nombre.split(' ')[0]}</h3>
        <p className="sh-note">⭐ Tenés <strong>{acc.customer.puntos} puntos</strong>.</p>

        <h4 className="sh-acct__h">Mis direcciones</h4>
        {acc.direcciones.map((d) => (
          <div className="sh-sumrow" key={d.id}>
            <span><strong>{d.etiqueta}</strong> · {d.direccion}</span>
            <button className="sh-linkback" onClick={() => void quitar(d.id)}>Quitar</button>
          </div>
        ))}
        <div className="sh-addrow">
          <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="Etiqueta" style={{ maxWidth: 90 }} />
          <input value={nuevaDir} onChange={(e) => setNuevaDir(e.target.value)} placeholder="Nueva dirección" />
          <button className="sh-btn sh-btn--primary" onClick={() => void agregar()}>+</button>
        </div>

        <h4 className="sh-acct__h">Mis pedidos</h4>
        {pedidos === null ? <p className="sh-note">Cargando…</p>
          : pedidos.length === 0 ? <p className="sh-note">Todavía no hiciste pedidos.</p>
          : pedidos.map((o) => (
            <a className="sh-sumrow sh-orderlink" key={o.codigo} href={`/v/${encodeURIComponent(slug)}/tienda?codigo=${o.codigo}`}>
              <span>#{o.numero} · {ESTADO_LABEL[o.estado] ?? o.estado}</span>
              <span>{formatMoney(o.total)}</span>
            </a>
          ))}

        <div className="sh-done__actions" style={{ marginTop: 16 }}>
          <button className="sh-btn" onClick={onLogout}>Cerrar sesión</button>
          <button className="sh-btn sh-btn--primary" onClick={onClose}>Volver a comprar</button>
        </div>
      </div>
    </div>
  );
}
