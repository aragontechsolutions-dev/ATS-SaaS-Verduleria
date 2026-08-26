#!/usr/bin/env node
// ============================================================================
// Balanza simulada (para probar el puente sin hardware).
//
// Levanta un servidor TCP que emite tramas de peso como lo haría una balanza
// de red. Sirve para verificar el puente y el POS end-to-end.
//
//   node mock-scale.mjs            # protocolo genérico en :4001
//   PROTOCOL=toledo node mock-scale.mjs
//
// Luego, en otra terminal:
//   SCALE_HOST=127.0.0.1 SCALE_PORT=4001 node scale-bridge.mjs
// y en el POS: Balanza → En vivo (red/UTP) → ws://localhost:8787
// ============================================================================

import net from 'node:net';

const PORT = Number(process.env.SCALE_PORT || 4001);
const PROTOCOL = process.env.PROTOCOL || 'generic'; // 'generic' | 'toledo'

// Simula un peso que sube, se estabiliza y vuelve a cero (como apoyar y sacar).
function* pesos() {
  while (true) {
    const objetivo = 0.2 + Math.random() * 2; // entre 0.2 y 2.2 kg
    let w = 0;
    for (let i = 0; i < 8; i++) {
      w = objetivo * (i / 7) + (Math.random() - 0.5) * 0.02;
      yield { kg: Math.max(0, w), stable: false };
    }
    for (let i = 0; i < 10; i++) yield { kg: objetivo, stable: true }; // estable
    for (let i = 0; i < 4; i++) yield { kg: 0, stable: true }; // sacan el producto
  }
}

function trama(kg, stable) {
  const val = kg.toFixed(3);
  if (PROTOCOL === 'toledo') {
    return `${stable ? 'ST' : 'US'},GS,+${val}kg`;
  }
  return `${val} kg${stable ? '' : ' US'}`;
}

const server = net.createServer((sock) => {
  console.log('Puente conectado a la balanza simulada');
  const gen = pesos();
  const timer = setInterval(() => {
    const { value } = gen.next();
    sock.write(trama(value.kg, value.stable) + '\r\n');
  }, 200);
  sock.on('close', () => clearInterval(timer));
  sock.on('error', () => clearInterval(timer));
});

server.listen(PORT, () => {
  console.log(`Balanza simulada (${PROTOCOL}) escuchando en tcp://0.0.0.0:${PORT}`);
});
