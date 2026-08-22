import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FeuProvider } from '@ats/cfe';
import type { AppConfig } from '../config/configuration';
import { CFE_PROVIDER } from './cfe.tokens';

/**
 * Construye el CfeProvider por defecto (FEU) con las credenciales de partner
 * de ATS. Un solo login sirve para todos los RUTs (X-Emisor por request).
 *
 * A futuro: un registry por-tenant si algún cliente necesita otro proveedor.
 */
export const cfeProviderFactory: Provider = {
  provide: CFE_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppConfig, true>) => {
    const feu = config.get('feu', { infer: true });
    return new FeuProvider({
      ambiente: feu.ambiente,
      username: feu.username,
      password: feu.password,
      refreshToken: feu.refreshToken,
      // TODO: onRefreshToken → persistir el refresh rotado en CfeTenantConfig.
    });
  },
};
