import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OpenCashDto {
  @IsOptional()
  @IsString()
  sucursalId?: string;

  @IsNumber()
  @Min(0)
  montoApertura!: number;
}

export class CloseCashDto {
  /** Efectivo contado en el arqueo. */
  @IsNumber()
  @Min(0)
  montoCierre!: number;

  @IsOptional()
  @IsString()
  notas?: string;
}
