// Configuración tipada leída de variables de entorno.
export interface FeuConfig {
  ambiente: 'test' | 'produccion';
  username: string;
  password: string;
  /** refresh_token persistido opcional (dura ~365 días). */
  refreshToken?: string;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  /** Permitir resolver el tenant por headers (solo dev/testing). */
  allowHeaderTenant: boolean;
}

export interface AppConfig {
  port: number;
  databaseUrl: string;
  feu: FeuConfig;
  auth: AuthConfig;
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
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
    allowHeaderTenant: process.env.ALLOW_HEADER_TENANT === 'true',
  },
  cfePollingIntervalMs: Number(process.env.CFE_POLLING_INTERVAL_MS ?? 60_000),
});
