// Metadata de los módulos para la UI (nombre visible + descripción + núcleo).
// El enum ModuleKey (fuente de verdad type-safe) vive en @ats/database.
import { ModuleKey } from '@ats/database';

export interface ModuleInfo {
  key: ModuleKey;
  nombre: string;
  descripcion: string;
  /** Núcleo: siempre presente; no debería venderse por separado. */
  core: boolean;
}

export const MODULE_CATALOG: Record<ModuleKey, ModuleInfo> = {
  POS: { key: 'POS', nombre: 'Punto de venta', descripcion: 'Ventas de mostrador, catálogo, caja y arqueo.', core: true },
  CFE: { key: 'CFE', nombre: 'Facturación electrónica', descripcion: 'e-Ticket y e-Factura contra DGI (FEU).', core: false },
  INVENTORY: { key: 'INVENTORY', nombre: 'Inventario y merma', descripcion: 'Stock por peso/unidad y registro de merma.', core: false },
  PURCHASES: { key: 'PURCHASES', nombre: 'Compras (UAM)', descripcion: 'Compras a proveedores y cálculo de costo real.', core: false },
  PRICING: { key: 'PRICING', nombre: 'Listas de precios', descripcion: 'Múltiples listas y actualización masiva de precios.', core: false },
  WHOLESALE: { key: 'WHOLESALE', nombre: 'Mayoreo', descripcion: 'Clientes con RUC, cuenta corriente y e-Factura B2B.', core: false },
  DELIVERY: { key: 'DELIVERY', nombre: 'Reparto', descripcion: 'Pedidos, rutas y app de repartidor.', core: false },
  REPORTS_ADVANCED: { key: 'REPORTS_ADVANCED', nombre: 'Reportes avanzados', descripcion: 'Rentabilidad, estacionalidad y sugerencia de compra.', core: false },
  MULTI_SUCURSAL: { key: 'MULTI_SUCURSAL', nombre: 'Multi-sucursal', descripcion: 'Operar más de una sucursal.', core: false },
  SCALE_LIVE: { key: 'SCALE_LIVE', nombre: 'Balanza en vivo', descripcion: 'Lectura de peso en vivo (WebSerial / agente Node).', core: false },
};

export const ALL_MODULES = Object.keys(MODULE_CATALOG) as ModuleKey[];
