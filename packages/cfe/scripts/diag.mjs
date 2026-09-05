#!/usr/bin/env node
/**
 * DIAGNÓSTICO DEL PDF DE FEU
 * --------------------------
 * No emite comprobantes nuevos. Autentica, emite UNO, y después inspecciona
 * en detalle qué devuelve el endpoint /pdf para entender por qué sale corrupto.
 *
 * Correr:  node diag.mjs
 */

// Credenciales por entorno (NO hardcodear):
//   FEU_USER=... FEU_PASS='...' FEU_RUT=218617380010 node diag.mjs
const CONFIG = {
  authUrl: process.env.FEU_AUTH_URL || "https://auth-test.facturaelectronica.com.uy/token",
  apiBase: process.env.FEU_API_BASE || "https://api-test.facturaelectronica.com.uy",
  username: process.env.FEU_USER,
  password: process.env.FEU_PASS,
  rutEmisor: process.env.FEU_RUT || "218617380010",
  sucursal: Number(process.env.FEU_SUCURSAL || "1"),
};

if (!CONFIG.username || !CONFIG.password) {
  console.error("Faltan credenciales: definí FEU_USER y FEU_PASS en el entorno.");
  process.exit(1);
}

async function main() {
  // 1. Auth
  const authRes = await fetch(CONFIG.authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "password",
      username: CONFIG.username,
      password: CONFIG.password,
    }),
  });
  const auth = await authRes.json();
  const token = auth.access_token;
  console.log("✓ Autenticado\n");

  // 2. Emitir uno para tener un id fresco
  const emitRes = await fetch(`${CONFIG.apiBase}/comprobantes/crear`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Emisor": CONFIG.rutEmisor,
    },
    body: JSON.stringify({
      sucursal: 1,
      tipo_comprobante: 101,
      forma_pago: 1,
      moneda: "UYU",
      cod_montos_brutos: 1,
      id_externo: `DIAG-${Date.now()}`,
      items: [{ concepto: "Tomate", unidad: "kg", cantidad: 1, precio: 89, indicador_facturacion: 2 }],
    }),
  });
  const emitido = await emitRes.json();
  const cfeId = emitido.id;
  console.log(`✓ Emitido comprobante id=${cfeId} (A-${emitido.numero})\n`);

  // 3. INSPECCIÓN DEL ENDPOINT PDF -----------------------------------------
  console.log("═══ INSPECCIÓN DEL PDF ═══\n");

  const pdfRes = await fetch(`${CONFIG.apiBase}/comprobantes/${cfeId}/pdf?tipo=ticket80`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Emisor": CONFIG.rutEmisor,
    },
  });

  // 3a. Headers de la respuesta
  console.log("STATUS:", pdfRes.status);
  console.log("CONTENT-TYPE:", pdfRes.headers.get("content-type"));
  console.log("CONTENT-LENGTH:", pdfRes.headers.get("content-length"));
  console.log("");

  // 3b. Cuerpo crudo como bytes
  const buffer = Buffer.from(await pdfRes.arrayBuffer());
  console.log("TAMAÑO REAL RECIBIDO:", buffer.length, "bytes");

  // 3c. Primeros bytes en varias representaciones
  const primeros16 = buffer.subarray(0, 16);
  console.log("PRIMEROS 16 BYTES (hex):", primeros16.toString("hex"));
  console.log("PRIMEROS 16 BYTES (texto):", JSON.stringify(primeros16.toString("latin1")));
  console.log("");

  // 3d. Diagnóstico automático
  const comoTexto = buffer.subarray(0, 100).toString("utf8");
  const empiezaPDF = buffer.subarray(0, 4).toString("latin1") === "%PDF";
  const pareceBase64 = /^[A-Za-z0-9+/=\s]+$/.test(buffer.subarray(0, 200).toString("latin1"));
  const pareceJSON = comoTexto.trimStart().startsWith("{") || comoTexto.trimStart().startsWith("[");

  console.log("═══ DIAGNÓSTICO ═══\n");
  if (empiezaPDF) {
    console.log("→ Es un PDF BINARIO DIRECTO y válido (empieza con %PDF).");
    console.log("  Si igual sale corrupto al abrir, el problema es cómo se ESCRIBE el archivo.");
  } else if (pareceJSON) {
    console.log("→ ¡NO es un PDF! La API devolvió un JSON (probablemente un error).");
    console.log("  Contenido:");
    console.log(buffer.toString("utf8").slice(0, 500));
  } else if (pareceBase64) {
    console.log("→ El PDF viene en BASE64. Hay que decodificarlo ANTES de guardar.");
    console.log("  Solución: Buffer.from(texto, 'base64') antes de escribir el archivo.");
    // Probamos a decodificar y verificar
    try {
      const decoded = Buffer.from(buffer.toString("latin1"), "base64");
      const firmaDecoded = decoded.subarray(0, 4).toString("latin1");
      console.log(`  Al decodificar base64, empieza con: "${firmaDecoded}"`);
      if (firmaDecoded === "%PDF") {
        console.log("  ✓ CONFIRMADO: es base64 de un PDF. Guardando versión decodificada...");
        const fs = await import("node:fs");
        const p = await import("node:path");
        const u = await import("node:url");
        const dir = p.dirname(u.fileURLToPath(import.meta.url));
        const ruta = p.join(dir, `ticket-DECODED-${cfeId}.pdf`);
        fs.writeFileSync(ruta, decoded);
        console.log(`  ✓ Guardado PDF decodificado en: ${ruta}`);
        console.log("  → Abrí ESE archivo. Si abre bien, ya sabemos la solución.");
      }
    } catch (e) {
      console.log("  No se pudo decodificar como base64:", e.message);
    }
  } else {
    console.log("→ Formato desconocido. Primeros bytes no coinciden con PDF, JSON ni base64.");
    console.log("  Content-Type era:", pdfRes.headers.get("content-type"));
  }
}

main().catch((e) => console.error("ERROR:", e.message));
