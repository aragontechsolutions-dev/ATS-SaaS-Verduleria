import { ADMIN_URL } from './secretLogin';

// --- Contacto / conversión --------------------------------------------------

/** WhatsApp del comercial (solo dígitos, con código de país). Vacío = sin WhatsApp. */
export const WHATSAPP = (import.meta.env.VITE_WHATSAPP ?? '59892331784').replace(/\D/g, '');
export const HAY_WHATSAPP = WHATSAPP.length >= 8;

/** Link de WhatsApp con un mensaje pre-cargado. */
export function waLink(mensaje: string): string {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
}

export const WA_MSG_DEMO = 'Hola, quiero una demo del sistema para mi verdulería.';
export const WA_MSG_PLAN = 'Hola, quiero información de los planes para mi verdulería.';

// --- Demo (cuenta sandbox real) ---------------------------------------------

/** Panel al que entra la demo (por defecto el panel de administración). */
export const DEMO_URL = import.meta.env.VITE_DEMO_URL ?? ADMIN_URL;
export const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL ?? '';
export const DEMO_PASS = import.meta.env.VITE_DEMO_PASS ?? '';
export const HAY_DEMO = DEMO_EMAIL.length > 0;

/** Link al panel con el email demo pre-cargado (la contraseña no viaja en la URL). */
export function demoLink(): string {
  const base = DEMO_URL.replace(/\/$/, '');
  return DEMO_EMAIL ? `${base}/?demo=1&email=${encodeURIComponent(DEMO_EMAIL)}` : base;
}

// --- Navegación -------------------------------------------------------------

export const NAV: Array<{ href: string; label: string }> = [
  { href: '#funcionalidades', label: 'Funcionalidades' },
  { href: '#como', label: 'Cómo funciona' },
  { href: '#planes', label: 'Precios' },
  { href: '#faq', label: 'Preguntas frecuentes' },
];

// --- Contenido --------------------------------------------------------------

/** Indicadores de la barra de confianza. */
export const TRUST = [
  { icon: '🛒', label: 'Ventas' },
  { icon: '📦', label: 'Stock' },
  { icon: '🚚', label: 'Compras' },
  { icon: '💰', label: 'Caja' },
  { icon: '🧾', label: 'Facturación' },
  { icon: '📊', label: 'Reportes' },
];

/** Dolores del comercio manual. */
export const PROBLEMAS: Array<{ icon: string; text: string }> = [
  { icon: '❓', text: 'No sabés con exactitud cuánto stock te queda.' },
  { icon: '🧮', text: 'Perdés tiempo haciendo cuentas a mano.' },
  { icon: '🏷️', text: 'Los precios cambian todo el tiempo y cuesta actualizarlos.' },
  { icon: '🥬', text: 'Se te vence o se te echa a perder mercadería.' },
  { icon: '📈', text: 'No sabés cuáles son tus productos más rentables.' },
  { icon: '📒', text: 'Dependés de cuadernos, planillas y anotaciones.' },
  { icon: '💵', text: 'Es difícil controlar la caja al cierre.' },
  { icon: '🧩', text: 'La información está desparramada en varios lugares.' },
];

/** Módulos / funcionalidades. */
export interface Modulo {
  icon: string;
  nombre: string;
  desc: string;
}
export const MODULOS: Modulo[] = [
  { icon: '📊', nombre: 'Panel del negocio', desc: 'Ventas del día, caja, alertas y lo más vendido de un vistazo, en tiempo real.' },
  { icon: '🛒', nombre: 'Ventas (POS)', desc: 'Cobrás rápido, por peso o por unidad, incluso sin internet. La fila no se frena.' },
  { icon: '🥬', nombre: 'Productos', desc: 'Catálogo por kilo, unidad, cajón o bolsa, con PLU de balanza y código de barras.' },
  { icon: '📦', nombre: 'Stock', desc: 'Sabé qué tenés, cuánto y qué falta reponer, con alertas de mínimo y quiebre.' },
  { icon: '🚚', nombre: 'Compras', desc: 'Cargás la compra del Mercado Modelo y el sistema calcula el costo real por kilo.' },
  { icon: '🤝', nombre: 'Proveedores', desc: 'Ordená a quién le comprás y seguí precios y cantidades por proveedor.' },
  { icon: '🧑‍🤝‍🧑', nombre: 'Clientes mayoristas', desc: 'Lista de precios propia y cuenta corriente para tus clientes que compran al por mayor.' },
  { icon: '💰', nombre: 'Caja', desc: 'Apertura, arqueo y cierre por turno, con la diferencia marcada al instante.' },
  { icon: '🗑️', nombre: 'Mermas y vencimientos', desc: 'Registrá lo que se descarta y controlá fechas para perder menos plata.' },
  { icon: '📈', nombre: 'Reportes', desc: 'Ventas, márgenes, rentabilidad y evolución, por período y por sucursal.' },
  { icon: '🧾', nombre: 'Facturación electrónica', desc: 'Emisión de comprobantes (CFE) integrada con la DGI, según tu régimen.' },
  { icon: '💳', nombre: 'Pagos', desc: 'Cobrá con Mercado Pago online y con lector Point en el mostrador.' },
  { icon: '👥', nombre: 'Usuarios y permisos', desc: 'Cada empleado con su usuario y su rol: cajero, encargado, repartidor, comprador.' },
  { icon: '⚙️', nombre: 'Configuración', desc: 'Datos del comercio, sucursales, régimen fiscal y tu propia web, sin programar.' },
];

/** Estado de las pasarelas de pago (honesto: solo MP integrado). */
export const PAGOS: Array<{ nombre: string; estado: 'Integrado' | 'Próximamente' }> = [
  { nombre: 'Mercado Pago (online)', estado: 'Integrado' },
  { nombre: 'Mercado Pago Point (lector)', estado: 'Integrado' },
  { nombre: 'Fiserv', estado: 'Próximamente' },
  { nombre: 'Handy', estado: 'Próximamente' },
  { nombre: 'Getnet', estado: 'Próximamente' },
  { nombre: 'Scanntech', estado: 'Próximamente' },
];

/** Pasos "cómo funciona". */
export const PASOS: Array<{ n: string; titulo: string; desc: string }> = [
  { n: '01', titulo: 'Creamos tu negocio', desc: 'Damos de alta tu verdulería y tus usuarios. Quedás listo para operar.' },
  { n: '02', titulo: 'Cargás tus productos', desc: 'Tu catálogo con precios y unidades. Podés importar todo de una.' },
  { n: '03', titulo: 'Empezás a vender', desc: 'Cobrás en el mostrador, con o sin internet, y emitís el comprobante.' },
  { n: '04', titulo: 'Controlás tu negocio', desc: 'Ves ventas, stock, caja y ganancia en tiempo real, desde donde estés.' },
];

/** Beneficios. */
export const BENEFICIOS: Array<{ icon: string; titulo: string; desc: string }> = [
  { icon: '⏱️', titulo: 'Ahorrás tiempo', desc: 'Menos cuentas a mano y menos planillas. El sistema hace el trabajo pesado.' },
  { icon: '✅', titulo: 'Reducís errores', desc: 'Precios, stock y caja siempre consistentes, sin depender de la memoria.' },
  { icon: '📦', titulo: 'Controlás el stock', desc: 'Sabés qué reponer antes de quedarte sin mercadería o de que se venza.' },
  { icon: '💵', titulo: 'Conocés tu ganancia', desc: 'Costo real por kilo y margen por producto: sabés cuánto ganás de verdad.' },
  { icon: '🧠', titulo: 'Decidís mejor', desc: 'Con datos claros elegís qué comprar, qué remarcar y qué dejar de vender.' },
  { icon: '🌎', titulo: 'Desde cualquier lado', desc: 'Mirá tu negocio desde el celular o la compu, estés donde estés.' },
];

/** Confianza / seguridad (sin inventar certificaciones). */
export const SEGURIDAD: Array<{ icon: string; titulo: string; desc: string }> = [
  { icon: '🔐', titulo: 'Acceso seguro', desc: 'Cada persona entra con su usuario y contraseña. Bloqueo por intentos fallidos.' },
  { icon: '👥', titulo: 'Permisos por rol', desc: 'Cada empleado ve y hace solo lo que le corresponde según su función.' },
  { icon: '☁️', titulo: 'En la nube', desc: 'Tus datos disponibles desde cualquier dispositivo, sin depender de una sola máquina.' },
  { icon: '📴', titulo: 'Sigue sin internet', desc: 'El punto de venta trabaja offline y sincroniza cuando vuelve la conexión.' },
];

/** Testimonios: placeholders de piloto, claramente identificados (no son reales). */
export const TESTIMONIOS: Array<{ quote: string; rubro: string }> = [
  { quote: 'Dejé el cuaderno. Ahora sé lo que vendo y lo que gano cada día sin sentarme a hacer cuentas.', rubro: 'Verdulería de barrio' },
  { quote: 'Cargar la compra del Modelo y que me diga el costo por kilo con la merma me cambió la forma de poner precios.', rubro: 'Frutería' },
  { quote: 'El cajero vende aunque se caiga internet, y al cierre la caja cuadra sola.', rubro: 'Autoservicio de frutas y verduras' },
];

/** Preguntas frecuentes. */
export const FAQ: Array<{ q: string; a: string }> = [
  { q: '¿Necesito instalar algo?', a: 'No. El sistema funciona desde el navegador. El punto de venta además puede instalarse como app y trabaja sin internet.' },
  { q: '¿Lo puedo usar desde el celular?', a: 'Sí. Podés controlar tu negocio desde el celular, la tablet o la computadora. Las apps de reparto y de compras están pensadas para el celular.' },
  { q: '¿Sirve para productos vendidos por kilo?', a: 'Sí, está hecho para eso. Vendés por kilo, por unidad, por cajón o por bolsa, con balanza, PLU o código de peso variable.' },
  { q: '¿Puedo controlar el stock?', a: 'Sí. Ves el stock en tiempo real, con alertas de mínimo, ajustes, mermas y control de vencimientos.' },
  { q: '¿Puedo gestionar proveedores y compras?', a: 'Sí. Registrás las compras por proveedor y el sistema calcula el costo real por kilo con la merma para que sepas cuánto ganás.' },
  { q: '¿Puedo controlar la caja?', a: 'Sí. Apertura, arqueo y cierre por turno y por cajero, con la diferencia marcada automáticamente.' },
  { q: '¿Emite facturación electrónica?', a: 'Sí, tiene facturación electrónica (CFE) integrada con la DGI, según tu régimen fiscal. El Monotributo entrega ticket interno.' },
  { q: '¿Con qué medios de pago funciona?', a: 'Efectivo, tarjeta y Mercado Pago (online y con lector Point). Otras pasarelas se irán sumando.' },
  { q: '¿Mis empleados pueden usar el sistema?', a: 'Sí. Creás un usuario para cada uno con su rol (cajero, encargado, repartidor, comprador, etc.) y sus permisos.' },
  { q: '¿Mis datos están seguros?', a: 'Cada persona entra con su usuario y contraseña, con permisos por rol, y la información vive en la nube disponible desde cualquier dispositivo.' },
  { q: '¿Puedo probarlo antes?', a: 'Sí. Podés pedir una demo y recorrer una verdulería de ejemplo con datos de prueba para ver cómo funciona.' },
];
