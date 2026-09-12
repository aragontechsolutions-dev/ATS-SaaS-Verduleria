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
  // Contraseñas de los usuarios demo por rol (se muestran en el launcher para
  // que el visitante pueda entrar a esas apps).
  readonly VITE_DEMO_REPARTIDOR_PASS?: string;
  readonly VITE_DEMO_COMPRADOR_PASS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css';
