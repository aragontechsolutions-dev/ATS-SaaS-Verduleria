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

- **Manual** y **etiqueta** ya andaban: son la opción más robusta y sin
  dependencias. La mayoría de las verdulerías uruguayas usan etiquetadora.
- **En vivo por COM/USB**: el navegador puede leer un puerto serie con la
  **Web Serial API** (Chrome/Edge, requiere HTTPS y un gesto del usuario para
  dar permiso al puerto). Ideal para balanzas de mostrador conectadas por USB.
- **En vivo por red (UTP)**: el navegador **no** puede abrir TCP crudo, así que
  una balanza de red necesita un **puente**: un agente chico corriendo en una PC
  de la LAN que lee la balanza (TCP/serie) y la reexpone por WebSocket. El POS
  se conecta a `ws://<ip-local>:puerto`. Es la opción más flexible pero la que
  más infraestructura pide; por eso queda como paso siguiente (el POS ya trae el
  modo, falta empaquetar el agente).

## Protocolos de trama (modos en vivo)

El parser (`apps/pos/src/lib/scale.ts`, cubierto por tests) entiende:

- **toledo**: tramas separadas por coma tipo `ST,GS,+001.234kg` (Mettler-Toledo
  y compatibles). `ST` = estable, `US` = inestable.
- **generic**: cualquier línea con un número y unidad (`1.234 kg`, `0,750 kg`,
  `1500 g`). Marca inestable si aparece `US`. Sirve para la mayoría en modo texto.

Cuando la lectura es **estable**, el modal de pesaje la resalta en verde y con un
toque toma el peso. Si no hay balanza en vivo, se cae al ingreso manual.

## Configurar

1. En el POS, tocar **⚖ Balanza** en la barra superior.
2. Elegir el tipo. Para los modos en vivo: protocolo, y velocidad (serial) o URL
   del puente (red).
3. **Conectar balanza** (en serial, el navegador pide permiso del puerto una vez).
