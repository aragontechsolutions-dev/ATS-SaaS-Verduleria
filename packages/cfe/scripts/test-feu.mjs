#!/usr/bin/env node
/**
 * ============================================================================
 * PRUEBA END-TO-END — API FEU (Surtec) — AMBIENTE DE TEST
 * ============================================================================
 *
 * Qué hace este script (en orden):
 *   1. Autentica con usuario/contraseña -> obtiene access_token + refresh_token
 *   2. Emite un e-Ticket (tipo 101, consumidor final) simulando una venta
 *      de verdulería con IVA tasa mínima (10%)
 *   3. Consulta el estado del comprobante en DGI
 *   4. Descarga el PDF en formato ticket 80mm y lo guarda en disco
 *
 * IMPORTANTE:
 *   - Es un script AISLADO, no toca tu proyecto NestJS. Es solo para validar
 *     que las credenciales y el flujo funcionan antes de diseñar la arquitectura.
 *   - Usa fetch nativo de Node 22 (sin dependencias externas).
 *   - Las credenciales de TEST vienen del correo de Surtec.
 *
 * Cómo correrlo:
 *   node test-feu.mjs
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// CONFIGURACIÓN (credenciales de TEST del correo de Surtec)
// ---------------------------------------------------------------------------
const CONFIG = {
  authUrl: "https://auth-test.facturaelectronica.com.uy/token",
  apiBase: "https://api-test.facturaelectronica.com.uy",
  username: "api-feu@acme-api.com",
  password: "OiJSUzx1.DS",
  rutEmisor: "218617380010", // RUT de la empresa de prueba
  sucursal: 1,
};

// Colorcitos para que se lea lindo en la terminal
const c = {
  reset: "\x1b[0m", green: "\x1b[32m", red: "\x1b[31m",
  yellow: "\x1b[33m", cyan: "\x1b[36m", gray: "\x1b[90m", bold: "\x1b[1m",
};
const log = {
  step: (n, t) => console.log(`\n${c.bold}${c.cyan}[PASO ${n}] ${t}${c.reset}`),
  ok: (t) => console.log(`${c.green}✓ ${c.reset}${t}`),
  err: (t) => console.log(`${c.red}✗ ${c.reset}${t}`),
  info: (t) => console.log(`${c.gray}  ${t}${c.reset}`),
  json: (o) => console.log(c.gray + JSON.stringify(o, null, 2) + c.reset),
};

// ---------------------------------------------------------------------------
// PASO 1 — AUTENTICAR
// ---------------------------------------------------------------------------
async function autenticar() {
  log.step(1, "Autenticando (usuario + contraseña)");
  log.info(`POST ${CONFIG.authUrl}`);

  const res = await fetch(CONFIG.authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "password",
      username: CONFIG.username,
      password: CONFIG.password,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    log.err(`Falló autenticación (HTTP ${res.status})`);
    log.json(data);
    throw new Error("No se pudo autenticar");
  }

  log.ok("Token obtenido correctamente");
  log.info(`token_type: ${data.token_type}`);
  log.info(`access_token: ${data.access_token?.slice(0, 30)}...`);
  log.info(`refresh_token: ${data.refresh_token?.slice(0, 30)}...`);
  return data;
}

// ---------------------------------------------------------------------------
// PASO 2 — EMITIR e-TICKET (venta de verdulería, IVA mínimo 10%)
// ---------------------------------------------------------------------------
async function emitirETicket(accessToken) {
  log.step(2, "Emitiendo e-Ticket (venta simulada de verdulería)");

  // id_externo = token de idempotencia. En tu SaaS real, esto será el
  // sale_id de tu tabla de ventas. Si reintentás con el mismo id_externo,
  // FEU devuelve el comprobante original en vez de duplicarlo.
  const idExterno = `ATS-TEST-${Date.now()}`;

  const comprobante = {
    sucursal: CONFIG.sucursal,
    tipo_comprobante: 101, // e-Ticket (consumidor final)
    forma_pago: 1,         // 1 = Contado
    moneda: "UYU",
    cod_montos_brutos: 1,  // 1 = las líneas van con IVA incluido
    id_externo: idExterno,
    items: [
      {
        concepto: "Tomate perita",
        unidad: "kg",
        cantidad: 2.5,
        precio: 89.0,
        indicador_facturacion: 2, // 2 = Tasa mínima (10%) — frutas y verduras
      },
      {
        concepto: "Lechuga mantecosa",
        unidad: "un",
        cantidad: 3,
        precio: 45.0,
        indicador_facturacion: 2, // 2 = Tasa mínima (10%)
      },
      {
        concepto: "Papa lavada",
        unidad: "kg",
        cantidad: 5,
        precio: 52.0,
        indicador_facturacion: 2, // 2 = Tasa mínima (10%)
      },
    ],
    adenda: { texto: "Gracias por su compra - Prueba ATS" },
  };

  log.info(`POST ${CONFIG.apiBase}/comprobantes/crear`);
  log.info(`X-Emisor: ${CONFIG.rutEmisor}`);
  log.info(`id_externo (idempotencia): ${idExterno}`);
  console.log(c.gray + "  Payload enviado:" + c.reset);
  log.json(comprobante);

  const res = await fetch(`${CONFIG.apiBase}/comprobantes/crear`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Emisor": CONFIG.rutEmisor,
    },
    body: JSON.stringify(comprobante),
  });

  const data = await res.json();

  if (!res.ok) {
    log.err(`Falló la emisión (HTTP ${res.status})`);
    log.json(data);
    throw new Error("No se pudo emitir el comprobante");
  }

  log.ok("e-Ticket emitido correctamente");
  console.log(c.gray + "  Respuesta:" + c.reset);
  log.json(data);
  log.info(`>> Serie-Número: ${data.serie}-${data.numero}`);
  log.info(`>> CAE: ${data.cae_numero}`);
  log.info(`>> URL QR DGI: ${data.url}`);
  return data;
}

// ---------------------------------------------------------------------------
// PASO 3 — CONSULTAR ESTADO EN DGI
// ---------------------------------------------------------------------------
async function consultarEstado(accessToken) {
  log.step(3, "Consultando estado en DGI (comprobantes emitidos hoy)");

  const hoy = new Date().toISOString().slice(0, 10); // AAAA-MM-DD
  const url = `${CONFIG.apiBase}/consulta/comprobantes/emitidos?FechaDesde=${hoy}&FechaHasta=${hoy}`;

  log.info(`GET ${url}`);
  log.info(`X-Emisor: ${CONFIG.rutEmisor}`);
  log.info("Nota: DGI puede demorar en devolver el estado. Si sale vacío,");
  log.info("es normal: en producción se consulta con polling tras un intervalo.");

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Emisor": CONFIG.rutEmisor,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    log.err(`Falló la consulta (HTTP ${res.status})`);
    log.json(data);
    return null;
  }

  const lista = data.comprobantes || data.items || data || [];
  const cantidad = Array.isArray(lista) ? lista.length : "?";
  log.ok(`Consulta OK — ${cantidad} comprobante(s) encontrado(s)`);

  // Mostramos solo el/los más recientes para no llenar la pantalla
  if (Array.isArray(lista) && lista.length > 0) {
    const ultimo = lista[lista.length - 1];
    log.info("Último comprobante:");
    log.json({
      serie: ultimo.serie,
      numero: ultimo.numero,
      estado_dgi: ultimo.estado_dgi || ultimo.estado,
    });
  }
  return data;
}

// ---------------------------------------------------------------------------
// PASO 4 — DESCARGAR PDF (ticket 80mm)
// ---------------------------------------------------------------------------
async function descargarPDF(accessToken, cfeId) {
  log.step(4, "Descargando PDF (formato ticket 80mm)");

  const url = `${CONFIG.apiBase}/comprobantes/${cfeId}/pdf?tipo=ticket80`;
  log.info(`GET ${url}`);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Emisor": CONFIG.rutEmisor,
    },
  });

  if (!res.ok) {
    log.err(`Falló la descarga del PDF (HTTP ${res.status})`);
    try { log.json(await res.json()); } catch { log.info(await res.text()); }
    return;
  }

  // IMPORTANTE: FEU NO devuelve el PDF binario directo. Devuelve un JSON:
  //   { "file_name": "...", "mime_type": "application/pdf",
  //     "format": "base64", "data": "<PDF codificado en base64>" }
  // Por eso hay que parsear el JSON y decodificar el campo 'data'.
  const respuesta = await res.json();

  if (respuesta.format !== "base64" || !respuesta.data) {
    log.err("La respuesta del PDF no tiene el formato esperado.");
    log.json(respuesta);
    return;
  }

  // Decodificar el base64 -> bytes reales del PDF
  const buffer = Buffer.from(respuesta.data, "base64");

  const fs = await import("node:fs");
  const pathMod = await import("node:path");
  const url2 = await import("node:url");

  // Guardar en la MISMA carpeta del script (portable: Windows/Mac/Linux).
  const dirScript = pathMod.dirname(url2.fileURLToPath(import.meta.url));
  const rutaPdf = pathMod.join(dirScript, `ticket-${cfeId}.pdf`);
  fs.writeFileSync(rutaPdf, buffer);

  // Verificación: un PDF válido siempre empieza con "%PDF"
  const firma = buffer.subarray(0, 4).toString("latin1");
  if (firma !== "%PDF") {
    log.err(`El archivo decodificado NO parece un PDF válido (empieza con "${firma}")`);
    return;
  }

  log.ok(`PDF guardado (${buffer.length} bytes) — firma válida "%PDF"`);
  log.info(`Nombre sugerido por FEU: ${respuesta.file_name}`);
  log.info(`Archivo: ${rutaPdf}`);
  log.info("Abrilo con doble clic desde el explorador de archivos.");
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  console.log(`${c.bold}${c.yellow}`);
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║   PRUEBA API FEU (Surtec) — AMBIENTE DE TEST        ║");
  console.log("║   Aragon Tech Solutions                            ║");
  console.log("╚════════════════════════════════════════════════════╝");
  console.log(c.reset);

  try {
    const auth = await autenticar();
    const emitido = await emitirETicket(auth.access_token);
    await consultarEstado(auth.access_token);
    await descargarPDF(auth.access_token, emitido.id);

    console.log(`\n${c.bold}${c.green}════════════════════════════════════════════════════`);
    console.log("  ✓ PRUEBA COMPLETA — todo el flujo funcionó");
    console.log(`════════════════════════════════════════════════════${c.reset}\n`);
  } catch (err) {
    console.log(`\n${c.bold}${c.red}════════════════════════════════════════════════════`);
    console.log(`  ✗ LA PRUEBA FALLÓ: ${err.message}`);
    console.log(`════════════════════════════════════════════════════${c.reset}\n`);
    process.exitCode = 1;
  }
}

main();
