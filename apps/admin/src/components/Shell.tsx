import { useState } from 'react';
import { ProductsPage } from './ProductsPage';
import { UsersPage } from './UsersPage';
import { ReportsPage } from './ReportsPage';
import { SettingsPage } from './SettingsPage';

type Tab = 'reportes' | 'productos' | 'usuarios' | 'config';

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
        {tab === 'usuarios' && <UsersPage />}
        {tab === 'config' && <SettingsPage />}
      </main>
    </div>
  );
}
