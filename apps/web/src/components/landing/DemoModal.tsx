import { useEffect } from 'react';
import {
  DEMO_EMAIL, DEMO_PASS, HAY_DEMO, HAY_WHATSAPP, demoLink, waLink, WA_MSG_DEMO,
} from '../../lib/landing';

/** Modal de la demo: entra a una verdulería de ejemplo (cuenta sandbox real). */
export function DemoModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="demo-t" onClick={onClose}>
      <div className="modal__box" onClick={(e) => e.stopPropagation()}>
        <button className="modal__x" onClick={onClose} aria-label="Cerrar">×</button>
        <div className="modal__ico">🧪</div>
        <h3 id="demo-t" className="modal__t">Probá la demo</h3>

        {HAY_DEMO ? (
          <>
            <p className="modal__p">
              Entrá a <b>Verdulería Demo</b>, una cuenta de ejemplo con datos de prueba. Recorré el panel,
              el stock, las compras y los reportes como si fuera tu negocio.
            </p>
            <div className="modal__creds">
              <div><span>Usuario</span><b>{DEMO_EMAIL}</b></div>
              {DEMO_PASS && <div><span>Contraseña</span><b>{DEMO_PASS}</b></div>}
            </div>
            <a className="btn btn--primary btn--lg btn--block" href={demoLink()} target="_blank" rel="noopener noreferrer">
              Entrar a la demo →
            </a>
            <p className="modal__hint">Se abre el panel en otra pestaña con el usuario cargado. Es un entorno de prueba: mirá tranquilo.</p>
          </>
        ) : (
          <>
            <p className="modal__p">
              Estamos preparando la verdulería de ejemplo. Mientras tanto, escribinos y te hacemos una
              demostración guiada del sistema para tu negocio.
            </p>
            {HAY_WHATSAPP ? (
              <a className="btn btn--primary btn--lg btn--block" href={waLink(WA_MSG_DEMO)} target="_blank" rel="noopener noreferrer">
                Pedir demo por WhatsApp
              </a>
            ) : (
              <a className="btn btn--primary btn--lg btn--block" href="#contacto" onClick={onClose}>
                Ir a contacto
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
