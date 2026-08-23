import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { getPublicLanding, NotFoundError } from '../lib/api';
import type { PublicLanding } from '../lib/api';
import { ADMIN_URL, secretLogin } from '../lib/secretLogin';

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

  return <LandingView config={config} accent={accent} wa={wa} />;
}

function LandingView({
  config,
  accent,
  wa,
}: {
  config: PublicLanding['config'];
  accent: string;
  wa: string;
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
          {config.contacto.mostrar && wa && (
            <a className="lp-cta" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">Pedir por WhatsApp</a>
          )}
        </header>
      )}

      {config.productos.mostrar && config.productos.items.length > 0 && (
        <section className="lp-sec">
          <h2>{config.productos.titulo || 'Productos'}</h2>
          <div className="lp-prods">
            {config.productos.items.map((p, i) => (
              <div className="lp-prod" key={i}>
                {p.imagenUrl && <div className="lp-prod__img" style={{ backgroundImage: `url(${p.imagenUrl})` }} />}
                <div className="lp-prod__body">
                  <strong>{p.nombre || 'Producto'}</strong>
                  {p.precio && <span className="lp-prod__price">{p.precio}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {config.horarios.mostrar && (config.horarios.texto || config.horarios.direccion) && (
        <section className="lp-sec lp-sec--alt">
          <h2>Horarios y ubicación</h2>
          {config.horarios.texto && <p className="lp-line">🕐 {config.horarios.texto}</p>}
          {config.horarios.direccion && <p className="lp-line">📍 {config.horarios.direccion}</p>}
          {config.horarios.mapaUrl && (
            <a className="lp-link" href={config.horarios.mapaUrl} target="_blank" rel="noreferrer">Ver en el mapa</a>
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
