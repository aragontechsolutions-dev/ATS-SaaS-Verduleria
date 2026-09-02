import { useState } from 'react';
import { ProductsPage } from './ProductsPage';
import { CategoriasPage } from './CategoriasPage';
import { PromocionesPage } from './PromocionesPage';
import { ComprasPage } from './ComprasPage';
import { StockPage } from './StockPage';
import { MermasPage } from './MermasPage';
import { CajaPage } from './CajaPage';
import { SucursalesPage } from './SucursalesPage';
import { MayoristasPage } from './MayoristasPage';
import { LandingPage } from './LandingPage';
import { TiendaPage } from './TiendaPage';
import { UsersPage } from './UsersPage';
import { AuditoriaPage } from './AuditoriaPage';
import { ReportsPage } from './ReportsPage';
import { SettingsPage } from './SettingsPage';

type Tab = 'reportes' | 'productos' | 'categorias' | 'promos' | 'compras' | 'stock' | 'mermas' | 'caja' | 'sucursales' | 'mayoristas' | 'miweb' | 'tienda' | 'usuarios' | 'auditoria' | 'config';

const NAV: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'reportes', label: 'Reportes', icon: '📊' },
  { id: 'productos', label: 'Productos', icon: '🥬' },
  { id: 'categorias', label: 'Categorías', icon: '🏷️' },
  { id: 'promos', label: 'Promociones', icon: '🎉' },
  { id: 'compras', label: 'Compras', icon: '🛒' },
  { id: 'stock', label: 'Stock', icon: '📦' },
  { id: 'mermas', label: 'Mermas', icon: '🗑️' },
  { id: 'caja', label: 'Caja', icon: '💰' },
  { id: 'sucursales', label: 'Sucursales', icon: '🏬' },
  { id: 'mayoristas', label: 'Mayoristas', icon: '🤝' },
  { id: 'miweb', label: 'Mi web', icon: '🌐' },
  { id: 'tienda', label: 'Tienda online', icon: '🛒' },
  { id: 'usuarios', label: 'Usuarios', icon: '👥' },
  { id: 'auditoria', label: 'Auditoría', icon: '📋' },
  { id: 'config', label: 'Configuración', icon: '⚙️' },
];

const PAGES: Record<Tab, JSX.Element> = {
  reportes: <ReportsPage />,
  productos: <ProductsPage />,
  categorias: <CategoriasPage />,
  promos: <PromocionesPage />,
  compras: <ComprasPage />,
  stock: <StockPage />,
  mermas: <MermasPage />,
  caja: <CajaPage />,
  sucursales: <SucursalesPage />,
  mayoristas: <MayoristasPage />,
  miweb: <LandingPage />,
  tienda: <TiendaPage />,
  usuarios: <UsersPage />,
  auditoria: <AuditoriaPage />,
  config: <SettingsPage />,
};

export function Shell({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('reportes');
  const [drawer, setDrawer] = useState(false);

  const actual = NAV.find((n) => n.id === tab)!;

  function go(id: Tab) {
    setTab(id);
    setDrawer(false);
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="topbar__menu" onClick={() => setDrawer(true)} aria-label="Abrir menú">☰</button>
        <div className="topbar__brand">
          <img src="/icon.svg" alt="Aragon" />
          <span className="topbar__brandtext">Administración</span>
        </div>
        <span className="topbar__section">{actual.icon} {actual.label}</span>
        <div className="topbar__spacer" />
        <div className="topbar__right">
          <span className="topbar__user">{email}</span>
          <button className="btn btn--ghost btn--sm" onClick={onLogout}>Salir</button>
        </div>
      </header>

      <div className="shell">
        <aside className={`sidebar ${drawer ? 'is-open' : ''}`}>
          <div className="sidebar__head">
            <span className="sidebar__title">Menú</span>
            <button className="sidebar__close" onClick={() => setDrawer(false)} aria-label="Cerrar menú">×</button>
          </div>
          <nav className="sidebar__nav">
            {NAV.map((n) => (
              <button
                key={n.id}
                className={`navlink ${tab === n.id ? 'is-active' : ''}`}
                onClick={() => go(n.id)}
              >
                <span className="navlink__icon" aria-hidden>{n.icon}</span>
                <span>{n.label}</span>
              </button>
            ))}
          </nav>
        </aside>
        {drawer && <div className="sidebar__scrim" onClick={() => setDrawer(false)} />}

        <main className="content">{PAGES[tab]}</main>
      </div>
    </div>
  );
}
