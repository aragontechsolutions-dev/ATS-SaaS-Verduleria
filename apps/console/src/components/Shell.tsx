import { useState } from 'react';
import { Dashboard } from './Dashboard';
import { BillingPage } from './BillingPage';
import { IvaRulesPage } from './IvaRulesPage';

type Tab = 'clientes' | 'facturacion' | 'iva';

const NAV: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'clientes', label: 'Clientes', icon: '🏪' },
  { id: 'facturacion', label: 'Facturación', icon: '💳' },
  { id: 'iva', label: 'Motor de IVA', icon: '🧾' },
];

export function Shell({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('clientes');
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
          <span className="topbar__brandtext">Consola Aragon</span>
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

        <main className="content">
          {tab === 'clientes' && <Dashboard />}
          {tab === 'facturacion' && <BillingPage />}
          {tab === 'iva' && <IvaRulesPage />}
        </main>
      </div>
    </div>
  );
}
