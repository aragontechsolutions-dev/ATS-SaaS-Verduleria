import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Tenant/usuario desde env (build-time). Sirve para el deploy single-tenant
// del MVP mientras no hay auth real (JWT). Se puede sobrescribir por
// localStorage (útil para probar con otro tenant sin rebuild).
if (import.meta.env.VITE_TENANT_ID && !localStorage.getItem('ats.tenantId')) {
  localStorage.setItem('ats.tenantId', import.meta.env.VITE_TENANT_ID);
}
if (import.meta.env.VITE_USER_ID && !localStorage.getItem('ats.userId')) {
  localStorage.setItem('ats.userId', import.meta.env.VITE_USER_ID);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
