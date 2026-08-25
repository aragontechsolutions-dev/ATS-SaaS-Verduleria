# Contexto fiscal: IVA en verdulería (Uruguay) — catalogación de productos

> **Para Claude Code / equipo de ATS.**
> Fuente de verdad para configurar la tasa de IVA (`indicador_facturacion`) de
> los productos en el SaaS. Basado en normativa oficial DGI verificada, no en
> interpretación. Cada afirmación tiene su fuente citada.
>
> ⚠️ ADVERTENCIA LEGAL: este documento es una guía técnica para armar los
> DEFAULTS del sistema. La decisión fiscal final de cada producto es
> responsabilidad del contribuyente (la verdulería) y su contador. El sistema
> debe permitir editar la tasa por producto. NO es asesoramiento contable.

---

## 0. Las 3 tasas de IVA en Uruguay

| Tasa | Valor | `indicador_facturacion` (FEU) |
|---|---|---|
| Básica | 22% | 3 |
| Mínima | 10% | 2 |
| Exento / en suspenso | 0% | 1 (exento) / 12 (en suspenso) |

**No confundir "tasa mínima" (10%, clasificación de producto) con "IVA mínimo"
(régimen fiscal del contribuyente, Literal E).** Son cosas distintas.

Fuente: Título 10 del Texto Ordenado de la DGI (TODGI); Decreto 220/998.

---

## 1. La regla central para verdulería

**Frutas, flores y hortalizas en estado natural, vendidas a CONSUMIDOR FINAL,
están gravadas a tasa MÍNIMA (10%). NO están exentas.**

Fuente: Ley 19.407 (24/6/2016) + Artículo 11 del Título 10 TODGI.

Esto significa que en el POS de una verdulería, **la enorme mayoría de las
líneas de venta van con `indicador_facturacion: 2` (10%)**.

### El matiz que define TODO: quién compra
La tasa depende de a quién se le vende:

| A quién se vende | Producto nacional | Producto importado |
|---|---|---|
| **Consumidor final** (mostrador) | **10% (mínima)** | **10% (mínima)** |
| **Empresa / otro contribuyente IRAE** (mayoreo B2B) | **IVA en suspenso** (sin IVA en factura) | **22% (básica)** |
| Entes Autónomos / Servicios Descentralizados del Estado | tratados como empresa (NO consumidor final) | 22% si importado |
| Otros organismos del Estado (ej. escuelas ANEP) | tratados como consumidor final → 10% | 10% |

Fuente: Consulta Tributaria DGI 6440/2022 y 6631/2024; documento oficial DGI
"Tratamiento del IVA en la enajenación de Frutas, Flores y Hortalizas" (dic 2023).

**Implicancia para el sistema:** la tasa NO es solo propiedad del producto —
depende del TIPO DE CLIENTE. Un tomate al mostrador va a 10%; el mismo tomate
vendido a un restaurante (empresa) va con IVA en suspenso (nacional) o 22%
(importado). Ver sección 5 para cómo modelarlo.

### Excepción: venta directa del productor
Si quien vende es el **productor agropecuario** directamente (feria) y no está
obligado a tributar IRAE por contabilidad suficiente, la venta queda con **IVA
en suspenso** (exenta de hecho para el consumidor). Esto NO aplica a una
verdulería común (que es comercio, no productor), pero sí si tu cliente es un
productor que vende en feria.

---

## 2. NÓMINA OFICIAL DE PRODUCTOS (DGI) → categoría "tasa mínima 10%"

Esta es la lista textual del documento oficial de DGI (Boletín 278 + publicación
dic 2023). Sirve como base para precargar el catálogo con la tasa correcta.

### HORTALIZAS / VERDURAS (incluye "verduras" dentro de "hortalizas")
acedera, acelga, achicoria (radicha, radicheta), ajo, albahaca, alcaucil (alcachofa),
arveja, berenjena, berro, boniato, borraja, brotes de soja, cebolla de verdeo,
cebolla seca, coliflor, chícharo, escarola, espárrago, espinaca, frutilla, garbanzo,
grelo, haba, hinojo, hongos (setas), lechuga, lenteja, maíz dulce, nabo, orégano,
papa, pepino, perejil, pimiento (ají), pimiento (morrón), poroto, puerro, rabanito,
rábano, remolacha roja, repollo, salsifí, sandía, tomate, zanahoria, zapallito, zapallo.

> Nota: la frutilla, el melón y la sandía figuran en la lista de hortalizas del
> censo agropecuario aunque el consumidor las considere frutas — a efectos
> fiscales están igual en el grupo de tasa mínima, así que no cambia nada.

### FRUTAS (productos frutícolas)
ananá, bananas, cerezas, ciruelas, damascos, duraznos, frambuesas, granadas,
grosellas, guayabos, higos, kiwis, mangos, manzanas, membrillos, paltas, papayas,
pelones, peras, uvas.

### CÍTRICOS (subgrupo de frutas)
bergamotas, kinotos, limones, limas, mandarinas, naranjas, pomelos.

### FLORES
Todo el conjunto de órganos reproductivos de plantas cultivadas con fines
comerciales (flores de corte, plantas ornamentales). → tasa mínima 10%.

**La lista NO es exhaustiva** (lo dice el propio documento). Si aparece un
producto hortícola/frutícola en estado natural que no está en la lista, se
interpreta que corresponde igual tasa mínima por analogía. Ante la duda, el
contador decide.

---

## 3. Productos que NO son tasa mínima (van a 22% básica)

La verdulería moderna vende cosas que NO son fruta/verdura en estado natural.
Estas van a **tasa básica 22% (`indicador_facturacion: 3`)** salvo que una norma
diga otra cosa:

- Productos **procesados/elaborados**: ensaladas listas para comer (cuarta gama),
  verdura congelada, conservas, encurtidos, dulces, mermeladas.
- **Frutos secos** procesados/envasados (según presentación — consultar contador).
- Productos de **almacén** que la verdulería suela agregar: gaseosas, aguas
  saborizadas, snacks, artículos de limpieza, etc.
- **Flores artificiales** (no son "flores" en el sentido de la norma).

### Productos de tasa mínima 10% por OTRA norma (no por ser fruta/verdura)
La verdulería que amplía a almacén puede vender otros artículos de primera
necesidad que TAMBIÉN son 10% por estar en la lista de alimentos básicos del
Título 10: pan, carnes, pescado, arroz, fideos, aceite, azúcar, yerba, café, té, sal.

Fuente: Título 10 TODGI (lista de tasa mínima).

### Productos EXENTOS (0%, `indicador_facturacion: 1`)
Algunos que una verdulería-almacén podría tocar: **leche** (exenta), libros,
diarios y revistas. → `indicador_facturacion: 1`.

Fuente: Título 10 TODGI.

---

## 4. Categorías DEFAULT propuestas para el SaaS

Precargar estas categorías con su tasa por defecto. El producto hereda la tasa
de su categoría; el contador la puede editar por excepción.

| Categoría | Tasa default | `indicador_facturacion` | Ejemplos |
|---|---|---|---|
| Verduras y hortalizas | Mínima 10% | 2 | lechuga, tomate, papa, cebolla, morrón |
| Frutas | Mínima 10% | 2 | manzana, banana, naranja, kiwi |
| Cítricos | Mínima 10% | 2 | naranja, mandarina, limón, pomelo |
| Flores y plantas | Mínima 10% | 2 | flores de corte |
| Almacén - primera necesidad | Mínima 10% | 2 | arroz, fideos, aceite, yerba, azúcar |
| Almacén - elaborados/envasados | Básica 22% | 3 | gaseosas, snacks, conservas |
| Procesados / cuarta gama | Básica 22% | 3 | ensaladas listas, congelados |
| Lácteos - leche | Exento | 1 | leche |
| Limpieza / varios | Básica 22% | 3 | detergente, bolsas |

> Estos defaults son un PUNTO DE PARTIDA razonable basado en la normativa. Cada
> tenant debe validarlos con su contador en el onboarding.

---

## 5. Cómo modelarlo en el sistema (implicancias técnicas)

### El campo `tasaIva` del producto NO alcanza solo
Como la tasa depende del **tipo de cliente** (consumidor final vs empresa vs
importado), el cálculo real necesita dos entradas:

1. `producto.tasaIvaBase` → la tasa a consumidor final (default de la categoría).
2. `cliente.tipo` → consumidor final / empresa (RUC) / organismo estatal.

**Regla de cálculo al emitir:**
```
si cliente == consumidor_final:
    usar producto.tasaIvaBase        // 10% para fruta/verdura
si cliente == empresa (mayoreo B2B):
    si producto es fruta/verdura/flor nacional en estado natural:
        IVA en suspenso              // sin IVA en la factura
    si producto importado:
        22% básica
    si producto elaborado/almacén:
        su tasa normal (22% o la que aplique)
```

**Para el 95% de la operación (mostrador, consumidor final), es directo: la tasa
base del producto.** La complejidad del suspenso/22% solo aparece en el módulo
de **mayoreo B2B** (e-Factura tipo 111 a clientes con RUC). Se puede dejar para
v1 cuando se construya el módulo mayorista.

### Mapeo a FEU
- `indicador_facturacion` por ítem = la tasa resuelta (1/2/3).
- `cod_montos_brutos` por comprobante = régimen del emisor (1 normal, 3 IVA
  mínimo/Monotributo). Ver CONTEXTO-FEU.md sección 4.
- IVA en suspenso en líneas B2B: confirmar con Surtec el indicador exacto
  (probablemente `12`). ⚠️ PENDIENTE verificar con soporte FEU.

---

## 6. Crédito fiscal (dato para el contador, no para el POS)

La Ley 19.407 faculta un crédito fiscal de hasta **18,03%** sobre el valor de
adquisición de frutas/flores/hortalizas para quienes las vendan a consumidor
final gravadas a tasa > 0. El Poder Ejecutivo lo ejerció solo jul-dic 2016; hoy
NO está vigente de forma general. Es tema del contador del cliente, no del
sistema. Se documenta solo para que no sorprenda.

Fuente: Art. 11 bis Título 10 TODGI; Decretos 303/016, 359/016.

---

## 7. Fuentes oficiales (para verificar/actualizar)

- **Título 10 TODGI** (Texto Ordenado, IVA) — fuente legal madre. Actualización
  dic 2025 disponible en impo.com.uy/bases/todgi-2023.
- **Ley 19.407** (24/6/2016) — IVA a frutas, flores y hortalizas a tasa mínima
  al consumidor final.
- **Decreto 220/998** — reglamentación de tasas y exenciones.
- **Documento oficial DGI "Tratamiento del IVA en la enajenación de Frutas,
  Flores y Hortalizas"** (dic 2023) — contiene la nómina de productos citada
  arriba. gub.uy/direccion-general-impositiva (publicaciones).
- **Consultas Tributarias DGI 6440/2022 y 6631/2024** — resuelven casos de
  mayoreo, importado y venta a organismos del Estado.

⚠️ Toda esta normativa puede cambiar. Antes de un release grande, reconfirmar
contra el TODGI vigente. Las tasas y listas se actualizan por ley.

---

## 8. Resumen accionable

1. Precargar las **categorías default** de la sección 4.
2. Producto hereda `tasaIvaBase` de su categoría; **editable** por el contador.
3. Para mostrador (consumidor final) → usar la tasa base directo. Cubre el 95%.
4. Para mayoreo B2B → lógica de suspenso/22% (módulo v1, no MVP).
5. En el onboarding, **aviso**: "confirmá la configuración fiscal con tu contador".
6. ⚠️ Verificar con Surtec el indicador de IVA en suspenso para líneas B2B.

---

## 9. Motor de IVA (implementado)

El sistema asigna el IVA **automáticamente** por el nombre del producto, para que
el tenant no tenga que saber la clasificación. La configuración es de **Aragon**
(Consola de plataforma), no del tenant.

### Piezas
- **Reglas globales** (`IvaRule`, tabla): `término → { ivaIndicador, esEstadoNatural,
  esImportado, prioridad }`. Administradas en **Consola → Motor de IVA**. Se siembran
  desde la nómina DGI de la sección 2/4 (`prisma/iva-rules.ts`).
- **Clasificador puro** (`@ats/cfe` → `clasificarProducto`): normaliza el nombre
  (minúsculas, sin tildes, plural) y matchea contra las reglas. Ante varios
  matches gana la de **mayor prioridad** y luego el término más largo (más
  específico). Fallback: **mínima 10% + estado natural**.
- **Aplicación**: al crear/editar un producto, el backend clasifica y asigna
  `ivaIndicador/esEstadoNatural/esImportado` (`products.service`).
- **Override del contador**: `Product.ivaOverride`. Si el contador ajusta el IVA
  a mano (panel del tenant → alta de producto → "Ajustar a mano"), el motor **no
  lo reclasifica**. Cumple la exigencia legal de editabilidad por producto.
- **Reclasificar catálogo**: botón en la Consola → reaplica el motor a todos los
  productos **sin override**.

### Deploy (al liberar)
1. Migrar el esquema: `IvaRule` + `Product.ivaOverride/ivaRegla`
   (`npm run push -w @ats/database` en dev; `migrate:deploy` en prod).
2. Sembrar las reglas base: `npm run seed:iva -w @ats/database` (idempotente).
3. (Opcional) En la Consola, "Reclasificar catálogo" para aplicar a productos ya
   cargados que no tengan override.

Las prioridades: 0 = fruta/verdura/flor natural · 5 = almacén 1ª necesidad ·
10 = elaborados/limpieza (ganan cuando el nombre mezcla términos, ej. "salsa de
tomate" → básica por "salsa").
