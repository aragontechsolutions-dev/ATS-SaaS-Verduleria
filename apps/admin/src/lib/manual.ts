// Contenido del manual de usuario, filtrable por rol.
// La visibilidad de cada artículo se define en `roles`: 'todos' lo ven todos,
// o una lista de roles. El ADMIN ve todo (ver AyudaPage).

export type RoleId =
  | 'ADMIN' | 'ENCARGADO' | 'CAJERO' | 'DEPOSITO'
  | 'REPARTIDOR' | 'COMPRADOR' | 'MAYORISTA' | 'CONTADOR';

export interface RolMeta {
  id: RoleId;
  nombre: string;
  icono: string;
  resumen: string;
}

/** Datos de cada rol para el badge y el selector "ver como". */
export const ROLES: RolMeta[] = [
  { id: 'ADMIN', nombre: 'Administrador', icono: '👑', resumen: 'Dueño / administrador. Ve y configura todo el sistema.' },
  { id: 'ENCARGADO', nombre: 'Encargado', icono: '🧑‍💼', resumen: 'Supervisa la operación diaria: compras, stock, caja y pedidos.' },
  { id: 'CAJERO', nombre: 'Cajero', icono: '🧾', resumen: 'Vende y cobra en el punto de venta (POS).' },
  { id: 'DEPOSITO', nombre: 'Depósito', icono: '📦', resumen: 'Repone mercadería, ajusta stock y carga mermas y vencimientos.' },
  { id: 'REPARTIDOR', nombre: 'Repartidor', icono: '🛵', resumen: 'Entrega los pedidos y cobra en la puerta.' },
  { id: 'COMPRADOR', nombre: 'Comprador', icono: '🛒', resumen: 'Compra en la UAM y registra las compras.' },
  { id: 'MAYORISTA', nombre: 'Mayorista', icono: '🤝', resumen: 'Cliente mayorista que se autogestiona desde su portal.' },
  { id: 'CONTADOR', nombre: 'Contador', icono: '📚', resumen: 'Consulta y exporta información contable (solo lectura).' },
];

export function rolMeta(id: string | undefined): RolMeta | undefined {
  return ROLES.find((r) => r.id === id);
}

export interface Articulo {
  id: string;
  titulo: string;
  /** 'todos' o la lista de roles que lo ven. */
  roles: RoleId[] | 'todos';
  /** En qué app se hace (para ubicar al usuario). */
  app?: string;
  resumen: string;
  pasos?: string[];
  tips?: string[];
}

export interface Seccion {
  id: string;
  titulo: string;
  icono: string;
  articulos: Articulo[];
}

export const MANUAL: Seccion[] = [
  {
    id: 'primeros-pasos',
    titulo: 'Primeros pasos',
    icono: '🚪',
    articulos: [
      {
        id: 'ingresar',
        titulo: 'Ingresar al sistema',
        roles: 'todos',
        app: 'Todas las apps',
        resumen: 'Cada persona entra con su propio email y contraseña. No compartas tu usuario.',
        pasos: [
          'Abrí el link de la app que te corresponde (administración, POS, repartidor o comprador).',
          'Escribí tu email y tu contraseña.',
          'Tocá "Ingresar".',
        ],
        tips: [
          'Si es tu primer ingreso, el sistema te va a pedir que cambies la contraseña.',
          'Podés tocar el ojito 👁 para ver lo que escribís y evitar errores.',
        ],
      },
      {
        id: 'clave-bloqueo',
        titulo: 'Olvidé la contraseña o quedé bloqueado',
        roles: 'todos',
        resumen: 'Por seguridad, después de varios intentos fallidos el usuario se bloquea.',
        pasos: [
          'Avisale al encargado o al administrador.',
          'El administrador entra a Usuarios, te desbloquea y/o te genera una contraseña nueva.',
          'Ingresás con la clave nueva y el sistema te pide que la cambies.',
        ],
        tips: ['Nunca pidas ni compartas contraseñas por WhatsApp: que el admin te la genere en el sistema.'],
      },
    ],
  },

  {
    id: 'administracion',
    titulo: 'Configuración del negocio',
    icono: '⚙️',
    articulos: [
      {
        id: 'config-inicial',
        titulo: 'Configurar los datos del negocio',
        roles: ['ADMIN'],
        app: 'Administración › Configuración',
        resumen: 'Antes de vender, dejá listos los datos del comercio, el régimen fiscal y las sucursales.',
        pasos: [
          'Entrá a Configuración y completá nombre del comercio, RUT/RUC, dirección y teléfono.',
          'Elegí el régimen fiscal (Monotributo, Literal E, Régimen General, etc.).',
          'En Sucursales, revisá que la sucursal principal esté cargada; agregá otras si tenés.',
        ],
        tips: ['El régimen fiscal define si se emiten comprobantes electrónicos (CFE) o ticket interno.'],
      },
      {
        id: 'usuarios',
        titulo: 'Crear usuarios y asignar roles',
        roles: ['ADMIN'],
        app: 'Administración › Usuarios',
        resumen: 'Cada empleado necesita su usuario con el rol correcto. El rol define qué puede hacer.',
        pasos: [
          'Entrá a Usuarios y tocá "Nuevo usuario".',
          'Cargá nombre y email, y elegí el rol (Cajero, Depósito, Repartidor, Comprador, etc.).',
          'Guardá: se crea con una contraseña temporal que el empleado cambia en su primer ingreso.',
        ],
        tips: [
          'Desde Usuarios podés desbloquear, resetear la contraseña o desactivar a alguien que ya no trabaja.',
          'Dale a cada uno el rol mínimo que necesita: menos errores y más seguridad.',
        ],
      },
      {
        id: 'fiscal',
        titulo: 'Facturación electrónica (CFE)',
        roles: ['ADMIN', 'CONTADOR'],
        app: 'Administración › Configuración',
        resumen: 'Si tu régimen obliga a CFE, el sistema emite los comprobantes automáticamente al cobrar.',
        pasos: [
          'Verificá el régimen fiscal en Configuración.',
          'Al cobrar en el POS, el comprobante se genera y se envía solo.',
          'En Reportes / Auditoría podés ver los comprobantes emitidos.',
        ],
        tips: ['En regímenes exceptuados se entrega un ticket interno (no fiscal), no un CFE.'],
      },
      {
        id: 'pagos-online',
        titulo: 'Cobros online con Mercado Pago',
        roles: ['ADMIN'],
        app: 'Administración › Configuración',
        resumen: 'Conectá tu cuenta de Mercado Pago para cobrar los pedidos de la tienda online.',
        pasos: [
          'En Configuración, sección de pagos, tocá "Conectar con Mercado Pago".',
          'Iniciá sesión con la cuenta de MP del comercio y aceptá los permisos.',
          'Listo: los pedidos de la tienda pueden pagarse online.',
        ],
        tips: [
          'La plata de los cobros online cae en tu cuenta de Mercado Pago y de ahí la transferís a tu banco.',
          'Podés ver pagos aprobados, rechazados o pendientes, y hacer reembolsos desde el pedido.',
        ],
      },
    ],
  },

  {
    id: 'catalogo',
    titulo: 'Productos y precios',
    icono: '🥬',
    articulos: [
      {
        id: 'cargar-productos',
        titulo: 'Cargar y editar productos',
        roles: ['ADMIN', 'ENCARGADO'],
        app: 'Administración › Productos',
        resumen: 'El catálogo es la base de todo: ventas, stock, compras y tienda online.',
        pasos: [
          'Entrá a Productos y tocá "Nuevo producto".',
          'Cargá nombre, categoría, unidad de venta (kg/unidad) y precio.',
          'Si se pesa en balanza, asigná el PLU. Si tiene código de barras, cargalo.',
          'Guardá.',
        ],
        tips: [
          'Podés importar muchos productos de una con "Importar catálogo".',
          'La unidad de compra (cajón/bolsa) y el factor de conversión ayudan a calcular el stock al comprar.',
        ],
      },
      {
        id: 'categorias',
        titulo: 'Organizar por categorías',
        roles: ['ADMIN', 'ENCARGADO'],
        app: 'Administración › Categorías',
        resumen: 'Las categorías ordenan el POS y la tienda online (Frutas, Verduras, Almacén, etc.).',
        pasos: ['Entrá a Categorías.', 'Creá o editá las categorías.', 'Asigná cada producto a su categoría.'],
      },
      {
        id: 'precios',
        titulo: 'Cambiar precios (incluso masivo)',
        roles: ['ADMIN', 'ENCARGADO'],
        app: 'Administración › Productos',
        resumen: 'Actualizá precios uno por uno o varios a la vez con el cambio masivo.',
        pasos: [
          'Para uno solo: abrí el producto y cambiá el precio.',
          'Para varios: seleccioná productos y usá "Cambio de precios" (por %, monto o margen).',
        ],
        tips: ['El margen se calcula sobre el costo promedio que surge de las compras.'],
      },
      {
        id: 'promos',
        titulo: 'Promociones',
        roles: ['ADMIN', 'ENCARGADO'],
        app: 'Administración › Promociones',
        resumen: 'Ofertas y descuentos que se aplican en el POS y se muestran en la tienda.',
        pasos: ['Entrá a Promociones.', 'Creá la promo (producto, descuento, vigencia).', 'Guardá y verificá en el POS.'],
      },
    ],
  },

  {
    id: 'compras-stock',
    titulo: 'Compras, stock y mermas',
    icono: '📦',
    articulos: [
      {
        id: 'sugerido',
        titulo: 'Ver el sugerido de compra',
        roles: ['ADMIN', 'ENCARGADO', 'COMPRADOR'],
        app: 'Administración › Compras · o app Comprador',
        resumen: 'El sistema calcula qué reponer según ventas y stock, agrupado por proveedor.',
        pasos: [
          'Entrá a Compras (o abrí la app del comprador).',
          'Mirá el sugerido: cantidad recomendada por producto y proveedor.',
          'Ajustá lo que haga falta según lo que vas a comprar.',
        ],
      },
      {
        id: 'registrar-compra',
        titulo: 'Registrar una compra',
        roles: ['ADMIN', 'ENCARGADO', 'COMPRADOR'],
        app: 'Administración › Compras · o app Comprador',
        resumen: 'Al registrar la compra, sube el stock y se recalcula el costo promedio de cada producto.',
        pasos: [
          'Elegí el proveedor.',
          'Cargá cada producto: cantidad comprada (cajones/bolsas) y precio pagado.',
          'Confirmá: el stock se actualiza automáticamente.',
        ],
        tips: ['Cargar bien el precio de compra es clave: de ahí sale el margen y la rentabilidad.'],
      },
      {
        id: 'comprar-uam',
        titulo: 'Comprar en la UAM (app del comprador)',
        roles: ['COMPRADOR'],
        app: 'App Comprador',
        resumen: 'Pensada para usar en el mercado: marcás lo que comprás y lo registrás al toque.',
        pasos: [
          'Entrá a la app del comprador con tu usuario.',
          'Revisá el sugerido agrupado por proveedor.',
          'Marcá cada producto comprado y cargá la cantidad real y el precio.',
          'Tocá "Registrar compra" en ese proveedor.',
        ],
        tips: [
          'Con "➕ Agregar producto" podés buscar y sumar algo que no venía en el sugerido.',
          'Podés registrar por proveedor a medida que vas recorriendo el mercado.',
        ],
      },
      {
        id: 'stock',
        titulo: 'Consultar y ajustar el stock',
        roles: ['ADMIN', 'ENCARGADO', 'DEPOSITO'],
        app: 'Administración › Stock',
        resumen: 'Mirá cuánto hay de cada producto y corregí diferencias con un ajuste.',
        pasos: [
          'Entrá a Stock para ver las cantidades por sucursal.',
          'Si hay una diferencia real, usá "Ajuste" indicando cuánto suma o resta y el motivo.',
        ],
        tips: ['Usá el ajuste solo para corregir la realidad (roturas, conteos), no para tapar errores de venta.'],
      },
      {
        id: 'mermas',
        titulo: 'Cargar mermas',
        roles: ['ADMIN', 'ENCARGADO', 'DEPOSITO'],
        app: 'Administración › Mermas',
        resumen: 'Registrá lo que se descarta (podrido, golpeado) para descontarlo del stock y medir la pérdida.',
        pasos: ['Entrá a Mermas.', 'Elegí el producto, la cantidad y el motivo.', 'Confirmá.'],
        tips: ['El reporte de mermas te dice cuánta plata perdés por producto y por causa.'],
      },
      {
        id: 'vencimientos',
        titulo: 'Controlar vencimientos',
        roles: ['ADMIN', 'ENCARGADO', 'DEPOSITO'],
        app: 'Administración › Mermas › Vencimientos',
        resumen: 'Anotá fechas de vencimiento para que te avise antes de que se pierda la mercadería.',
        pasos: [
          'Entrá a Mermas › Vencimientos.',
          'Cargá el producto, la cantidad y la fecha de vencimiento.',
          'Cuando algo vence, resolvé el aviso (venta, descuento o merma).',
        ],
      },
    ],
  },

  {
    id: 'pos',
    titulo: 'Venta en el mostrador (POS)',
    icono: '🧾',
    articulos: [
      {
        id: 'abrir-caja',
        titulo: 'Abrir la caja / iniciar turno',
        roles: ['ADMIN', 'ENCARGADO', 'CAJERO'],
        app: 'POS',
        resumen: 'Antes de vender tenés que abrir la caja con el monto inicial (fondo).',
        pasos: ['Entrá al POS.', 'Tocá "Abrir caja".', 'Cargá el efectivo con el que arrancás (fondo).'],
        tips: ['Cada cajero abre su propia caja: así el arqueo del cierre es de cada uno.'],
      },
      {
        id: 'vender',
        titulo: 'Hacer una venta',
        roles: ['ADMIN', 'ENCARGADO', 'CAJERO'],
        app: 'POS',
        resumen: 'Agregá productos por PLU, balanza, búsqueda o código de barras y cobrá.',
        pasos: [
          'Buscá el producto por nombre, tocá su botón, escaneá el código o ingresá el PLU.',
          'Para productos pesables, ingresá el peso (o leelo de la balanza).',
          'Revisá el total y tocá "Cobrar".',
        ],
        tips: ['El POS funciona incluso sin internet: las ventas se sincronizan cuando vuelve la conexión.'],
      },
      {
        id: 'cobrar',
        titulo: 'Cobrar: efectivo, tarjeta o Mercado Pago',
        roles: ['ADMIN', 'ENCARGADO', 'CAJERO'],
        app: 'POS',
        resumen: 'Elegí el medio de pago y confirmá. El comprobante se emite según tu régimen.',
        pasos: [
          'Tocá "Cobrar" y elegí el medio: efectivo, tarjeta, Mercado Pago (Point) o cuenta corriente.',
          'Efectivo: ingresá con cuánto paga para calcular el vuelto.',
          'Point: seguí el lector de tarjeta hasta que el pago quede aprobado.',
          'Confirmá para cerrar la venta.',
        ],
      },
      {
        id: 'devoluciones',
        titulo: 'Hacer una devolución',
        roles: ['ADMIN', 'ENCARGADO', 'CAJERO'],
        app: 'POS',
        resumen: 'Devolvé total o parcialmente una venta ya cerrada.',
        pasos: ['Buscá la venta original.', 'Elegí qué productos y cantidades se devuelven.', 'Confirmá la devolución.'],
        tips: ['No se puede devolver más de lo que se vendió en esa boleta.'],
      },
      {
        id: 'cerrar-caja',
        titulo: 'Cerrar la caja / arqueo',
        roles: ['ADMIN', 'ENCARGADO', 'CAJERO'],
        app: 'POS · o Administración › Caja',
        resumen: 'Al terminar el turno, contás el efectivo y el sistema muestra si hay diferencia.',
        pasos: [
          'Tocá "Cerrar caja".',
          'Contá el efectivo real y cargalo.',
          'El sistema compara con lo esperado y muestra la diferencia (sobrante o faltante).',
        ],
        tips: ['El encargado puede ver los arqueos y las diferencias de cada cajero en Caja.'],
      },
    ],
  },

  {
    id: 'tienda-pedidos',
    titulo: 'Tienda online y pedidos',
    icono: '🌐',
    articulos: [
      {
        id: 'miweb',
        titulo: 'Armar "Mi web" (landing) y la tienda',
        roles: ['ADMIN', 'ENCARGADO'],
        app: 'Administración › Mi web / Tienda online',
        resumen: 'Configurá tu página pública y qué productos se muestran para la venta online.',
        pasos: [
          'En "Mi web" editá el encabezado, contacto, horarios y ubicación.',
          'En "Tienda online" elegí qué productos se publican (podés seleccionar varios de una).',
          'Guardá y revisá la página pública.',
        ],
      },
      {
        id: 'pedidos',
        titulo: 'Atender pedidos online',
        roles: ['ADMIN', 'ENCARGADO'],
        app: 'Administración › Pedidos',
        resumen: 'Los pedidos de la tienda llegan acá para prepararlos y despacharlos.',
        pasos: [
          'Entrá a Pedidos y abrí el pedido nuevo.',
          'Preparalo y marcá el estado (en preparación, listo).',
          'Si es delivery, asignalo a un repartidor.',
        ],
        tips: ['Si el pedido se pagó online, vas a ver el pago confirmado en el detalle.'],
      },
    ],
  },

  {
    id: 'reparto',
    titulo: 'Reparto a domicilio',
    icono: '🛵',
    articulos: [
      {
        id: 'repartidor-pedidos',
        titulo: 'Ver mis entregas (app del repartidor)',
        roles: ['REPARTIDOR'],
        app: 'App Repartidor',
        resumen: 'Desde el celular ves los pedidos que te asignaron, con dirección y detalle.',
        pasos: [
          'Entrá a la app del repartidor con tu usuario.',
          'Mirá la lista de entregas asignadas.',
          'Abrí un pedido para ver dirección, productos y cómo paga.',
        ],
      },
      {
        id: 'repartidor-entregar',
        titulo: 'Marcar entregado y cobrar',
        roles: ['REPARTIDOR'],
        app: 'App Repartidor',
        resumen: 'Al entregar, confirmás en la app; si el pago es contra entrega, lo registrás.',
        pasos: [
          'Al llegar, entregá el pedido.',
          'Si paga en la puerta, cobrá e indicá el medio.',
          'Marcá el pedido como "Entregado".',
        ],
        tips: ['Si no podés entregar (nadie en casa, dirección errada), dejalo anotado para que lo vean en el local.'],
      },
    ],
  },

  {
    id: 'mayoristas',
    titulo: 'Clientes mayoristas',
    icono: '🤝',
    articulos: [
      {
        id: 'gestion-mayoristas',
        titulo: 'Gestionar mayoristas (desde el local)',
        roles: ['ADMIN', 'ENCARGADO'],
        app: 'Administración › Mayoristas',
        resumen: 'Alta de clientes mayoristas, su lista de precios y su cuenta corriente.',
        pasos: [
          'Entrá a Mayoristas y creá el cliente.',
          'Asignale la lista de precios mayorista.',
          'Seguí sus pedidos y su cuenta corriente (lo que debe).',
        ],
      },
      {
        id: 'portal-mayorista',
        titulo: 'Comprar como mayorista (portal)',
        roles: ['MAYORISTA'],
        app: 'Portal Mayorista (web)',
        resumen: 'Como cliente mayorista, hacés tus pedidos y ves tu cuenta sin llamar al local.',
        pasos: [
          'Ingresá al portal mayorista con tu usuario.',
          'Armá el pedido con tus precios mayoristas.',
          'Confirmá el pedido y seguí su estado.',
        ],
        tips: ['En tu cuenta corriente ves lo que compraste y el saldo pendiente.'],
      },
    ],
  },

  {
    id: 'reportes',
    titulo: 'Reportes, cierre y contabilidad',
    icono: '📊',
    articulos: [
      {
        id: 'reportes-general',
        titulo: 'Reportes del negocio',
        roles: ['ADMIN', 'ENCARGADO', 'CONTADOR'],
        app: 'Administración › Reportes',
        resumen: 'Ventas, márgenes, productos más vendidos, mermas y más, por período y sucursal.',
        pasos: ['Entrá a Reportes.', 'Elegí el período y la sucursal.', 'Mirá los indicadores y los detalles.'],
      },
      {
        id: 'exportar',
        titulo: 'Exportar información contable',
        roles: ['ADMIN', 'CONTADOR'],
        app: 'Administración › Reportes',
        resumen: 'Descargá ventas, IVA y comprobantes para tu contador o tu sistema contable.',
        pasos: ['Elegí el período en Reportes.', 'Usá la opción de exportar.', 'Descargá el archivo.'],
      },
      {
        id: 'auditoria',
        titulo: 'Auditoría (quién hizo qué)',
        roles: ['ADMIN', 'CONTADOR'],
        app: 'Administración › Auditoría',
        resumen: 'Registro de acciones importantes: útil para control y para revisar diferencias.',
        pasos: ['Entrá a Auditoría.', 'Filtrá por fecha o usuario.', 'Revisá los movimientos.'],
      },
    ],
  },
];
