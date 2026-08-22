import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // CORS: por defecto abierto (MVP). En producción, restringir con CORS_ORIGIN
  // (lista separada por comas con el dominio del front en Vercel).
  const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim());
  app.enableCors({ origin: corsOrigin && corsOrigin.length ? corsOrigin : true });

  const config = app.get(ConfigService<AppConfig, true>);
  const port = config.get('port', { infer: true });
  // Bind a 0.0.0.0 para plataformas como Render/Fly (no solo loopback).
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API ATS Verdulería escuchando en el puerto ${port} (prefijo /api)`);
}

void bootstrap();
