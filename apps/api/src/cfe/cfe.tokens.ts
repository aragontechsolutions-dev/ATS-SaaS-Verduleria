import type { CfeProvider } from '@ats/cfe';

/** Token de inyección del proveedor de CFE (permite intercambiar FEU/Host Factura). */
export const CFE_PROVIDER = Symbol('CFE_PROVIDER');

export type { CfeProvider };
