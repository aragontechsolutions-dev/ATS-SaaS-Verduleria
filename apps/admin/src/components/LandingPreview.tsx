import type { CSSProperties } from 'react';
import type { LandingConfig } from '../lib/api';

/** Render de la landing a partir de la config. Es el mismo contenido que verá
 *  el público; acá se usa como preview en vivo del editor. */
export function LandingPreview({ config }: { config: LandingConfig }) {
  const accent = config.tema.color || '#0F8A7C';
  const wa = config.contacto.whatsapp.replace(/[^\d]/g, '');

  return (
    <div className="lp" style={{ '--lp-accent': accent } as CSSProperties}>
      {config.hero.mostrar && (
        <header
          className="lp-hero"
          style={config.hero.imagenUrl ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,.55)), url(${config.hero.imagenUrl})` } : undefined}
        >
          <h1>{config.hero.titulo || 'Tu verdulería'}</h1>
          {config.hero.lema && <p>{config.hero.lema}</p>}
          {config.contacto.mostrar && wa && (
            <a className="lp-cta" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
              Pedir por WhatsApp
            </a>
          )}
        </header>
      )}

      {config.productos.mostrar && (
        <section className="lp-sec">
          <h2>{config.productos.titulo || 'Productos'}</h2>
          {config.productos.items.length === 0 ? (
            <p className="lp-empty">Agregá productos u ofertas para mostrar.</p>
          ) : (
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
          )}
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
        </footer>
      )}
    </div>
  );
}
