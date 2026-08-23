import { useState } from 'react';
import { Dashboard } from './Dashboard';
import { BillingPage } from './BillingPage';

type Tab = 'clientes' | 'facturacion';

export function Shell({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('clientes');

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          <img src="/icon.svg" alt="Aragon" />
          Consola Aragon
        </div>
        <nav className="tabs">
          <button className={`tab ${tab === 'clientes' ? 'tab--on' : ''}`} onClick={() => setTab('clientes')}>
            Clientes
          </button>
          <button className={`tab ${tab === 'facturacion' ? 'tab--on' : ''}`} onClick={() => setTab('facturacion')}>
            Facturación
          </button>
        </nav>
        <div className="topbar__right">
          <span className="topbar__user">{email}</span>
          <button className="btn btn--ghost btn--sm" onClick={onLogout}>Salir</button>
        </div>
      </header>

      <main className="content">
        {tab === 'clientes' ? <Dashboard /> : <BillingPage />}
      </main>
    </div>
  );
}
