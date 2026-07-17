export interface OpenCashDto {
  sucursalId?: string;
  montoApertura: number;
}

export interface CloseCashDto {
  /** Efectivo contado en el arqueo. */
  montoCierre: number;
  notas?: string;
}
