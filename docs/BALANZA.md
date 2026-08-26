# Balanza — modos de operación

Cada verdulería tiene una balanza distinta. El POS soporta cuatro modos y **se
configura por dispositivo** (botón ⚖ en la barra del POS → se guarda en el
`localStorage` de esa caja, no en la base). Así cada cliente elige lo que tiene,
sin que dependa del servidor.

| Modo | Para qué balanza | Cómo funciona | Requisitos |
|---|---|---|---|
| **Manual** | Solo muestra el peso (display) | El cajero lee y escribe el peso; el POS calcula el precio | Ninguno |
| **Etiqueta con código** | Etiquetadora (Systel/Kretz…) | Imprime un EAN con el peso embebido; el cajero lo **escanea** | Lector de código |
| **En vivo (COM/USB)** | Con puerto serie | El POS lee el flujo de peso por **Web Serial** y lo autocompleta | Chrome/Edge de escritorio |
| **En vivo (red/UTP)** | Con salida de red | El POS se conecta por **WebSocket** a un puente local que expone la balanza | Agente puente en la LAN |

## Por qué así

- **Manual** y **etiqueta** son la opción más robusta y sin dependencias. La
  mayoría de las verdulerías uruguayas usan etiquetadora.
- **En vivo por COM/USB**: el navegador puede leer un puerto serie con la
  **Web Serial API** (Chrome/Edge, requiere HTTPS y un gesto del usuario para
  dar permiso al puerto). Ideal para balanzas de mostrador conectadas por USB.
- **En vivo por red (UTP)**: el navegador **no** puede abrir TCP crudo, así que
  una balanza de red necesita un **puente**: un agente chico corriendo en una PC
  de la LAN que lee la balanza (TCP) y la reexpone por WebSocket. El POS se
  conecta a `ws://<ip-local>:puerto`. Ese agente ya está listo en
  [`tools/scale-bridge`](../tools/scale-bridge/) (sin dependencias, solo Node).

---

## 1) Etiqueta con código (recomendado para arrancar)

La balanza etiquetadora pesa el producto e imprime un **EAN-13 de peso variable**
con prefijo 20–29 (rango de distribución restringida GS1) que embebe el **PLU**
del producto y el **peso** (o el importe). El cajero lo escanea con un lector
común; el POS **no le habla a la balanza**.

Formato típico (configurable en el modal): `PP CCCCC VVVVV K`

- `PP` = prefijo de peso variable (2 díg, 20–29)
- `CCCCC` = PLU del producto (5 díg por defecto)
- `VVVVV` = peso o importe embebido (5 díg, decimales implícitos)
- `K` = dígito verificador EAN-13

En **Balanza → Etiqueta con código** se ajustan los dígitos del PLU/valor, los
decimales y los prefijos, y hay un **probador**: escaneás o pegás una etiqueta y
verifica que salga el PLU y el peso correctos. Los valores por defecto (PLU 5
díg, peso 5 díg con 3 decimales, prefijos 20–29) cubren la mayoría de las
etiquetadoras (Systel, Kretz, etc.).

> **Cada producto pesable debe tener el mismo PLU en el Panel y en la balanza.**

### Lector recomendado

Un lector **USB-HID** (se comporta como teclado, plug-and-play, sin drivers)
alcanza. El POS lo escucha con `useScanner`. Para caja conviene uno **2D con
soporte fijo / manos libres** (p. ej. **SUNLUX XL-Scan XL-2600A 2D USB**): lee el
EAN-13 de la etiqueta y también QR/2D (útil a futuro), y al tener soporte se
apoya el producto y lee solo.

## 2) En vivo (COM/USB) — `serial`

La balanza emite un **flujo continuo de peso** por puerto serie (RS-232 o USB
que se presenta como COM). El POS lo lee con la **Web Serial API**:

1. En **Balanza → En vivo (COM/USB)** se elige **protocolo** y **velocidad
   (baudios)** (común: 9600) y se toca **Conectar balanza**.
2. El navegador pide permiso del puerto (una sola vez).
3. Cada línea se parsea con `parseScaleFrame` y el peso aparece en vivo; al
   pesar un producto, el modal muestra el peso llegando en tiempo real y se
   toma con un toque (idealmente cuando marca **estable**).

**Solo funciona en Chrome/Edge de escritorio** (no en la mayoría de celulares y
tablets, ni en Safari/Firefox). El modal avisa si el navegador no lo soporta.

## 3) En vivo (red/UTP) — `network`

La balanza tiene **salida Ethernet** y emite el peso por TCP en la LAN. Como el
navegador no abre TCP crudo, se usa el **agente puente** de
[`tools/scale-bridge`](../tools/scale-bridge/): se conecta a la balanza por TCP
y reexpone el flujo por **WebSocket**.

```
Balanza (TCP :4001)  ──►  scale-bridge (WebSocket :8787)  ──►  POS (navegador)
```

1. En una PC de la LAN: `SCALE_HOST=192.168.1.50 SCALE_PORT=4001 node scale-bridge.mjs`
2. En **Balanza → En vivo (red/UTP)** poné `ws://<ip-de-esa-pc>:8787` y **Conectar**.

El puente **reusa el mismo parser** que el modo serial, así que funciona en
**cualquier navegador/dispositivo** (tablets incluidas). Trae una **balanza
simulada** (`mock-scale.mjs`) para probar sin hardware. Detalle completo,
variables y cómo dejarlo como servicio en el
[README del puente](../tools/scale-bridge/README.md).

---

## Protocolos de trama (modos en vivo)

El parser (`apps/pos/src/lib/scale.ts`, cubierto por tests) entiende:

- **toledo**: tramas separadas por coma tipo `ST,GS,+001.234kg` (Mettler-Toledo
  y compatibles). `ST` = estable, `US` = inestable.
- **generic**: cualquier línea con un número y unidad (`1.234 kg`, `0,750 kg`,
  `1500 g`). Marca inestable si aparece `US`. Sirve para la mayoría en modo texto.

Cuando la lectura es **estable**, el modal de pesaje la resalta en verde y con un
toque toma el peso. Si no hay balanza en vivo, se cae al ingreso manual.

## Cómo elegir

| Si tenés… | Usá | Dónde corre el POS | Puente |
|---|---|---|---|
| Etiquetadora + lector | **Etiqueta con código** | Cualquiera (PC, tablet, celu) | No |
| Balanza con puerto serie/USB | **En vivo (COM/USB)** | Solo Chrome/Edge de escritorio | No |
| Balanza con Ethernet | **En vivo (red/UTP)** | Cualquiera | Sí (agente local) |
| Cualquiera / sin integración | **Manual** | Cualquiera | No |

Para arrancar simple y barato: **etiquetadora + lector 2D USB**. No requiere PC
dedicada ni agente puente.
