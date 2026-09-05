import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';

/** Heartbeat de presencia/ubicación del repartidor (desde la PWA). */
export class PresenciaDto {
  /** El repartidor solo elige entre trabajar (DISPONIBLE) o no (OFFLINE).
   *  EN_ENTREGA lo fija el servidor si tiene un pedido encima. */
  @IsIn(['DISPONIBLE', 'OFFLINE'])
  estado!: 'DISPONIBLE' | 'OFFLINE';

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

/** Ubicación del local (para el motor de cercanía). */
export class LocalUbicacionDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}
