// ============================================================================
// Impresora térmica: driver ESC/POS por WebUSB o Web Serial (Chrome/Edge
// escritorio) + apertura de cajón. Config por dispositivo (localStorage).
//
// Si el modo es 'browser' (o no hay impresora conectada), se cae a la impresión
// HTML del navegador (lib/boleta.ts), que ya existía. Así ESC/POS es opt-in y
// nada se rompe si no hay hardware.
// ============================================================================

import type { OutboxSale } from './types';
import type { Corte } from './api';
import type { LabelData } from './etiqueta';
import { buildCorte, buildLabel, buildReceipt, drawerKick } from './escpos';
import { printBoleta } from './boleta';
import { printCorteBrowser } from './corte';
import { printEtiquetaBrowser } from './etiqueta';

export type PrinterMode = 'browser' | 'usb' | 'serial';

export interface PrinterConfig {
  mode: PrinterMode;
  /** Ancho del papel: 58mm (32 caracteres) u 80mm (48). */
  width: 58 | 80;
  /** Abrir el cajón al imprimir una venta con efectivo. */
  openDrawer: boolean;
  baudRate: number;
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  mode: 'browser',
  width: 80,
  openDrawer: false,
  baudRate: 9600,
};

const KEY = 'ats.pos.printer';

export function loadPrinterConfig(): PrinterConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PRINTER_CONFIG };
    return { ...DEFAULT_PRINTER_CONFIG, ...(JSON.parse(raw) as Partial<PrinterConfig>) };
  } catch {
    return { ...DEFAULT_PRINTER_CONFIG };
  }
}

export function savePrinterConfig(cfg: PrinterConfig): void {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* no crítico */ }
}

export const widthChars = (w: 58 | 80): number => (w === 58 ? 32 : 48);

// --- Tipos mínimos WebUSB / Web Serial (sin sumar dependencias) -------------
interface UsbEndpoint { direction: 'in' | 'out'; endpointNumber: number; }
interface UsbAlternate { endpoints: UsbEndpoint[]; }
interface UsbInterface { interfaceNumber: number; alternate: UsbAlternate; }
interface UsbConfiguration { interfaces: UsbInterface[]; }
interface UsbDeviceLike {
  configuration: UsbConfiguration | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  transferOut(endpoint: number, data: Uint8Array): Promise<unknown>;
}
interface UsbLike {
  requestDevice(opts: { filters: unknown[] }): Promise<UsbDeviceLike>;
  getDevices(): Promise<UsbDeviceLike[]>;
}
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
}
interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
}

const usbApi = (): UsbLike | undefined => (navigator as Navigator & { usb?: UsbLike }).usb;
const serialApi = (): SerialLike | undefined => (navigator as Navigator & { serial?: SerialLike }).serial;

export const usbSupported = (): boolean => !!usbApi();
export const serialSupported = (): boolean => !!serialApi();

// --- Estado del driver ------------------------------------------------------
let usbDevice: UsbDeviceLike | null = null;
let usbOutEndpoint = 0;
let serialPort: SerialPortLike | null = null;

export function isConnected(mode: PrinterMode): boolean {
  if (mode === 'usb') return !!usbDevice;
  if (mode === 'serial') return !!serialPort;
  return false;
}

/** Descubre el endpoint OUT de la impresora y reclama su interfaz. */
async function setupUsb(device: UsbDeviceLike): Promise<void> {
  await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);
  const ifaces = device.configuration?.interfaces ?? [];
  for (const iface of ifaces) {
    const out = iface.alternate.endpoints.find((e) => e.direction === 'out');
    if (out) {
      await device.claimInterface(iface.interfaceNumber);
      usbOutEndpoint = out.endpointNumber;
      usbDevice = device;
      return;
    }
  }
  await device.close();
  throw new Error('La impresora no expone un endpoint de salida USB.');
}

export async function connectUsb(): Promise<void> {
  const usb = usbApi();
  if (!usb) throw new Error('Este navegador no soporta WebUSB (usá Chrome/Edge de escritorio).');
  const device = await usb.requestDevice({ filters: [] });
  await setupUsb(device);
}

export async function connectSerial(baudRate: number): Promise<void> {
  const serial = serialApi();
  if (!serial) throw new Error('Este navegador no soporta Web Serial (usá Chrome/Edge de escritorio).');
  const port = await serial.requestPort();
  await port.open({ baudRate });
  serialPort = port;
}

/** Intenta reconectar a un dispositivo ya autorizado antes (sin pedir permiso). */
export async function tryReconnect(cfg: PrinterConfig): Promise<boolean> {
  try {
    if (cfg.mode === 'usb' && usbApi() && !usbDevice) {
      const [device] = await usbApi()!.getDevices();
      if (device) { await setupUsb(device); return true; }
    }
    if (cfg.mode === 'serial' && serialApi() && !serialPort) {
      const [port] = await serialApi()!.getPorts();
      if (port) { await port.open({ baudRate: cfg.baudRate }); serialPort = port; return true; }
    }
  } catch { /* sin dispositivo recordado */ }
  return isConnected(cfg.mode);
}

export async function disconnect(): Promise<void> {
  try { if (serialPort) await serialPort.close(); } catch { /* noop */ }
  try { if (usbDevice) await usbDevice.close(); } catch { /* noop */ }
  serialPort = null;
  usbDevice = null;
}

async function sendBytes(mode: PrinterMode, bytes: Uint8Array): Promise<void> {
  if (mode === 'usb') {
    if (!usbDevice) throw new Error('Impresora USB no conectada');
    await usbDevice.transferOut(usbOutEndpoint, bytes);
    return;
  }
  if (mode === 'serial') {
    if (!serialPort?.writable) throw new Error('Impresora serie no conectada');
    const writer = serialPort.writable.getWriter();
    try { await writer.write(bytes); } finally { writer.releaseLock(); }
    return;
  }
  throw new Error('Modo de impresora sin conexión directa');
}

/** Abre el cajón de dinero (kick). Requiere impresora ESC/POS conectada. */
export async function openDrawer(cfg: PrinterConfig): Promise<void> {
  if (cfg.mode === 'browser') throw new Error('Configurá una impresora ESC/POS para abrir el cajón.');
  await sendBytes(cfg.mode, drawerKick());
}

/** Imprime una prueba. */
export async function printTest(cfg: PrinterConfig): Promise<void> {
  const enc = new TextEncoder();
  const bytes = enc.encode('\x1b@ATS SISGESVER\nPrueba de impresion OK\n\n\n\x1dV\x01');
  await sendBytes(cfg.mode, bytes);
}

/**
 * Imprime la boleta de una venta. Con impresora ESC/POS conectada envía los
 * bytes; si no, cae a la impresión del navegador. No abre el cajón (eso ocurre
 * una vez al cobrar en efectivo, no en cada reimpresión).
 */
export async function printSale(sale: OutboxSale, cfg: PrinterConfig): Promise<void> {
  if (cfg.mode !== 'browser' && isConnected(cfg.mode)) {
    try {
      await sendBytes(cfg.mode, buildReceipt(sale, { width: widthChars(cfg.width), openDrawer: false }));
      return;
    } catch {
      // Falló el envío ESC/POS: caemos a la impresión del navegador.
    }
  }
  printBoleta(sale);
}

/**
 * Imprime un corte de caja X/Z. Con impresora ESC/POS conectada envía los bytes;
 * si no, cae a la impresión del navegador (80mm).
 */
export async function printCorte(corte: Corte, cfg: PrinterConfig): Promise<void> {
  if (cfg.mode !== 'browser' && isConnected(cfg.mode)) {
    try {
      await sendBytes(cfg.mode, buildCorte(corte, { width: widthChars(cfg.width) }));
      return;
    } catch {
      // Falló el envío ESC/POS: caemos a la impresión del navegador.
    }
  }
  printCorteBrowser(corte);
}

/**
 * Imprime una etiqueta de balanza (peso/precio + EAN-13). Con impresora ESC/POS
 * conectada imprime el código por hardware; si no, cae a la impresión del
 * navegador (SVG). Devuelve false solo si la impresión del navegador fue bloqueada.
 */
export async function printLabel(label: LabelData, cfg: PrinterConfig): Promise<boolean> {
  if (cfg.mode !== 'browser' && isConnected(cfg.mode)) {
    try {
      await sendBytes(cfg.mode, buildLabel(label, { width: widthChars(cfg.width) }));
      return true;
    } catch {
      // Falló el envío ESC/POS: caemos a la impresión del navegador.
    }
  }
  return printEtiquetaBrowser(label);
}

/** Abre el cajón tras una venta en efectivo, si está configurado y conectado. */
export async function maybeOpenDrawer(sale: OutboxSale, cfg: PrinterConfig): Promise<void> {
  if (!cfg.openDrawer || cfg.mode === 'browser' || !isConnected(cfg.mode)) return;
  if (!sale.payments.some((p) => p.medio === 'EFECTIVO')) return;
  try { await openDrawer(cfg); } catch { /* best-effort */ }
}
