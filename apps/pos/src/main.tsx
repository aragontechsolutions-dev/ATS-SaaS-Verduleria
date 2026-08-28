import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './lib/toast';
import { SecurityProvider } from './lib/security';
import './styles.css';

// El tenant/usuario ya no se inyectan por env: salen del JWT tras el login.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <SecurityProvider>
        <App />
      </SecurityProvider>
    </ToastProvider>
  </React.StrictMode>,
);
