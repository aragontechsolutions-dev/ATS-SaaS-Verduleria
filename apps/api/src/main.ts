import 'reflect-metadata';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  // Pasamos el adapter de Express explícitamente (en vez de dejar que NestFactory
  // lo resuelva dinámicamente) para que no dependa del hoisting del monorepo.
  // Desactivamos el body-parser por defecto para fijar un límite de tamaño
  // explícito (evita DoS por payloads gigantes).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(), {
    bodyParser: false,
  });
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.setGlobalPrefix('api');

  // Detrás del proxy de Render/Vercel: confiar en X-Forwarded-* para tomar la IP
  // real (rate limiting) y el esquema https.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Cabeceras de seguridad (HSTS, no-sniff, frameguard, etc.). Es una API JSON,
  // así que desactivamos la CSP por defecto (pensada para HTML servido).
  app.use(helmet({ contentSecurityPolicy: false }));

  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }),
  );

  // CORS: por defecto abierto (MVP). En producción, restringir con CORS_ORIGIN
  // (lista separada por comas con el dominio del front en Vercel). Avisamos si
  // queda abierto en producción.
  const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
  if ((!corsOrigin || !corsOrigin.length) && process.env.NODE_ENV === 'production') {
    new Logger('Bootstrap').warn('CORS_ORIGIN no está seteado: la API acepta cualquier origen.');
  }
  app.enableCors({ origin: corsOrigin && corsOrigin.length ? corsOrigin : true });

  const config = app.get(ConfigService<AppConfig, true>);
  const port = config.get('port', { infer: true });
  // Bind a 0.0.0.0 para plataformas como Render/Fly (no solo loopback).
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API ATS Verdulería escuchando en el puerto ${port} (prefijo /api)`);
}

void bootstrap();
