import { useEffect, useState } from 'react';
import { CONSOLE_URL, secretLogin } from '../lib/secretLogin';
import { getPlanes, type PublicPlan } from '../lib/api';
import {
  BENEFICIOS, FAQ, HAY_WHATSAPP, MODULOS, NAV, PAGOS, PASOS, PROBLEMAS,
  SEGURIDAD, TESTIMONIOS, TRUST, WA_MSG_DEMO, WA_MSG_PLAN, waLink,
} from '../lib/landing';
import {
  AnalyticsMock, DashboardMock, PosMock, ProductsMock, StockMock,
} from './landing/mockups';
import { DemoModal } from './landing/DemoModal';

const MODULO_LABEL: Record<string, string> = {
  POS: 'Punto de venta offline',
  INVENTORY: 'Stock y mermas',
  PURCHASES: 'Compras y costos',
  PRICING: 'Listas de precios y remarque masivo',
  REPORTS_ADVANCED: 'Reportes avanzados y rentabilidad',
  WHOLESALE: 'Mayoristas y cuenta corriente',
  DELIVERY: 'Tienda online y reparto',
  MULTI_SUCURSAL: 'Multi-sucursal',
  SCALE_LIVE: 'Balanza en vivo',
  CFE: 'Facturación electrónica',
};

const money = (n: number) => `$${n.toLocaleString('es-UY')}`;

function limitesTexto(p: PublicPlan): string {
  return [
    p.maxUsuarios ? `${p.maxUsuarios} usuarios` : 'Usuarios ilimitados',
    p.maxSucursales ? `${p.maxSucursales} sucursal${p.maxSucursales === 1 ? '' : 'es'}` : 'Multi-sucursal',
    p.maxProductos ? `${p.maxProductos.toLocaleString('es-UY')} productos` : 'Productos ilimitados',
  ].join(' · ');
}

/** Aparición progresiva (fade/slide) discreta al hacer scroll. */
function useReveal(dep: unknown) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal:not(.is-in)'));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => io.observe(el));
    const safety = window.setTimeout(() => els.forEach((el) => el.classList.add('is-in')), 1400);
    return () => { io.disconnect(); window.clearTimeout(safety); };
  }, [dep]);
}

export function AragonLanding() {
  const [planes, setPlanes] = useState<PublicPlan[] | null>(null);
  const [menu, setMenu] = useState(false);
  const [demo, setDemo] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  useEffect(() => { getPlanes().then(setPlanes).catch(() => setPlanes([])); }, []);
  useReveal(planes);

  const abrirDemo = () => setDemo(true);
  const cerrarMenu = () => setMenu(false);
  const planCTA = HAY_WHATSAPP ? waLink(WA_MSG_PLAN) : undefined;

  return (
    <div className="ar">
      {/* NAVBAR */}
      <header className="site">
        <div className="wrap nav">
          <div className="brand" onClick={secretLogin(CONSOLE_URL)} title="Aragon Verdulería">
            <div className="brand__mark">A</div>
            <div className="brand__name">Aragon Verdulería<small>Software para verdulerías</small></div>
          </div>
          <nav className={`nav__links ${menu ? 'is-open' : ''}`}>
            {NAV.map((n) => <a key={n.href} href={n.href} onClick={cerrarMenu}>{n.label}</a>)}
            <button className="btn btn--primary nav__cta-m" onClick={() => { cerrarMenu(); abrirDemo(); }}>Probar demo</button>
          </nav>
          <div className="nav__right">
            <button className="btn btn--primary btn--sm" onClick={abrirDemo}>Probar demo</button>
            <button className="nav__burger" onClick={() => setMenu((v) => !v)} aria-label="Menú" aria-expanded={menu}>
              {menu ? '×' : '☰'}
            </button>
          </div>
        </div>
        {menu && <div className="nav__scrim" onClick={cerrarMenu} />}
      </header>

      {/* HERO */}
      <section className="hero">
        <div className="wrap hero__grid">
          <div className="reveal is-in">
            <p className="eyebrow">Software para verdulerías · Uruguay 🇺🇾</p>
            <h1>Gestioná tu verdulería de forma <em>simple, rápida y profesional.</em></h1>
            <p className="hero__sub">Controlá ventas, stock, compras, caja y facturación desde un solo lugar. Un sistema hecho para cómo trabaja una verdulería de verdad.</p>
            <div className="hero__cta">
              <button className="btn btn--primary btn--lg" onClick={abrirDemo}>Probar demo</button>
              <a href="#como" className="btn btn--ghost btn--lg btn--onhero">Ver cómo funciona</a>
            </div>
            <p className="hero__trustline">Sin instalaciones complicadas · Desde cualquier dispositivo · Tus datos siempre disponibles</p>
          </div>
          <div className="reveal is-in hero__visual" style={{ animationDelay: '.1s' }}>
            <DashboardMock />
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <div className="trustbar">
        <div className="wrap trustbar__in">
          <span className="trustbar__lead">Todo lo que necesitás para administrar tu verdulería</span>
          <div className="trustbar__chips">
            {TRUST.map((t) => <span key={t.label} className="trustbar__chip">{t.icon} {t.label}</span>)}
          </div>
        </div>
      </div>

      {/* PROBLEMAS */}
      <section id="problemas">
        <div className="wrap">
          <div className="sec-head reveal">
            <p className="sec-eyebrow">El día a día</p>
            <h2>¿Todavía administrás tu verdulería así?</h2>
            <p>Si te suena alguno de estos, hay una forma más simple.</p>
          </div>
          <div className="grid grid--4 reveal">
            {PROBLEMAS.map((p) => (
              <div className="pain" key={p.text}><span className="pain__ic">{p.icon}</span><p>{p.text}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUCIÓN */}
      <section id="solucion" style={{ background: 'var(--surface-2)' }}>
        <div className="wrap sol">
          <div className="sol__txt reveal">
            <p className="sec-eyebrow">La solución</p>
            <h2>Todo tu negocio, en un solo lugar.</h2>
            <p>Dejá el cuaderno, el Excel y los mensajes sueltos. El sistema conecta ventas, stock, compras, caja y reportes: cargás una vez y todo se actualiza solo.</p>
            <ul className="sol__list">
              <li><span className="check">✓</span> Una sola fuente de información, siempre al día.</li>
              <li><span className="check">✓</span> Menos tareas manuales y menos errores.</li>
              <li><span className="check">✓</span> Sabés qué vendés, cuánto tenés y cuánto ganás.</li>
            </ul>
            <button className="btn btn--primary" onClick={abrirDemo}>Ver la demo</button>
          </div>
          <div className="sol__vis reveal"><DashboardMock /></div>
        </div>
      </section>

      {/* FUNCIONALIDADES */}
      <section id="funcionalidades">
        <div className="wrap">
          <div className="sec-head reveal">
            <p className="sec-eyebrow">Funcionalidades</p>
            <h2>Todo lo que hace el sistema.</h2>
            <p>Cada módulo resuelve un problema concreto de tu verdulería.</p>
          </div>
          <div className="grid grid--3 reveal">
            {MODULOS.map((m) => (
              <div className="card" key={m.nombre}>
                <div className="card__ic">{m.icon}</div>
                <h3>{m.nombre}</h3>
                <p>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SHOWCASE: PRODUCTOS */}
      <ShowcaseRow
        id="productos" alt eyebrow="Productos" titulo="Un catálogo pensado para frescos."
        texto="Cargás cada producto con su precio de compra y de venta, su categoría y su unidad. El sistema entiende que vendés por kilo, por unidad, por cajón, por bolsa o por paquete."
        puntos={['Precio de compra y de venta', 'Por kilo, unidad, cajón o bolsa', 'PLU de balanza y código de barras', 'IVA y estado por producto']}
        visual={<ProductsMock />}
      />

      {/* SHOWCASE: STOCK */}
      <ShowcaseRow
        id="stock" eyebrow="Stock" titulo="Reducí pérdidas antes de que sea tarde."
        texto="Sabé en todo momento qué tenés y qué necesita reposición. Con stock mínimo, alertas, ajustes e historial, y control de vencimientos para los productos perecederos."
        puntos={['Stock actual y mínimo', 'Alertas de bajo stock y quiebre', 'Entradas, salidas y ajustes', 'Control de vencimientos']}
        visual={<StockMock />} flip
      />

      {/* SHOWCASE: VENTAS + CAJA */}
      <ShowcaseRow
        id="ventas" alt eyebrow="Ventas y caja" titulo="Cobrá rápido, con o sin internet."
        texto="Un punto de venta simple para el mostrador: agregás productos, aplicás descuentos y cobrás en efectivo, tarjeta o Mercado Pago. Al cierre, el arqueo te marca la diferencia."
        puntos={['Venta por peso y por unidad', 'Efectivo, tarjeta y Mercado Pago', 'Funciona offline y sincroniza solo', 'Caja y arqueo por turno']}
        visual={<PosMock />}
      />

      {/* FACTURACIÓN */}
      <section id="facturacion">
        <div className="wrap sol">
          <div className="sol__txt reveal">
            <p className="sec-eyebrow">Facturación</p>
            <h2>Facturación electrónica, integrada.</h2>
            <p>Centralizá tus ventas y comprobantes en el mismo sistema. Preparado para emitir comprobantes fiscales electrónicos (CFE) integrados con la DGI, según tu régimen.</p>
            <ul className="sol__list">
              <li><span className="check">✓</span> e-Ticket y comprobantes desde el POS</li>
              <li><span className="check">✓</span> Según tu régimen (el Monotributo entrega ticket interno)</li>
              <li><span className="check">✓</span> Todo queda registrado y ordenado</li>
            </ul>
          </div>
          <div className="sol__vis reveal">
            <div className="mk mk-cfe">
              <div className="mk-cfe__head"><strong>Verdulería Demo</strong><span>e-Ticket 101</span></div>
              <div className="mk-cfe__row"><span>Banana 1.240 kg</span><span>{money(98)}</span></div>
              <div className="mk-cfe__row"><span>Tomate 0.850 kg</span><span>{money(67)}</span></div>
              <div className="mk-cfe__row"><span>Lechuga 2 un</span><span>{money(70)}</span></div>
              <div className="mk-cfe__total"><span>TOTAL</span><span>{money(235)}</span></div>
              <div className="mk-cfe__stamp">✓ CFE aceptado por DGI</div>
            </div>
          </div>
        </div>
      </section>

      {/* REPORTES */}
      <ShowcaseRow
        id="reportes" alt eyebrow="Reportes" titulo="Números claros para decidir mejor."
        texto="Ventas por día y por período, productos más vendidos, márgenes y evolución. La información justa para saber qué comprar, qué remarcar y qué te deja ganancia."
        puntos={['Ventas por día y período', 'Productos más vendidos', 'Margen y rentabilidad', 'Por sucursal']}
        visual={<AnalyticsMock />} flip
      />

      {/* PAGOS */}
      <section id="pagos">
        <div className="wrap">
          <div className="sec-head reveal">
            <p className="sec-eyebrow">Pagos</p>
            <h2>Cobrá como te queda cómodo.</h2>
            <p>Efectivo, tarjeta y Mercado Pago, online y en el mostrador. Vamos sumando más pasarelas.</p>
          </div>
          <div className="pays reveal">
            {PAGOS.map((p) => (
              <div className={`pay ${p.estado === 'Integrado' ? 'pay--on' : ''}`} key={p.nombre}>
                <span className="pay__nom">{p.nombre}</span>
                <span className={`pay__state ${p.estado === 'Integrado' ? 'is-on' : 'is-soon'}`}>{p.estado}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como" style={{ background: 'var(--surface-2)' }}>
        <div className="wrap">
          <div className="sec-head reveal">
            <p className="sec-eyebrow">Cómo funciona</p>
            <h2>Empezar es simple.</h2>
          </div>
          <div className="steps reveal">
            {PASOS.map((s) => (
              <div className="stepc" key={s.n}>
                <span className="stepc__n">{s.n}</span>
                <h3>{s.titulo}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFICIOS */}
      <section id="beneficios">
        <div className="wrap">
          <div className="sec-head reveal">
            <p className="sec-eyebrow">Beneficios</p>
            <h2>Más control. Menos trabajo.</h2>
          </div>
          <div className="grid grid--3 reveal">
            {BENEFICIOS.map((b) => (
              <div className="benf" key={b.titulo}><span className="benf__ic">{b.icon}</span><h3>{b.titulo}</h3><p>{b.desc}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* MULTIDISPOSITIVO */}
      <section id="dispositivos" style={{ background: 'var(--surface-2)' }}>
        <div className="wrap sol">
          <div className="sol__txt reveal">
            <p className="sec-eyebrow">Multidispositivo</p>
            <h2>Tu negocio no se detiene. Tu sistema tampoco.</h2>
            <p>Usalo en la computadora del mostrador, en la tablet o en el celular. El punto de venta trabaja aunque se caiga internet, y todo se sincroniza cuando vuelve.</p>
            <div className="devs">
              <span>💻 PC</span><span>💻 Laptop</span><span>📱 Tablet</span><span>📲 Celular</span>
            </div>
          </div>
          <div className="sol__vis reveal"><DashboardMock /></div>
        </div>
      </section>

      {/* SEGURIDAD */}
      <section id="seguridad">
        <div className="wrap">
          <div className="sec-head reveal">
            <p className="sec-eyebrow">Confianza</p>
            <h2>Tus datos, protegidos y disponibles.</h2>
          </div>
          <div className="grid grid--4 reveal">
            {SEGURIDAD.map((s) => (
              <div className="card" key={s.titulo}><div className="card__ic">{s.icon}</div><h3>{s.titulo}</h3><p>{s.desc}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIOS */}
      <section id="testimonios" style={{ background: 'var(--surface-2)' }}>
        <div className="wrap">
          <div className="sec-head reveal">
            <p className="sec-eyebrow">Testimonios</p>
            <h2>Lo que buscan los comercios como el tuyo.</h2>
            <p>Estamos sumando nuestros primeros clientes. Estos son ejemplos de clientes piloto.</p>
          </div>
          <div className="grid grid--3 reveal">
            {TESTIMONIOS.map((t, i) => (
              <div className="tsti" key={i}>
                <p className="tsti__q">“{t.quote}”</p>
                <div className="tsti__by"><span className="tsti__av">🧑‍🌾</span><div><b>Cliente piloto</b><small>{t.rubro}</small></div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRECIOS */}
      <section id="planes">
        <div className="wrap">
          <div className="sec-head reveal">
            <p className="sec-eyebrow">Planes</p>
            <h2>Elegí el plan de tu verdulería.</h2>
            <p>Precios en pesos uruguayos, por mes. Sin permanencia.</p>
          </div>
          {planes === null ? (
            <p className="plans-msg">Cargando planes…</p>
          ) : planes.length === 0 ? (
            <p className="plans-msg">Escribinos y armamos el plan para tu verdulería.</p>
          ) : (
            <div className="plans reveal">
              {planes.map((p, i) => {
                const destacado = planes.length >= 3 ? i === 1 : i === 0;
                return (
                  <div key={p.code} className={`plan ${destacado ? 'plan--hot' : ''}`}>
                    {destacado && <span className="plan__flag">El más elegido</span>}
                    <div className="plan__name">{p.nombre}</div>
                    <div className="plan__price">{money(p.precioMensual)}<small> /mes</small></div>
                    {p.descripcion && <p className="plan__desc">{p.descripcion}</p>}
                    <ul>
                      {p.modules.map((m) => <li key={m}><span className="check">✓</span>{MODULO_LABEL[m] ?? m}</li>)}
                      <li><span className="check">✓</span>{limitesTexto(p)}</li>
                    </ul>
                    {planCTA
                      ? <a href={planCTA} target="_blank" rel="noopener noreferrer" className={`btn ${destacado ? 'btn--primary' : 'btn--ghost'}`}>Comenzar ahora</a>
                      : <button className={`btn ${destacado ? 'btn--primary' : 'btn--ghost'}`} onClick={abrirDemo}>Comenzar ahora</button>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="plans-notas reveal">
            <span>🧾 <b>Facturación electrónica (CFE)</b>: se agrega como add-on según tu facturación (el Monotributo está exento).</span>
            <span>🎉 <b>Fundadores de Maldonado</b>: 50% de descuento durante el primer año para los primeros clientes.</span>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ background: 'var(--surface-2)' }}>
        <div className="wrap wrap--narrow">
          <div className="sec-head reveal">
            <p className="sec-eyebrow">Preguntas frecuentes</p>
            <h2>Lo que solés preguntar.</h2>
          </div>
          <div className="faq reveal">
            {FAQ.map((f, i) => {
              const open = faqOpen === i;
              return (
                <div className={`faq__i ${open ? 'is-open' : ''}`} key={i}>
                  <button className="faq__q" onClick={() => setFaqOpen(open ? null : i)} aria-expanded={open}>
                    <span>{f.q}</span><span className="faq__chev">{open ? '−' : '+'}</span>
                  </button>
                  {open && <p className="faq__a">{f.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section>
        <div className="wrap">
          <div className="cta reveal" id="contacto">
            <h2>Dejá de administrar tu verdulería <em>a ciegas.</em></h2>
            <p>Empezá a tener el control de tu negocio desde un solo lugar.</p>
            <div className="cta__btns">
              <button className="btn btn--primary btn--lg" onClick={abrirDemo}>Probar demo</button>
              {HAY_WHATSAPP && (
                <a href={waLink(WA_MSG_DEMO)} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--lg btn--onhero">💬 Hablar por WhatsApp</a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="ar-foot">
        <div className="wrap foot">
          <div className="foot__col foot__brand">
            <div className="brand" onClick={secretLogin(CONSOLE_URL)}>
              <div className="brand__mark">A</div>
              <div className="brand__name">Aragon Verdulería<small>Aragon Tech Solutions · Uruguay 🇺🇾</small></div>
            </div>
            <p className="foot__desc">El sistema de gestión hecho para verdulerías, fruterías y comercios de frutas y verduras.</p>
          </div>
          <div className="foot__col">
            <h4>Producto</h4>
            <a href="#funcionalidades">Funcionalidades</a>
            <a href="#planes">Precios</a>
            <a href="#faq">Preguntas frecuentes</a>
            <button className="foot__link" onClick={abrirDemo}>Probar demo</button>
          </div>
          <div className="foot__col">
            <h4>Empresa</h4>
            <a href="#solucion">Sobre el producto</a>
            <a href="#contacto">Contacto</a>
          </div>
          <div className="foot__col">
            <h4>Contacto</h4>
            {HAY_WHATSAPP
              ? <a href={waLink(WA_MSG_DEMO)} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
              : <a href="#contacto">Contacto</a>}
          </div>
        </div>
        <div className="wrap foot__legal">
          <span>© {new Date().getFullYear()} Aragon Tech Solutions</span>
          <span>POS · Gestión · Facturación electrónica · Hecho para verdulerías 🇺🇾</span>
        </div>
      </footer>

      {/* CTA móvil fija */}
      <div className="mobilecta">
        <a href="#planes" className="btn btn--ghost">Ver planes</a>
        <button className="btn btn--primary" onClick={abrirDemo}>Probar demo</button>
      </div>

      {/* WhatsApp flotante */}
      {HAY_WHATSAPP && (
        <a className="wafab" href={waLink(WA_MSG_DEMO)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">💬</a>
      )}

      {demo && <DemoModal onClose={() => setDemo(false)} />}
    </div>
  );
}

/** Fila de showcase: texto + puntos a un lado y un mockup al otro. */
function ShowcaseRow({
  id, eyebrow, titulo, texto, puntos, visual, alt, flip,
}: {
  id: string; eyebrow: string; titulo: string; texto: string; puntos: string[];
  visual: React.ReactNode; alt?: boolean; flip?: boolean;
}) {
  return (
    <section id={id} style={alt ? { background: 'var(--surface-2)' } : undefined}>
      <div className={`wrap sol ${flip ? 'sol--flip' : ''}`}>
        <div className="sol__txt reveal">
          <p className="sec-eyebrow">{eyebrow}</p>
          <h2>{titulo}</h2>
          <p>{texto}</p>
          <ul className="sol__list">
            {puntos.map((p) => <li key={p}><span className="check">✓</span> {p}</li>)}
          </ul>
        </div>
        <div className="sol__vis reveal">{visual}</div>
      </div>
    </section>
  );
}
