import type { MouseEvent } from 'react';

/** URL del login del dueño del SaaS (Consola). */
export const CONSOLE_URL = import.meta.env.VITE_CONSOLE_URL ?? 'http://localhost:5174';
/** URL del login de las verdulerías (Panel de administración). */
export const ADMIN_URL = import.meta.env.VITE_ADMIN_URL ?? 'http://localhost:5173';

/**
 * Acceso "oculto" al login: mantené Ctrl + Shift y hacé click en el logo.
 * El login no se muestra en la landing pública; este gesto lleva a cada uno al
 * suyo (el dueño a la Consola, la verdulería a su Panel).
 */
export function secretLogin(target: string) {
  return (e: MouseEvent) => {
    if (e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      window.location.href = target;
    }
  };
}
