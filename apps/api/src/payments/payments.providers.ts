/**
 * Catálogo de proveedores de cobro (la "gama" que ofrecemos). Data-driven: para
 * habilitar uno nuevo se implementa su proveedor y se pone `integrado: true`.
 * Es pura (testeable) y la comparten Consola y tienda.
 */

export type ProveedorPagoKey = 'MERCADO_PAGO' | 'FISERV' | 'HANDY' | 'GETNET' | 'SCANNTECH';

export interface ProveedorInfo {
  key: ProveedorPagoKey;
  nombre: string;
  /** Ya está integrado y puede cobrar de verdad. */
  integrado: boolean;
  /** Soporta cobro online (tienda). */
  online: boolean;
  /** Soporta cobro presencial (lector en el mostrador). */
  presencial: boolean;
  descripcion: string;
  /** Color de marca para la UI. */
  color: string;
}

export const PROVEEDORES: ProveedorInfo[] = [
  {
    key: 'MERCADO_PAGO',
    nombre: 'Mercado Pago',
    integrado: true,
    online: true,
    presencial: true,
    descripcion: 'Checkout Pro en la tienda + lector Point en el mostrador. Vinculación en 1 clic (OAuth).',
    color: '#009ee3',
  },
  {
    key: 'FISERV',
    nombre: 'Fiserv',
    integrado: false,
    online: true,
    presencial: false,
    descripcion: 'Cobro online por página de pago alojada. Pendiente de documentación y credenciales.',
    color: '#ff6600',
  },
  {
    key: 'HANDY',
    nombre: 'Handy',
    integrado: false,
    online: true,
    presencial: true,
    descripcion: 'Integración con software de terceros confirmada. Pendiente de documentación.',
    color: '#00a3e0',
  },
  {
    key: 'GETNET',
    nombre: 'Getnet',
    integrado: false,
    online: true,
    presencial: true,
    descripcion: 'Adquirente (Santander). Pendiente de documentación y credenciales.',
    color: '#ec0000',
  },
  {
    key: 'SCANNTECH',
    nombre: 'Scanntech',
    integrado: false,
    online: false,
    presencial: true,
    descripcion: 'Pendiente de evaluación de integración.',
    color: '#1a7a3f',
  },
];

export function esProveedorIntegrado(key: string): boolean {
  return PROVEEDORES.some((p) => p.key === key && p.integrado);
}

export function proveedorPorKey(key: string): ProveedorInfo | undefined {
  return PROVEEDORES.find((p) => p.key === key);
}
