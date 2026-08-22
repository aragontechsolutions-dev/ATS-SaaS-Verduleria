import { useEffect, useRef } from 'react';

/**
 * Escucha un lector de código de barras (que emula un teclado): acumula
 * dígitos que llegan muy rápido y se confirman con Enter. Ignora la escritura
 * humana normal (más lenta) y los campos de texto enfocados.
 */
export function useScanner(onScan: (code: string) => void, opts: { maxGapMs?: number } = {}): void {
  const buffer = useRef('');
  const lastTime = useRef(0);
  const maxGap = opts.maxGapMs ?? 40;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      // No interferir si el usuario escribe en un input/textarea.
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const now = Date.now();
      if (now - lastTime.current > maxGap) buffer.current = '';
      lastTime.current = now;

      if (e.key === 'Enter') {
        const code = buffer.current;
        buffer.current = '';
        if (code.length >= 6) onScan(code);
        return;
      }
      if (/^\d$/.test(e.key)) buffer.current += e.key;
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onScan, maxGap]);
}
