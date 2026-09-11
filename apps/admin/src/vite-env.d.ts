interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WEB_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  // Demo: URLs de las otras apps y usuarios demo por rol (para el launcher).
  readonly VITE_POS_URL?: string;
  readonly VITE_REPARTIDOR_URL?: string;
  readonly VITE_COMPRADOR_URL?: string;
  readonly VITE_DEMO_CAJERO_EMAIL?: string;
  readonly VITE_DEMO_REPARTIDOR_EMAIL?: string;
  readonly VITE_DEMO_COMPRADOR_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css';
