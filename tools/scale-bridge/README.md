# ATS · Puente de balanza (scale-bridge)

Agente para usar una **balanza de red (UTP/Ethernet)** con el POS.

El POS corre en el navegador y el navegador **no puede abrir conexiones TCP
crudas**. Este puente resuelve eso: se conecta a la balanza por TCP, lee el flujo
de peso y lo **reexpone por WebSocket**, que el POS sí sabe consumir (modo
**En vivo (red/UTP)**).

```
Balanza (TCP :4001)  ──►  scale-bridge (WebSocket :8787)  ──►  POS (navegador)
```

- **Sin dependencias**: solo necesita Node ≥ 18. No hay que instalar nada con npm.
- **No interpreta la trama**: reenvía cada línea tal cual. El POS la parsea con el
  mismo motor que el modo serial (protocolos `generic` y `toledo`).
- **Multi-cliente**: pueden conectarse varias cajas/tablets al mismo puente.
- **Reconecta solo** a la balanza si se apaga o todavía no arrancó.

## Uso

En una PC de la red del comercio (puede ser la misma caja), con la balanza
encendida y con IP fija conocida:

```sh
SCALE_HOST=192.168.1.50 SCALE_PORT=4001 node scale-bridge.mjs
```

Después, en el POS: **⚖ Balanza → En vivo (red/UTP)** y poné la URL:

```
ws://<ip-de-esta-pc>:8787
```

(Si el POS corre en la misma PC que el puente, alcanza `ws://localhost:8787`.)

> Nota HTTPS/WSS: si el POS se sirve por HTTPS, algunos navegadores bloquean
> `ws://` (contenido mixto). En ese caso serví el POS por HTTP en la LAN, o poné
> el puente detrás de un proxy con TLS y usá `wss://`.

### Variables de entorno

| Variable | Default | Qué es |
|---|---|---|
| `SCALE_HOST` | `192.168.1.50` | IP de la balanza en la LAN |
| `SCALE_PORT` | `4001` | Puerto TCP de la balanza |
| `WS_PORT` | `8787` | Puerto WebSocket que consume el POS |
| `WS_HOST` | `0.0.0.0` | Interfaz de escucha (`0.0.0.0` = toda la LAN) |

### Verificar que está vivo

Abrí en el navegador `http://<ip-de-esta-pc>:8787` → responde el estado del
puente (balanza configurada y cantidad de POS conectados).

## Probar sin balanza

Hay una **balanza simulada** para probar end-to-end sin hardware:

```sh
# Terminal 1: balanza falsa que emite peso variando y estabilizando
node mock-scale.mjs                 # protocolo generic en :4001
# PROTOCOL=toledo node mock-scale.mjs   # o formato Toledo

# Terminal 2: el puente apuntando a la balanza falsa
SCALE_HOST=127.0.0.1 SCALE_PORT=4001 node scale-bridge.mjs
```

En el POS elegí **En vivo (red/UTP)**, protocolo acorde (`generic` o `toledo`),
URL `ws://localhost:8787`, y **Conectar**. Deberías ver el peso subir,
estabilizarse (verde) y volver a cero.

## Dejarlo corriendo siempre

- **Linux (systemd)**: creá un service que ejecute `node scale-bridge.mjs` con
  las variables, `Restart=always`.
- **Windows**: una tarea programada al inicio, o [nssm](https://nssm.cc) para
  correrlo como servicio.
- **Raspberry Pi / mini-PC**: opción barata y dedicada; queda prendida en la LAN.

## Balanza serie (COM/USB) servida a la red

Este puente habla **TCP** con la balanza (que es lo que usa el modo red). Si en
cambio tenés una balanza **serie** y querés servirla a varias tablets por red,
lo más simple es usar el modo **En vivo (COM/USB)** directo desde una PC con
Chrome/Edge. Servir una balanza serie sobre la red requeriría agregar una
librería de puerto serie al puente (queda como extensión futura).
