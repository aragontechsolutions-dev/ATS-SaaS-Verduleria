import type { WasteMotivo } from '../lib/api';

/** Motivos estructurados de merma (para el registro y el reporte por causa). */
export const MOTIVO_MERMA: Array<{ value: WasteMotivo; label: string }> = [
  { value: 'PODRIDO', label: 'Podrido / vencido en góndola' },
  { value: 'DANADO', label: 'Dañado / golpeado' },
  { value: 'VENCIDO', label: 'Vencido' },
  { value: 'DESCARTE', label: 'Descarte / recorte' },
  { value: 'ERROR_PESO', label: 'Error de peso / carga' },
  { value: 'ROBO', label: 'Robo / faltante' },
  { value: 'OTRO', label: 'Otro' },
];

export const MOTIVO_LABEL: Record<string, string> = Object.fromEntries(MOTIVO_MERMA.map((m) => [m.value, m.label]));
