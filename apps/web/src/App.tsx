import { AragonLanding } from './components/AragonLanding';
import { TenantLanding } from './components/TenantLanding';

/**
 * Router mínimo: `/v/:slug` → landing de la verdulería; cualquier otra cosa →
 * landing de Aragon. Son puntos de entrada separados, no hay navegación SPA
 * entre ellos, así que alcanza con leer el pathname.
 */
export function App() {
  const m = window.location.pathname.match(/^\/v\/([^/]+)\/?$/);
  if (m) return <TenantLanding slug={decodeURIComponent(m[1])} />;
  return <AragonLanding />;
}
