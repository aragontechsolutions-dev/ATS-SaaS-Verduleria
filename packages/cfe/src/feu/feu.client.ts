// ============================================================================
// Cliente HTTP de bajo nivel para FEU (Surtec).
// Responsabilidades: gestión de token (cache + refresh + reintento ante 401)
// y ejecución de requests con Authorization + X-Emisor.
// ============================================================================

import { CfeError } from '../types';
import type { CfeAmbiente } from '../types';
import type { FeuTokenResponse } from './feu.types';

export interface FeuEndpoints {
  authUrl: string;
  apiBase: string;
}

/**
 * URLs por ambiente. Las de TEST están verificadas (CONTEXTOFEU.md §1).
 * ⚠️ Las de PRODUCCIÓN son la convención esperada pero NO están confirmadas
 * con Surtec — confirmar antes de ir a prod.
 */
export const FEU_ENDPOINTS: Record<CfeAmbiente, FeuEndpoints> = {
  test: {
    authUrl: 'https://auth-test.facturaelectronica.com.uy/token',
    apiBase: 'https://api-test.facturaelectronica.com.uy',
  },
  produccion: {
    // ⚠️ PENDIENTE confirmar con Surtec (soporte@surtec.com.uy).
    authUrl: 'https://auth.facturaelectronica.com.uy/token',
    apiBase: 'https://api.facturaelectronica.com.uy',
  },
};

export interface FeuClientConfig {
  ambiente?: CfeAmbiente;
  endpoints?: Partial<FeuEndpoints>;
  username: string;
  password: string;
  /** refresh_token persistido (dura ~365 días). Si falta, se hace login. */
  refreshToken?: string;
  /** Se llama cuando rota el refresh_token, para que la app lo persista. */
  onRefreshToken?: (refreshToken: string) => void | Promise<void>;
  /** Inyectable para tests. Por defecto, fetch global de Node 22. */
  fetchImpl?: typeof fetch;
  /** Margen (seg) para renovar antes de que expire el access_token. */
  expirySkewSeconds?: number;
}

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

export class FeuClient {
  private readonly endpoints: FeuEndpoints;
  private readonly fetchImpl: typeof fetch;
  private readonly skewMs: number;
  private refreshToken?: string;
  private cached?: CachedToken;
  /** Evita logins/refresh concurrentes (dedupe). */
  private inflightToken?: Promise<string>;

  constructor(private readonly config: FeuClientConfig) {
    const base = FEU_ENDPOINTS[config.ambiente ?? 'test'];
    this.endpoints = {
      authUrl: config.endpoints?.authUrl ?? base.authUrl,
      apiBase: config.endpoints?.apiBase ?? base.apiBase,
    };
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.skewMs = (config.expirySkewSeconds ?? 60) * 1000;
    this.refreshToken = config.refreshToken;
  }

  // --------------------------------------------------------------------------
  // Token
  // --------------------------------------------------------------------------

  private decodeExpMs(jwt: string): number {
    try {
      const payload = jwt.split('.')[1];
      const json = Buffer.from(payload, 'base64url').toString('utf8');
      const { exp } = JSON.parse(json) as { exp?: number };
      if (typeof exp === 'number') return exp * 1000;
    } catch {
      /* ignore: usamos fallback abajo */
    }
    // Fallback conservador: 5 minutos.
    return Date.now() + 5 * 60 * 1000;
  }

  private async fetchToken(body: Record<string, string>): Promise<FeuTokenResponse> {
    const res = await this.fetchImpl(this.endpoints.authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as FeuTokenResponse & { error?: string };
    if (!res.ok || !data.access_token) {
      throw new CfeError(`FEU auth falló (HTTP ${res.status})`, res.status, data);
    }
    return data;
  }

  private async obtainToken(): Promise<string> {
    let token: FeuTokenResponse;
    if (this.refreshToken) {
      try {
        token = await this.fetchToken({ grant_type: 'refresh_token', refresh_token: this.refreshToken });
      } catch {
        // Refresh vencido/inválido → login con password.
        token = await this.fetchToken({
          grant_type: 'password',
          username: this.config.username,
          password: this.config.password,
        });
      }
    } else {
      token = await this.fetchToken({
        grant_type: 'password',
        username: this.config.username,
        password: this.config.password,
      });
    }

    this.cached = { accessToken: token.access_token, expiresAtMs: this.decodeExpMs(token.access_token) };
    if (token.refresh_token && token.refresh_token !== this.refreshToken) {
      this.refreshToken = token.refresh_token;
      await this.config.onRefreshToken?.(token.refresh_token);
    }
    return token.access_token;
  }

  private async getAccessToken(force = false): Promise<string> {
    if (!force && this.cached && Date.now() < this.cached.expiresAtMs - this.skewMs) {
      return this.cached.accessToken;
    }
    if (force) this.cached = undefined;
    if (!this.inflightToken) {
      this.inflightToken = this.obtainToken().finally(() => {
        this.inflightToken = undefined;
      });
    }
    return this.inflightToken;
  }

  // --------------------------------------------------------------------------
  // Requests
  // --------------------------------------------------------------------------

  /** Request autenticado. Reintenta una vez ante 401 renovando el token. */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    opts: { emisorRut?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {},
  ): Promise<T> {
    const doFetch = async (token: string): Promise<Response> => {
      const url = new URL(path.startsWith('http') ? path : this.endpoints.apiBase + path);
      if (opts.query) {
        for (const [k, v] of Object.entries(opts.query)) {
          if (v !== undefined) url.searchParams.set(k, String(v));
        }
      }
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (opts.emisorRut) headers['X-Emisor'] = opts.emisorRut;
      if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
      return this.fetchImpl(url.toString(), {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    };

    let res = await doFetch(await this.getAccessToken());
    if (res.status === 401) {
      res = await doFetch(await this.getAccessToken(true));
    }

    if (!res.ok) {
      const detalle = await res.json().catch(() => res.statusText);
      throw new CfeError(`FEU ${method} ${path} falló (HTTP ${res.status})`, res.status, detalle);
    }
    return (await res.json()) as T;
  }

  /** Igual que request pero devuelve la Response cruda (para el PDF base64). */
  async requestRaw(
    method: 'GET' | 'POST',
    path: string,
    opts: { emisorRut?: string; query?: Record<string, string | number | undefined> } = {},
  ): Promise<Response> {
    const doFetch = async (token: string): Promise<Response> => {
      const url = new URL(path.startsWith('http') ? path : this.endpoints.apiBase + path);
      if (opts.query) {
        for (const [k, v] of Object.entries(opts.query)) {
          if (v !== undefined) url.searchParams.set(k, String(v));
        }
      }
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (opts.emisorRut) headers['X-Emisor'] = opts.emisorRut;
      return this.fetchImpl(url.toString(), { method, headers });
    };

    let res = await doFetch(await this.getAccessToken());
    if (res.status === 401) {
      res = await doFetch(await this.getAccessToken(true));
    }
    return res;
  }
}
