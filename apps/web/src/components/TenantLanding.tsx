import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { getPublicLanding, gmapsDirUrl, NotFoundError, tieneUbicacion } from '../lib/api';
import type { LandingProducto, PublicLanding } from '../lib/api';
import { ADMIN_URL, secretLogin } from '../lib/secretLogin';
import { LandingMap } from './LandingMap';

/**
 * Carrusel horizontal con auto-desplazamiento. Si los productos no entran en
 * la pantalla, la fila se mueve sola (de derecha a izquierda) a velocidad
 * suave para que se vean los que quedan fuera. Va y vuelve (ping-pong) al
 * llegar a los extremos. Se pausa cuando el usuario pasa el mouse, toca o usa
 * las flechas, y el usuario puede desplazar en ambos sentidos (flechas o
 * arrastre/swipe nativo). Respeta "prefers-reduced-motion".
 */
function AutoCarousel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const dirRef = useRef(1);
  const posRef = useRef(0); // acumulador float (scrollLeft se redondea a entero)
  const pausedRef = useRef(false);
  const resumeRef = useRef<number | undefined>(undefined);
  const [overflow, setOverflow] = useState(false);

  // ¿El contenido excede el ancho visible? (define si hay auto-scroll y flechas)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflow(el.scrollWidth - el.clientWidth > 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  // Bucle de auto-desplazamiento.
  useEffect(() => {
    const el = ref.current;
    if (!el || !overflow) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const VEL = 26; // px por segundo
    let raf = 0;
    let last = performance.now();
    posRef.current = el.scrollLeft;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!pausedRef.current) {
        const max = el.scrollWidth - el.clientWidth;
        // Acumulamos en float propio: si leyéramos scrollLeft (entero) el avance
        // de ~0.4px/frame se redondearía a 0 y el carrusel no se movería.
        let next = posRef.current + dirRef.current * VEL * dt;
        if (next >= max) { next = max; dirRef.current = -1; }
        else if (next <= 0) { next = 0; dirRef.current = 1; }
        posRef.current = next;
        el.scrollLeft = next;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [overflow]);

  function sincronizar() { if (ref.current) posRef.current = ref.current.scrollLeft; }
  function pausar() { pausedRef.current = true; window.clearTimeout(resumeRef.current); }
  function reanudar() { sincronizar(); pausedRef.current = false; }
  function reanudarLuego(ms = 3500) {
    window.clearTimeout(resumeRef.current);
    resumeRef.current = window.setTimeout(reanudar, ms);
  }
  function mover(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    pausar();
    reanudarLuego(4000);
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 220), behavior: 'smooth' });
  }

  return (
    <div className={`lp-carwrap ${overflow ? 'is-scrollable' : ''}`}>
      {overflow && (
        <button className="lp-carbtn lp-carbtn--prev" type="button" aria-label="Ver anteriores" onClick={() => mover(-1)}>‹</button>
      )}
      <div
        className="lp-carousel"
        ref={ref}
        onMouseEnter={pausar}
        onMouseLeave={reanudar}
        onPointerDown={pausar}
        onPointerUp={() => reanudarLuego()}
        onTouchStart={pausar}
        onTouchEnd={() => reanudarLuego()}
        onScroll={() => { if (pausedRef.current) sincronizar(); }}
      >
        {children}
      </div>
      {overflow && (
        <button className="lp-carbtn lp-carbtn--next" type="button" aria-label="Ver más" onClick={() => mover(1)}>›</button>
      )}
    </div>
  );
}

/** Agrupa los productos por categoría preservando el orden de aparición. */
function agruparPorCategoria(items: LandingProducto[]): Array<{ categoria: string; items: LandingProducto[] }> {
  const grupos: Array<{ categoria: string; items: LandingProducto[] }> = [];
  const idx = new Map<string, number>();
  for (const it of items) {
    const cat = (it.categoria ?? '').trim();
    let i = idx.get(cat);
    if (i === undefined) {
      i = grupos.length;
      idx.set(cat, i);
      grupos.push({ categoria: cat, items: [] });
    }
    grupos[i].items.push(it);
  }
  return grupos;
}

/**
 * Productos en carruseles horizontales por categoría: con muchos productos la
 * página no se hace larguísima hacia abajo y se navega deslizando cada fila.
 */
function ProductosCarruseles({ items }: { items: LandingProducto[] }) {
  const grupos = useMemo(() => agruparPorCategoria(items), [items]);
  const mostrarTitulos = grupos.length > 1;

  return (
    <>
      {grupos.map((g, gi) => (
        <div className="lp-catgroup" key={gi}>
          {mostrarTitulos && <h3 className="lp-catgroup__title">{g.categoria || 'Más productos'}</h3>}
          <AutoCarousel>
            {g.items.map((p, i) => (
              <div className="lp-prod" key={i}>
                {p.imagenUrl && <div className="lp-prod__img" style={{ backgroundImage: `url(${p.imagenUrl})` }} />}
                <div className="lp-prod__body">
                  <strong>{p.nombre || 'Producto'}</strong>
                  {p.precio && <span className="lp-prod__price">{p.precio}</span>}
                </div>
              </div>
            ))}
          </AutoCarousel>
        </div>
      ))}
    </>
  );
}

type State = { estado: 'load' } | { estado: 'ok'; data: PublicLanding } | { estado: '404' } | { estado: 'error' };

export function TenantLanding({ slug }: { slug: string }) {
  const [s, setS] = useState<State>({ estado: 'load' });

  useEffect(() => {
    let vivo = true;
    getPublicLanding(slug)
      .then((data) => vivo && setS({ estado: 'ok', data }))
      .catch((e) => vivo && setS({ estado: e instanceof NotFoundError ? '404' : 'error' }));
    return () => {
      vivo = false;
    };
  }, [slug]);

  useEffect(() => {
    if (s.estado === 'ok') document.title = s.data.nombre;
  }, [s]);

  if (s.estado === 'load') return <div className="pub-center">Cargando…</div>;
  if (s.estado === '404') {
    return (
      <div className="pub-center pub-404">
        <h1>Página no encontrada</h1>
        <p>Esta verdulería todavía no publicó su web.</p>
        <a href="/">Ir a Aragon Verdulería</a>
      </div>
    );
  }
  if (s.estado === 'error') return <div className="pub-center">No se pudo cargar la página. Probá de nuevo.</div>;

  const { config } = s.data;
  const accent = config.tema.color || '#0F8A7C';
  const wa = config.contacto.whatsapp.replace(/[^\d]/g, '');

  return <LandingView config={config} accent={accent} wa={wa} tiendaActiva={!!s.data.tiendaActiva} slug={slug} />;
}

function LandingView({
  config,
  accent,
  wa,
  tiendaActiva,
  slug,
}: {
  config: PublicLanding['config'];
  accent: string;
  wa: string;
  tiendaActiva: boolean;
  slug: string;
}) {
  const style = useMemo(() => ({ '--lp-accent': accent }) as CSSProperties, [accent]);

  return (
    <div className="lp" style={style}>
      {config.hero.mostrar && (
        <header
          className="lp-hero"
          style={config.hero.imagenUrl ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,.58)), url(${config.hero.imagenUrl})` } : undefined}
        >
          <h1
            className="lp-logo"
            onClick={secretLogin(ADMIN_URL)}
            title="Verdulería"
          >
            {config.hero.titulo || 'Verdulería'}
          </h1>
          {config.hero.lema && <p>{config.hero.lema}</p>}
          <div className="lp-cta-row">
            {tiendaActiva && (
              <a className="lp-cta lp-cta--shop" href={`/v/${encodeURIComponent(slug)}/tienda`}>🛒 Comprar online</a>
            )}
            {config.contacto.mostrar && wa && (
              <a className="lp-cta" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">Pedir por WhatsApp</a>
            )}
          </div>
        </header>
      )}

      {config.productos.mostrar && config.productos.items.length > 0 && (
        <section className="lp-sec">
          <h2>{config.productos.titulo || 'Productos'}</h2>
          <ProductosCarruseles items={config.productos.items} />
        </section>
      )}

      {config.horarios.mostrar && (config.horarios.texto || config.horarios.direccion || tieneUbicacion(config.horarios.lat, config.horarios.lng)) && (
        <section className="lp-sec lp-sec--alt">
          <h2>Horarios y ubicación</h2>
          {config.horarios.texto && <p className="lp-line">🕐 {config.horarios.texto}</p>}
          {config.horarios.direccion && <p className="lp-line">📍 {config.horarios.direccion}</p>}
          {tieneUbicacion(config.horarios.lat, config.horarios.lng) && (
            <>
              <LandingMap lat={config.horarios.lat} lng={config.horarios.lng} nombre={config.horarios.direccion || undefined} />
              <div className="lp-go__wrap">
                <a
                  className="lp-go"
                  href={gmapsDirUrl(config.horarios.lat, config.horarios.lng)}
                  target="_blank"
                  rel="noreferrer"
                >
                  🧭 Llevame hasta allí
                </a>
              </div>
            </>
          )}
          {config.horarios.mapaUrl && (
            <a className="lp-link" href={config.horarios.mapaUrl} target="_blank" rel="noreferrer">Cómo llegar</a>
          )}
        </section>
      )}

      {config.contacto.mostrar && (
        <footer className="lp-foot">
          <h2>Contacto</h2>
          <div className="lp-contact">
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">WhatsApp</a>}
            {config.contacto.telefono && <a href={`tel:${config.contacto.telefono}`}>{config.contacto.telefono}</a>}
            {config.contacto.instagram && <a href={config.contacto.instagram} target="_blank" rel="noreferrer">Instagram</a>}
            {config.contacto.facebook && <a href={config.contacto.facebook} target="_blank" rel="noreferrer">Facebook</a>}
          </div>
          <p className="lp-madeby">
            Hecho con <a href="/" className="lp-madeby__link">Aragon Verdulería</a>
          </p>
        </footer>
      )}
    </div>
  );
}
