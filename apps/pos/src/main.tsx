import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Dev: fijar tenant/usuario de prueba si no hay configuración (en prod → JWT).
if (import.meta.env.DEV) {
  if (!localStorage.getItem('ats.tenantId') && import.meta.env.VITE_TENANT_ID) {
    localStorage.setItem('ats.tenantId', import.meta.env.VITE_TENANT_ID);
  }
  if (!localStorage.getItem('ats.userId') && import.meta.env.VITE_USER_ID) {
    localStorage.setItem('ats.userId', import.meta.env.VITE_USER_ID);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
