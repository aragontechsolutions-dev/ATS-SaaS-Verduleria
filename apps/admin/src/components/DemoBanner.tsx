import { useEffect, useState } from 'react';
import { getMe, type Me } from '../lib/api';

const POS_URL = import.meta.env.VITE_POS_URL ?? '';
const REPARTIDOR_URL = import.meta.env.VITE_REPARTIDOR_URL ?? '';
const COMPRADOR_URL = import.meta.env.VITE_COMPRADOR_URL ?? '';
const WEB_URL = import.meta.env.VITE_WEB_URL ?? '';
const DEMO_REPARTIDOR = import.meta.env.VITE_DEMO_REPARTIDOR_EMAIL ?? '';
const DEMO_COMPRADOR = import.meta.env.VITE_DEMO_COMPRADOR_EMAIL ?? '';

/** Link a otra app con el modo demo (email pre-cargado, sin contraseña en la URL). */
function link(base: string, email?: string): string {
  const b = base.replace(/\/$/, '');
  return email ? `${b}/?demo=1&email=${encodeURIComponent(email)}` : `${b}/?demo=1`;
}

/**
 * Distintivo de sandbox + acceso a la experiencia completa. Solo aparece si el
 * tenant está marcado como demo (GET /auth/me → esDemo).
 */
export function DemoBanner({ email }: { email: string }) {
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null));
  }, []);

  if (!me?.esDemo) return null;

  const slug = me.slug ?? '';
  const apps: Array<{ label: string; icon: string; href: string; nota?: string }> = [];
  // Caja/POS: el usuario admin de la demo ya puede vender.
  if (POS_URL) apps.push({ label: 'Caja / POS', icon: '🛒', href: link(POS_URL, email) });
  if (REPARTIDOR_URL) apps.push({ label: 'App Repartidor', icon: '🛵', href: link(REPARTIDOR_URL, DEMO_REPARTIDOR || undefined), nota: DEMO_REPARTIDOR ? undefined : 'usá el usuario repartidor demo' });
  if (COMPRADOR_URL) apps.push({ label: 'App Comprador', icon: '🧺', href: link(COMPRADOR_URL, DEMO_COMPRADOR || undefined), nota: DEMO_COMPRADOR ? undefined : 'usá el usuario comprador demo' });
  if (WEB_URL && slug) apps.push({ label: 'Tienda online', icon: '🌐', href: `${WEB_URL.replace(/\/$/, '')}/v/${slug}/tienda` });
  if (WEB_URL && slug) apps.push({ label: 'Mi web', icon: '🏠', href: `${WEB_URL.replace(/\/$/, '')}/v/${slug}` });

  return (
    <div className="demobar">
      <div className="demobar__main">
        <span className="demobar__tag">🧪 MODO DEMO</span>
        <span className="demobar__txt">
          Estás en una <b>verdulería de ejemplo</b>. Probá lo que quieras: los datos se reinician cuando entra un visitante nuevo.
        </span>
        {apps.length > 0 && (
          <button className="demobar__toggle" onClick={() => setOpen((v) => !v)}>
            {open ? 'Ocultar apps' : 'Experiencia completa ▾'}
          </button>
        )}
      </div>
      {open && apps.length > 0 && (
        <div className="demobar__apps">
          {apps.map((a) => (
            <a key={a.label} className="demobar__app" href={a.href} target="_blank" rel="noopener noreferrer" title={a.nota}>
              <span aria-hidden>{a.icon}</span> {a.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
