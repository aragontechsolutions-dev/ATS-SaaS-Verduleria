import { useState } from 'react';
import { ProductsPage } from './ProductsPage';
import { CategoriasPage } from './CategoriasPage';
import { ComprasPage } from './ComprasPage';
import { StockPage } from './StockPage';
import { SucursalesPage } from './SucursalesPage';
import { MayoristasPage } from './MayoristasPage';
import { UsersPage } from './UsersPage';
import { ReportsPage } from './ReportsPage';
import { SettingsPage } from './SettingsPage';

type Tab = 'reportes' | 'productos' | 'categorias' | 'compras' | 'stock' | 'sucursales' | 'mayoristas' | 'usuarios' | 'config';

export function Shell({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('reportes');

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          <img src="/icon.svg" alt="Aragon" />
          Administración
        </div>
        <nav className="tabs">
          <button className={`tab ${tab === 'reportes' ? 'tab--on' : ''}`} onClick={() => setTab('reportes')}>
            Reportes
          </button>
          <button className={`tab ${tab === 'productos' ? 'tab--on' : ''}`} onClick={() => setTab('productos')}>
            Productos
          </button>
          <button className={`tab ${tab === 'categorias' ? 'tab--on' : ''}`} onClick={() => setTab('categorias')}>
            Categorías
          </button>
          <button className={`tab ${tab === 'compras' ? 'tab--on' : ''}`} onClick={() => setTab('compras')}>
            Compras
          </button>
          <button className={`tab ${tab === 'stock' ? 'tab--on' : ''}`} onClick={() => setTab('stock')}>
            Stock
          </button>
          <button className={`tab ${tab === 'sucursales' ? 'tab--on' : ''}`} onClick={() => setTab('sucursales')}>
            Sucursales
          </button>
          <button className={`tab ${tab === 'mayoristas' ? 'tab--on' : ''}`} onClick={() => setTab('mayoristas')}>
            Mayoristas
          </button>
          <button className={`tab ${tab === 'usuarios' ? 'tab--on' : ''}`} onClick={() => setTab('usuarios')}>
            Usuarios
          </button>
          <button className={`tab ${tab === 'config' ? 'tab--on' : ''}`} onClick={() => setTab('config')}>
            Configuración
          </button>
        </nav>
        <div className="topbar__right">
          <span className="topbar__user">{email}</span>
          <button className="btn btn--ghost btn--sm" onClick={onLogout}>Salir</button>
        </div>
      </header>

      <main className="content">
        {tab === 'reportes' && <ReportsPage />}
        {tab === 'productos' && <ProductsPage />}
        {tab === 'categorias' && <CategoriasPage />}
        {tab === 'compras' && <ComprasPage />}
        {tab === 'stock' && <StockPage />}
        {tab === 'sucursales' && <SucursalesPage />}
        {tab === 'mayoristas' && <MayoristasPage />}
        {tab === 'usuarios' && <UsersPage />}
        {tab === 'config' && <SettingsPage />}
      </main>
    </div>
  );
}
