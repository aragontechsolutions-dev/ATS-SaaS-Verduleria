import { AragonLanding } from './components/AragonLanding';
import { TenantLanding } from './components/TenantLanding';
import { TenantStore } from './components/TenantStore';

/**
 * Router mínimo por pathname:
 *   `/v/:slug/tienda` → tienda online (e-commerce) de la verdulería,
 *   `/v/:slug`        → landing de la verdulería,
 *   cualquier otra cosa → landing de Aragon.
 * Son puntos de entrada separados, no hay navegación SPA entre ellos.
 */
export function App() {
  const store = window.location.pathname.match(/^\/v\/([^/]+)\/tienda\/?$/);
  if (store) return <TenantStore slug={decodeURIComponent(store[1])} />;

  const landing = window.location.pathname.match(/^\/v\/([^/]+)\/?$/);
  if (landing) return <TenantLanding slug={decodeURIComponent(landing[1])} />;

  return <AragonLanding />;
}
