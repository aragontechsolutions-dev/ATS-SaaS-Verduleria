// Tests del FeuProvider con fetch mockeado (sin red real).
// Ejecutar: npm run build -w @ats/cfe && npm test -w @ats/cfe

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FeuProvider } from './feu.provider';
import { toFeuPayload } from './feu.mapper';
import type { CfeInput } from '../types';

// JWT falso con exp lejano (no valida firma; solo decodifica el payload).
function fakeJwt(expSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64url');
  return `${header}.${payload}.sig`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const VENTA: CfeInput = {
  tipo: 'E_TICKET',
  idExterno: 'ATS-SALE-123',
  formaPago: 'CONTADO',
  codMontosBrutos: 1,
  items: [
    { concepto: 'Tomate perita', unidad: 'kg', cantidad: 2.5, precio: 89, iva: 'MINIMA' },
    { concepto: 'Lechuga mantecosa', unidad: 'un', cantidad: 3, precio: 45, iva: 'MINIMA' },
  ],
  adenda: 'Gracias por su compra',
};

test('toFeuPayload mapea dominio → códigos DGI/FEU', () => {
  const p = toFeuPayload(VENTA);
  assert.equal(p.tipo_comprobante, 101);
  assert.equal(p.forma_pago, 1);
  assert.equal(p.cod_montos_brutos, 1);
  assert.equal(p.moneda, 'UYU');
  assert.equal(p.id_externo, 'ATS-SALE-123');
  assert.equal(p.items[0].indicador_facturacion, 2); // MINIMA → 2 (10%)
  assert.equal(p.adenda?.texto, 'Gracias por su compra');
});

test('emitir: autentica una vez y envía X-Emisor + payload correcto', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init: init ?? undefined });
    if (url.endsWith('/token')) {
      return jsonResponse({ access_token: fakeJwt(Date.now() / 1000 + 3600), token_type: 'bearer', refresh_token: 'r1' });
    }
    if (url.endsWith('/comprobantes/crear')) {
      const emisor = (init?.headers as Record<string, string>)['X-Emisor'];
      assert.equal(emisor, '218617380010');
      return jsonResponse({
        id: 539072,
        id_externo: 'ATS-SALE-123',
        comprobante_tipo: 101,
        serie: 'A',
        numero: 878,
        importe_total: 617.5,
        hash: 'k7LIZ...=',
        cae_numero: 90231398919,
        cae_rango_inicio: 1,
        cae_rango_final: 9999999,
        cae_vencimiento: '2050-12-31T00:00:00',
        url: 'https://www.efactura.dgi.gub.uy/consultaQR/cfe?...',
      });
    }
    throw new Error(`URL inesperada: ${url}`);
  };

  const provider = new FeuProvider({ username: 'u', password: 'p', fetchImpl });
  const res = await provider.emitir('218617380010', VENTA);

  assert.equal(res.providerId, 539072);
  assert.equal(res.serie, 'A');
  assert.equal(res.numero, 878);
  assert.equal(res.caeNumero, '90231398919');
  assert.ok(calls.some((c) => c.url.endsWith('/token')));
});

test('emitir con cliente: manda los nombres de campo que exige FEU', async () => {
  let bodyEnviado: Record<string, unknown> = {};
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/token')) return jsonResponse({ access_token: fakeJwt(Date.now() / 1000 + 3600), token_type: 'bearer', refresh_token: 'r' });
    if (url.endsWith('/comprobantes/crear')) {
      bodyEnviado = JSON.parse(String(init?.body));
      return jsonResponse({ id: 1, id_externo: 'x', comprobante_tipo: 111, serie: 'A', numero: 1, importe_total: 0, hash: '', cae_numero: 1, cae_rango_inicio: 1, cae_rango_final: 1, cae_vencimiento: '2050-01-01T00:00:00', url: '' });
    }
    throw new Error(`URL inesperada: ${url}`);
  };
  const provider = new FeuProvider({ username: 'u', password: 'p', fetchImpl });
  await provider.emitir('218617380010', {
    ...VENTA,
    tipo: 'E_FACTURA',
    cliente: { tipoDocumento: 'RUC', documento: '21-861738-0010', nombre: 'Ana', razonSocial: 'ALMACEN SRL', direccion: 'Calle 1' },
  });
  const cliente = bodyEnviado.cliente as Record<string, unknown>;
  assert.equal(cliente.tipo_doc, 2); // RUC
  assert.equal(cliente.cod_pais_doc, 'UY');
  assert.equal(cliente.nro_doc, '218617380010'); // sin guiones
  assert.equal(cliente.denominacion, 'ALMACEN SRL');
  assert.ok(!('tipo_documento' in cliente) && !('razon_social' in cliente), 'no manda los nombres viejos');
});

test('request reintenta una vez ante 401 renovando token', async () => {
  let creado = false;
  let tokens = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/token')) {
      tokens++;
      return jsonResponse({ access_token: fakeJwt(Date.now() / 1000 + 3600), token_type: 'bearer', refresh_token: 'r' });
    }
    if (url.endsWith('/comprobantes/crear')) {
      if (!creado) {
        creado = true;
        return jsonResponse({ error: 'token expirado' }, 401);
      }
      return jsonResponse({ id: 1, id_externo: 'x', comprobante_tipo: 101, serie: 'A', numero: 1, importe_total: 0, hash: '', cae_numero: 1, cae_rango_inicio: 1, cae_rango_final: 1, cae_vencimiento: '2050-01-01T00:00:00', url: '' });
    }
    throw new Error(`URL inesperada: ${url}`);
  };
  const provider = new FeuProvider({ username: 'u', password: 'p', fetchImpl });
  const res = await provider.emitir('218617380010', VENTA);
  assert.equal(res.providerId, 1);
  assert.equal(tokens, 2, 'debe renovar el token tras el 401');
});

test('obtenerPdf decodifica JSON+base64 a Buffer %PDF', async () => {
  const pdfBytes = Buffer.from('%PDF-1.4\n...contenido...');
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/token')) {
      return jsonResponse({ access_token: fakeJwt(Date.now() / 1000 + 3600), token_type: 'bearer', refresh_token: 'r' });
    }
    if (url.includes('/pdf')) {
      return jsonResponse({ file_name: 'e-Ticket A0000881.pdf', mime_type: 'application/pdf', format: 'base64', data: pdfBytes.toString('base64') });
    }
    throw new Error(`URL inesperada: ${url}`);
  };
  const provider = new FeuProvider({ username: 'u', password: 'p', fetchImpl });
  const pdf = await provider.obtenerPdf('218617380010', 539072, 'ticket80');
  assert.equal(pdf.mimeType, 'application/pdf');
  assert.equal(pdf.buffer.subarray(0, 4).toString('latin1'), '%PDF');
});

test('consultarEstado detecta estado final AE', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/token')) {
      return jsonResponse({ access_token: fakeJwt(Date.now() / 1000 + 3600), token_type: 'bearer', refresh_token: 'r' });
    }
    if (url.includes('/consulta/comprobantes/emitidos')) {
      // El estado real vive en el listado por fecha; se busca por id.
      return jsonResponse([
        { id: 111, serie: 'A', numero: 1, estado_dgi: { codigo: 'NE' } },
        { id: 539072, serie: 'A', numero: 878, estado_dgi: { codigo: 'AE', descripcion: 'Aceptado' } },
      ]);
    }
    throw new Error(`URL inesperada: ${url}`);
  };
  const provider = new FeuProvider({ username: 'u', password: 'p', fetchImpl });
  const estado = await provider.consultarEstado('218617380010', 539072, '2026-09-04');
  assert.equal(estado.codigo, 'AE');
  assert.equal(estado.esFinal, true);
  assert.equal(estado.numero, 878);
});
