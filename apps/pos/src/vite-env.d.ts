// Tipos de entorno del POS, declarados a mano para NO depender de la resolución
// de `vite/client` / `vite-plugin-pwa/client` (que varía según el layout de
// node_modules y rompía el build en Vercel). Solo declaramos lo que usamos.

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_TENANT_ID?: string;
  readonly VITE_USER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Import de hojas de estilo (`import './styles.css'`).
declare module '*.css';
