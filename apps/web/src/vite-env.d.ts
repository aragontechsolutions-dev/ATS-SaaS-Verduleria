interface ImportMetaEnv {
  /** Base del backend NestJS (para el endpoint público de landing). */
  readonly VITE_API_URL?: string;
  /** URL del login del dueño del SaaS (Consola). */
  readonly VITE_CONSOLE_URL?: string;
  /** URL del login de las verdulerías (Panel de administración). */
  readonly VITE_ADMIN_URL?: string;
  /** Número de WhatsApp para los CTA (solo dígitos, con código de país). */
  readonly VITE_WHATSAPP?: string;
  /** URL del panel de la cuenta demo (por defecto, el panel de administración). */
  readonly VITE_DEMO_URL?: string;
  /** Email del usuario demo (se muestra y pre-carga en el login). */
  readonly VITE_DEMO_EMAIL?: string;
  /** Contraseña del usuario demo (se muestra en el modal de demo). */
  readonly VITE_DEMO_PASS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css';
