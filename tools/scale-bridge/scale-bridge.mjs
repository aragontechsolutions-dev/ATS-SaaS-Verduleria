#!/usr/bin/env node
// ============================================================================
// ATS · Puente de balanza (scale bridge)
//
// El POS (navegador) no puede abrir TCP crudo, así que para una balanza con
// salida de red (UTP/Ethernet) hace falta un puente: este agente se conecta a
// la balanza por TCP, lee el flujo de peso y lo reexpone por WebSocket. El POS
// se conecta a ws://<ip-de-esta-pc>:<WS_PORT> (modo "En vivo (red/UTP)").
//
// Sin dependencias: usa solo Node (>=18). Corré:
//   SCALE_HOST=192.168.1.50 SCALE_PORT=4001 node scale-bridge.mjs
//
// El puente NO interpreta la trama; reenvía cada línea tal cual. El parsing
// (toledo/generic → kg) lo hace el POS con el mismo parser que el modo serial.
// ============================================================================

import net from 'node:net';
import http from 'node:http';
import crypto from 'node:crypto';

// --- Configuración (por variables de entorno o valores por defecto) ---------
const SCALE_HOST = process.env.SCALE_HOST || '192.168.1.50';
const SCALE_PORT = Number(process.env.SCALE_PORT || 4001); // puerto TCP de la balanza
const WS_PORT = Number(process.env.WS_PORT || 8787); // puerto que consume el POS
const WS_HOST = process.env.WS_HOST || '0.0.0.0'; // 0.0.0.0 = accesible desde la LAN

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const log = (...a) => console.log(new Date().toISOString(), ...a);

// --- Conjunto de clientes WebSocket conectados (los POS) --------------------
/** @type {Set<import('node:net').Socket>} */
const clients = new Set();

/** Reenvía una línea de la balanza a todos los POS conectados. */
function broadcast(line) {
  const frame = encodeTextFrame(line);
  for (const sock of clients) {
    if (!sock.destroyed) sock.write(frame);
  }
}

// ============================================================================
// Servidor WebSocket mínimo (handshake + envío de frames de texto).
// Solo necesitamos ENVIAR texto al POS; del lado del cliente atendemos ping y
// close para mantener la conexión sana. Sin librerías externas.
// ============================================================================
const server = http.createServer((_req, res) => {
  // Endpoint de salud simple para verificar que el puente está vivo.
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(`ATS scale-bridge OK\nbalanza ${SCALE_HOST}:${SCALE_PORT}\nclientes ${clients.size}\n`);
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );

  clients.add(socket);
  log(`POS conectado (${clients.size} en total) desde ${req.socket.remoteAddress}`);

  socket.on('data', (buf) => handleClientFrames(socket, buf));
  const cleanup = () => {
    if (clients.delete(socket)) log(`POS desconectado (${clients.size} quedan)`);
  };
  socket.on('close', cleanup);
  socket.on('error', cleanup);
});

/** Atiende frames entrantes del POS: responde ping y cierra si pide close. */
function handleClientFrames(socket, buf) {
  let offset = 0;
  while (offset + 2 <= buf.length) {
    const opcode = buf[offset] & 0x0f;
    const masked = (buf[offset + 1] & 0x80) !== 0;
    let len = buf[offset + 1] & 0x7f;
    let pos = offset + 2;
    if (len === 126) {
      if (pos + 2 > buf.length) break;
      len = buf.readUInt16BE(pos);
      pos += 2;
    } else if (len === 127) {
      if (pos + 8 > buf.length) break;
      len = Number(buf.readBigUInt64BE(pos));
      pos += 8;
    }
    const maskKey = masked ? buf.subarray(pos, pos + 4) : null;
    if (masked) pos += 4;
    if (pos + len > buf.length) break; // frame incompleto
    const payload = buf.subarray(pos, pos + len);
    if (masked && maskKey) {
      for (let i = 0; i < payload.length; i++) payload[i] ^= maskKey[i & 3];
    }
    if (opcode === 0x8) {
      // close
      socket.end();
      return;
    } else if (opcode === 0x9) {
      // ping → pong (opcode 0xA)
      socket.write(encodeFrame(0xa, payload));
    }
    offset = pos + len;
  }
}

/** Codifica un frame de texto (server→client, sin máscara). */
function encodeTextFrame(text) {
  return encodeFrame(0x1, Buffer.from(text, 'utf8'));
}

function encodeFrame(opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

server.listen(WS_PORT, WS_HOST, () => {
  log(`Puente WebSocket escuchando en ws://${WS_HOST}:${WS_PORT}`);
  log(`En el POS (Balanza → En vivo red/UTP) poné: ws://<ip-de-esta-pc>:${WS_PORT}`);
});

// ============================================================================
// Cliente TCP hacia la balanza. Lee líneas y las reenvía. Reconecta con backoff
// si la balanza se cae o todavía no está encendida.
// ============================================================================
let scale = null;
let backoff = 1000; // ms, hasta 15s
let acc = ''; // acumulador de líneas parciales

function connectScale() {
  scale = net.createConnection({ host: SCALE_HOST, port: SCALE_PORT }, () => {
    backoff = 1000;
    log(`Balanza conectada en ${SCALE_HOST}:${SCALE_PORT}`);
  });

  scale.setEncoding('utf8');

  scale.on('data', (chunk) => {
    acc += chunk;
    // Cortamos por saltos de línea (\r\n, \n o \r). Las balanzas emiten una
    // trama por línea; guardamos el resto parcial para el próximo chunk.
    const parts = acc.split(/\r\n|\n|\r/);
    acc = parts.pop() ?? '';
    for (const line of parts) {
      const t = line.trim();
      if (t) broadcast(t);
    }
  });

  scale.on('close', () => {
    log(`Balanza desconectada; reintentando en ${backoff / 1000}s`);
    scheduleReconnect();
  });
  scale.on('error', (err) => {
    log(`Error de balanza: ${err.message}`);
    // 'close' se dispara a continuación y agenda el reintento.
  });
}

function scheduleReconnect() {
  if (scale) {
    scale.removeAllListeners();
    scale.destroy();
    scale = null;
  }
  setTimeout(connectScale, backoff);
  backoff = Math.min(backoff * 2, 15000);
}

connectScale();

// Cierre ordenado.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    log('Cerrando puente…');
    for (const c of clients) c.destroy();
    if (scale) scale.destroy();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000);
  });
}
