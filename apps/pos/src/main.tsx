import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Dev: fijar un tenant de prueba si no hay uno configurado (en prod → JWT).
if (!localStorage.getItem('ats.tenantId') && import.meta.env.DEV) {
  const fromEnv = import.meta.env.VITE_TENANT_ID;
  if (fromEnv) localStorage.setItem('ats.tenantId', fromEnv);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
