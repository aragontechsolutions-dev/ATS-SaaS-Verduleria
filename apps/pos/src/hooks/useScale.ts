import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SCALE_CONFIG,
  loadScaleConfig,
  parseScaleFrame,
  saveScaleConfig,
} from '../lib/scale';
import type { ScaleConfig, ScaleReading } from '../lib/scale';

// Tipos mínimos de la Web Serial API (evita sumar una dependencia de tipos).
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
}
interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
}

export interface ScaleState {
  config: ScaleConfig;
  setConfig: (cfg: ScaleConfig) => void;
  /** ¿El navegador soporta Web Serial? (para el modo serial). */
  serialSupported: boolean;
  connected: boolean;
  reading: ScaleReading | null;
  error: string | null;
  /** ¿Hay una balanza en vivo activa (serial o network)? */
  live: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

/**
 * Gestiona la balanza en vivo del POS: lee el flujo de peso por puerto serie
 * (Web Serial) o por un puente WebSocket (network), según la config del
 * dispositivo. En modos manual/barcode no hace nada (la balanza no habla con
 * el POS). Ver lib/scale.ts.
 */
export function useScale(): ScaleState {
  const [config, setConfigState] = useState<ScaleConfig>(() => loadScaleConfig());
  const [connected, setConnected] = useState(false);
  const [reading, setReading] = useState<ScaleReading | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serialSupported = typeof navigator !== 'undefined' && 'serial' in navigator;
  const live = config.mode === 'serial' || config.mode === 'network';

  // Referencias para poder cerrar la conexión al desconectar.
  const stopRef = useRef<(() => Promise<void>) | null>(null);

  const setConfig = useCallback((cfg: ScaleConfig) => {
    setConfigState(cfg);
    saveScaleConfig(cfg);
  }, []);

  const disconnect = useCallback(async () => {
    const stop = stopRef.current;
    stopRef.current = null;
    setConnected(false);
    setReading(null);
    if (stop) await stop().catch(() => undefined);
  }, []);

  const connectSerial = useCallback(async () => {
    const nav = navigator as Navigator & { serial?: SerialLike };
    if (!nav.serial) throw new Error('Este navegador no soporta Web Serial (usá Chrome/Edge).');
    const port = await nav.serial.requestPort();
    await port.open({ baudRate: config.baudRate });

    let cancelled = false;
    const decoder = new TextDecoderStream();
    const piped = port.readable
      ?.pipeTo(decoder.writable as unknown as WritableStream<Uint8Array>)
      .catch(() => undefined);
    const reader = decoder.readable.getReader();

    stopRef.current = async () => {
      cancelled = true;
      await reader.cancel().catch(() => undefined);
      await piped;
      await port.close().catch(() => undefined);
    };

    let buffer = '';
    void (async () => {
      try {
        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const r = parseScaleFrame(line, config.protocol);
            if (r) setReading(r);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error leyendo la balanza');
      }
    })();
  }, [config.baudRate, config.protocol]);

  const connectNetwork = useCallback(async () => {
    if (!config.networkUrl) throw new Error('Falta la URL del puente de la balanza.');
    const ws = new WebSocket(config.networkUrl);
    ws.onmessage = (ev) => {
      const r = parseScaleFrame(String(ev.data), config.protocol);
      if (r) setReading(r);
    };
    ws.onerror = () => setError('No se pudo conectar al puente de la balanza.');
    stopRef.current = async () => ws.close();
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      window.setTimeout(() => reject(new Error('Timeout conectando al puente.')), 5000);
    });
  }, [config.networkUrl, config.protocol]);

  const connect = useCallback(async () => {
    setError(null);
    try {
      await disconnect();
      if (config.mode === 'serial') await connectSerial();
      else if (config.mode === 'network') await connectNetwork();
      else return;
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo conectar la balanza');
      setConnected(false);
    }
  }, [config.mode, connectSerial, connectNetwork, disconnect]);

  // Al desmontar, cerrar la conexión.
  useEffect(() => {
    return () => {
      void stopRef.current?.().catch(() => undefined);
    };
  }, []);

  return { config, setConfig, serialSupported, connected, reading, error, live, connect, disconnect };
}

export { DEFAULT_SCALE_CONFIG };
