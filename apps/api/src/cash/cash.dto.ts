import { IsIn, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CashMovementDto {
  @IsIn(['INGRESO', 'EGRESO', 'SANGRIA'])
  tipo!: 'INGRESO' | 'EGRESO' | 'SANGRIA';

  @IsNumber()
  @Min(0.01)
  monto!: number;

  @IsOptional()
  @IsString()
  motivo?: string;
}

export class OpenCashDto {
  @IsOptional()
  @IsString()
  sucursalId?: string;

  /** Caja física / terminal gestionada donde se abre el turno (id). */
  @IsOptional()
  @IsString()
  terminalId?: string;

  /** Nombre libre de caja (compatibilidad; se ignora si viene terminalId). */
  @IsOptional()
  @IsString()
  terminal?: string;

  @IsNumber()
  @Min(0)
  montoApertura!: number;
}

export class RelevoDto {
  /** Cajero entrante que toma la caja. */
  @IsString()
  toUserId!: string;

  /** Efectivo contado en el cajón al momento del relevo (arqueo ciego). */
  @IsNumber()
  @Min(0)
  montoContado!: number;

  @IsOptional()
  @IsString()
  notas?: string;
}

export class CloseCashDto {
  /** Efectivo contado en el arqueo. */
  @IsNumber()
  @Min(0)
  montoCierre!: number;

  /**
   * Conteo/liquidación por medio de pago electrónico para la conciliación
   * (ej. { DEBITO: 3200, TRANSFERENCIA: 1500 }). El EFECTIVO se toma de
   * montoCierre. Los medios no incluidos se concilian contra el sistema.
   */
  @IsOptional()
  @IsObject()
  conteos?: Record<string, number>;

  @IsOptional()
  @IsString()
  notas?: string;
}
