// Configuración tipada leída de variables de entorno.
export interface FeuConfig {
  ambiente: 'test' | 'produccion';
  username: string;
  password: string;
  /** refresh_token persistido opcional (dura ~365 días). */
  refreshToken?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  /** Service-role key: solo backend, para crear usuarios (Admin API). */
  serviceRoleKey: string;
}

export interface AuthConfig {
  /** Permitir resolver el tenant por headers (solo dev/testing). */
  allowHeaderTenant: boolean;
}

export interface BillingConfig {
  /** Genera automáticamente las facturas del mes (cron). */
  autoGenerate: boolean;
  /** Suspende automáticamente a los morosos en el cron diario (sensible). */
  autoSuspend: boolean;
}

export interface AppConfig {
  port: number;
  databaseUrl: string;
  feu: FeuConfig;
  supabase: SupabaseConfig;
  auth: AuthConfig;
  billing: BillingConfig;
  /** Intervalo (ms) del worker de polling de estado DGI. */
  cfePollingIntervalMs: number;
}

export default (): AppConfig => ({
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  feu: {
    ambiente: (process.env.FEU_AMBIENTE as 'test' | 'produccion') ?? 'test',
    username: process.env.FEU_USERNAME ?? '',
    password: process.env.FEU_PASSWORD ?? '',
    refreshToken: process.env.FEU_REFRESH_TOKEN || undefined,
  },
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    anonKey: process.env.SUPABASE_ANON_KEY ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  },
  auth: {
    allowHeaderTenant: process.env.ALLOW_HEADER_TENANT === 'true',
  },
  billing: {
    autoGenerate: process.env.BILLING_AUTO_GENERATE !== 'false', // ON por defecto
    autoSuspend: process.env.BILLING_AUTO_SUSPEND === 'true', // OFF por defecto (sensible)
  },
  cfePollingIntervalMs: Number(process.env.CFE_POLLING_INTERVAL_MS ?? 60_000),
});
