interface ImportMetaEnv {
  /** Base del backend NestJS (para el endpoint público de landing). */
  readonly VITE_API_URL?: string;
  /** URL del login del dueño del SaaS (Consola). */
  readonly VITE_CONSOLE_URL?: string;
  /** URL del login de las verdulerías (Panel de administración). */
  readonly VITE_ADMIN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css';
