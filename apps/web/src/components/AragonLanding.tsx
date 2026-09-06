import { useEffect, useState } from 'react';
import { CONSOLE_URL, secretLogin } from '../lib/secretLogin';
import { getPlanes, type PublicPlan } from '../lib/api';

/** Etiqueta amigable de cada módulo para la lista de features del plan. */
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
  const partes = [
    p.maxUsuarios ? `${p.maxUsuarios} usuarios` : 'Usuarios ilimitados',
    p.maxSucursales ? `${p.maxSucursales} sucursal${p.maxSucursales === 1 ? '' : 'es'}` : 'Multi-sucursal',
    p.maxProductos ? `${p.maxProductos.toLocaleString('es-UY')} productos` : 'Productos ilimitados',
  ];
  return partes.join(' · ');
}

/** Landing pública de Aragon (el SaaS). El acceso al login del dueño está
 *  oculto: Ctrl + Shift + click en el logo lleva a la Consola. */
export function AragonLanding() {
  const [planes, setPlanes] = useState<PublicPlan[] | null>(null);
  useEffect(() => {
    getPlanes().then(setPlanes).catch(() => setPlanes([]));
  }, []);

  return (
    <div className="ar">
      <header className="site">
        <div className="wrap nav">
          <div className="brand" onClick={secretLogin(CONSOLE_URL)}>
            <div className="brand__mark">A</div>
            <div className="brand__name">
              Aragon Verdulería<small>Aragon Tech Solutions</small>
            </div>
          </div>
          <nav className="nav__links">
            <a href="#porque">Por qué</a>
            <a href="#capacidades">Qué hace</a>
            <a href="#flujo">Cómo es</a>
            <a href="#planes">Planes</a>
          </nav>
          <a href="#planes" className="btn btn--primary">Pedir demo</a>
        </div>
      </header>

      <section className="hero">
        <div className="wrap hero__grid">
          <div className="reveal">
            <p className="eyebrow">Software para verdulerías · Uruguay</p>
            <h1>Vendé, pesá y facturá <em>sin frenar la fila.</em></h1>
            <p className="hero__sub">El sistema completo para tu verdulería: punto de venta que anda sin internet, control de compras y merma, y facturación electrónica en regla con la DGI. Del mostrador a la caja.</p>
            <div className="hero__cta">
              <a href="#planes" className="btn btn--primary btn--lg">Ver planes</a>
              <a href="#capacidades" className="btn btn--ghost btn--lg" style={{ color: 'var(--hero-ink)', borderColor: 'rgba(255,255,255,.28)' }}>Ver qué hace</a>
            </div>
            <div className="hero__stats">
              <span className="stat">⚖ <b>Peso variable</b> y balanza</span>
              <span className="stat">📴 Anda <b>sin internet</b></span>
              <span className="stat">🧾 <b>e-Ticket</b> DGI</span>
              <span className="stat">🏪 <b>Multi-sucursal</b></span>
            </div>
          </div>

          <div className="reveal" style={{ animationDelay: '.12s' }}>
            <div className="ticket" role="img" aria-label="Ejemplo de ticket de venta con facturación electrónica">
              <div className="ticket__head">
                <strong>Verdulería La Esquina</strong>
                <span>Av. Roosevelt 1234 · Maldonado</span>
              </div>
              <div className="ticket__row"><span>Banana <em className="qty">1.240 kg</em></span><span>98,00</span></div>
              <div className="ticket__row"><span>Tomate perita <em className="qty">0.850 kg</em></span><span>67,00</span></div>
              <div className="ticket__row"><span>Lechuga <em className="qty">2 un</em></span><span>70,00</span></div>
              <div className="ticket__row"><span>Papa bolsa <em className="qty">1 un</em></span><span>135,00</span></div>
              <div className="ticket__total"><span>TOTAL</span><span>$ 370,00</span></div>
              <div className="ticket__stamp">✓ CFE aceptado por DGI · e-Ticket 101</div>
            </div>
          </div>
        </div>
      </section>

      <section id="porque">
        <div className="wrap">
          <div className="sec-head">
            <p className="sec-eyebrow">Por qué elegirnos</p>
            <h2>Hecho para la verdulería, no un ERP genérico.</h2>
            <p>Cada decisión del sistema piensa en cómo trabaja una verdulería uruguaya de verdad.</p>
          </div>
          <div className="grid grid--3">
            <div className="card"><div className="card__ic">📴</div><h3>Anda sin internet</h3><p>El POS vende offline y sincroniza solo cuando vuelve la conexión. La fila nunca se frena por el WiFi.</p></div>
            <div className="card"><div className="card__ic">🧾</div><h3>DGI en regla</h3><p>Facturación electrónica (CFE) integrada: e-Ticket y e-Factura, Monotributo o régimen general. Sin planillas aparte.</p></div>
            <div className="card"><div className="card__ic">⚖</div><h3>Pesás como querés</h3><p>Ingreso manual, etiqueta con código de barras o balanza en vivo por USB/red. La que tengas, funciona.</p></div>
            <div className="card"><div className="card__ic">📉</div><h3>Costos y merma reales</h3><p>Cargás la compra del Mercado Modelo por cajón y el sistema calcula el costo por kilo con la merma. Sabés cuánto ganás.</p></div>
            <div className="card"><div className="card__ic">🏪</div><h3>Varias sucursales</h3><p>Stock y caja por local, transferencias entre sucursales y cuenta corriente de mayoristas. Todo en un lugar.</p></div>
            <div className="card"><div className="card__ic">🇺🇾</div><h3>Precio y soporte local</h3><p>Pensado y cobrado en Uruguay, con soporte que entiende tu rubro. Precio local, y crecés cuando tu verdulería crece.</p></div>
          </div>
        </div>
      </section>

      <section id="capacidades" style={{ background: 'var(--surface-2)' }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="sec-eyebrow">Todo lo que hace</p>
            <h2>Tres partes, un solo sistema.</h2>
            <p>Cada persona de tu negocio tiene su herramienta, conectadas de punta a punta.</p>
          </div>
          <div className="lanes">
            <div className="lane">
              <span className="lane__tag">Mostrador · Cajero</span>
              <h3>Punto de venta</h3>
              <ul>
                <li><span className="check">✓</span><span><b>Venta por peso</b> y por unidad, con código de peso variable.</span></li>
                <li><span className="check">✓</span><span><b>Offline-first</b>: vende y sincroniza sin depender de la conexión.</span></li>
                <li><span className="check">✓</span><span><b>e-Ticket</b> impreso o digital, aceptado por DGI.</span></li>
                <li><span className="check">✓</span><span><b>Caja y arqueo</b> por turno, con cierre y diferencia.</span></li>
              </ul>
            </div>
            <div className="lane">
              <span className="lane__tag">Trastienda · Dueño</span>
              <h3>Gestión</h3>
              <ul>
                <li><span className="check">✓</span><span><b>Compras y stock</b> con costo real por kilo y merma.</span></li>
                <li><span className="check">✓</span><span><b>Precios masivos</b>: remarcás todo con un click.</span></li>
                <li><span className="check">✓</span><span><b>Rentabilidad</b>: margen y ganancia por producto.</span></li>
                <li><span className="check">✓</span><span><b>Mayoristas</b> con cuenta corriente y cobranzas.</span></li>
              </ul>
            </div>
            <div className="lane">
              <span className="lane__tag">Plataforma · Aragon</span>
              <h3>Consola</h3>
              <ul>
                <li><span className="check">✓</span><span><b>Alta en minutos</b>: tu verdulería lista para vender.</span></li>
                <li><span className="check">✓</span><span><b>Usuarios y roles</b>: cajero, encargado, contador.</span></li>
                <li><span className="check">✓</span><span><b>Multi-sucursal</b> y catálogo compartido.</span></li>
                <li><span className="check">✓</span><span><b>Tu propia web</b> configurable, sin programar.</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="flujo">
        <div className="wrap">
          <div className="sec-head">
            <p className="sec-eyebrow">Un día con el sistema</p>
            <h2>De abrir la caja al cierre, sin fricción.</h2>
          </div>
          <div className="flow">
            <div className="step"><div className="step__n" /><div><h3>Abrís la caja</h3><p>Elegís la sucursal y el fondo inicial. El turno queda atado a ese local.</p></div></div>
            <div className="step"><div className="step__n" /><div><h3>Vendés y cobrás</h3><p>Pesás, cobrás en efectivo, débito o QR, y emitís el e-Ticket — sin frenar la fila.</p></div></div>
            <div className="step"><div className="step__n" /><div><h3>Cargás la compra del Modelo</h3><p>Registrás los cajones del día; el sistema calcula el costo por kilo con la merma y actualiza el stock.</p></div></div>
            <div className="step"><div className="step__n" /><div><h3>Mirás cómo vas</h3><p>Ves ventas, márgenes y stock por sucursal en tiempo real desde el panel.</p></div></div>
            <div className="step"><div className="step__n" /><div><h3>Cerrás el arqueo</h3><p>Contás la caja, el sistema marca la diferencia y queda todo conciliado.</p></div></div>
          </div>
        </div>
      </section>

      <section id="planes" style={{ background: 'var(--surface-2)' }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="sec-eyebrow">Planes</p>
            <h2>Elegí el plan de tu verdulería.</h2>
            <p>Precios en pesos uruguayos, por mes. Sin permanencia.</p>
          </div>

          {planes === null ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Cargando planes…</p>
          ) : planes.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Escribinos y armamos el plan para tu verdulería.</p>
          ) : (
            <div className="plans">
              {planes.map((p, i) => {
                const destacado = planes.length >= 3 ? i === 1 : i === 0; // el del medio
                return (
                  <div key={p.code} className={`plan ${destacado ? 'plan--hot' : ''}`}>
                    {destacado && <span className="plan__flag">El más elegido</span>}
                    <div className="plan__name">{p.nombre}</div>
                    <div className="plan__price">{money(p.precioMensual)}<small> /mes</small></div>
                    {p.descripcion && <p className="plan__desc">{p.descripcion}</p>}
                    <ul>
                      {p.modules.map((m) => (
                        <li key={m}><span className="check">✓</span>{MODULO_LABEL[m] ?? m}</li>
                      ))}
                      <li><span className="check">✓</span>{limitesTexto(p)}</li>
                    </ul>
                    <a href="#contacto" className={`btn ${destacado ? 'btn--primary' : 'btn--ghost'}`}>Pedir demo</a>
                  </div>
                );
              })}
            </div>
          )}

          <div className="plans-notas">
            <span>🧾 <b>Facturación electrónica (CFE)</b>: se agrega como add-on según tu facturación (el Monotributo está exento).</span>
            <span>🎉 <b>Fundadores de Maldonado</b>: 50% de descuento durante el primer año para los primeros clientes.</span>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="cta" id="contacto">
            <h2>Tu verdulería, <em>ordenada y en regla.</em></h2>
            <p>Dejá el cuaderno y la calculadora. Escribinos y facturás tu primera venta en minutos.</p>
            <a href="#planes" className="btn btn--primary btn--lg">Ver planes</a>
          </div>
        </div>
      </section>

      <footer className="ar-foot">
        <div className="wrap foot">
          <div className="brand" onClick={secretLogin(CONSOLE_URL)}>
            <div className="brand__mark">A</div>
            <div className="brand__name">Aragon Verdulería<small>Aragon Tech Solutions · Uruguay</small></div>
          </div>
          <span>POS · Gestión · Facturación electrónica · Hecho para verdulerías 🇺🇾</span>
        </div>
      </footer>

      <div className="mobilecta">
        <a href="#capacidades" className="btn btn--ghost">Qué hace</a>
        <a href="#planes" className="btn btn--primary">Ver planes</a>
      </div>
    </div>
  );
}
