import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// El tenant/usuario ya no se inyectan por env: salen del JWT tras el login.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
