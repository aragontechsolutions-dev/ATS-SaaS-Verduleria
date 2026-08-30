import { AuditEventTipo } from '@ats/database';
import { IsIn, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

/** Eventos que el POS (cliente) puede emitir. El resto se audita server-side. */
const POS_TIPOS: AuditEventTipo[] = [
  AuditEventTipo.CAJON_ABIERTO,
  AuditEventTipo.ANULACION_LINEA,
  AuditEventTipo.PRECIO_MODIFICADO,
];

export class CreateAuditDto {
  @IsIn(POS_TIPOS)
  tipo!: AuditEventTipo;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsNumber()
  monto?: number;

  @IsOptional()
  @IsString()
  refId?: string;

  @IsOptional()
  @IsString()
  cashSessionId?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
