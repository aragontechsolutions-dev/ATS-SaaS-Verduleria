import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Product } from '../lib/api';

interface Props {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

interface Pos {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

/**
 * Buscador de productos en tiempo real (typeahead): a medida que se escribe el
 * nombre (o PLU) van apareciendo los resultados. Reemplaza al <select> largo.
 *
 * La lista se renderiza en un portal con position: fixed anclado al input. Así
 * nunca la recorta el contenedor con overflow (la tabla de compras tiene
 * overflow-x: auto), que antes escondía los resultados en el móvil y obligaba a
 * desplazar la barra lateral para verlos.
 */
export function ProductSearchSelect({ products, value, onChange, placeholder = 'Buscar producto…' }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState<Pos | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = products.find((p) => p.id === value) ?? null;

  const results = useMemo(() => {
    const t = query.trim().toLowerCase();
    const base = t
      ? products.filter((p) => p.nombre.toLowerCase().includes(t) || String(p.plu ?? '').includes(t))
      : products;
    return base.slice(0, 20);
  }, [products, query]);

  // Calcula la posición del desplegable respecto del input (coords de viewport,
  // porque la lista va fija en el body). Si no hay lugar abajo, abre hacia arriba.
  const recalc = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    const espacioAbajo = window.innerHeight - r.bottom - margin;
    const espacioArriba = r.top - margin;
    const abreArriba = espacioAbajo < 200 && espacioArriba > espacioAbajo;
    const maxHeight = Math.max(140, Math.min(320, abreArriba ? espacioArriba : espacioAbajo));
    const width = Math.max(r.width, 240);
    // No dejar que se salga por la derecha en pantallas angostas.
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const top = abreArriba ? r.top - 4 - maxHeight : r.bottom + 4;
    setPos({ top, left, width, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    recalc();
    const onScroll = () => recalc();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, recalc, results.length]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pick(p: Product) {
    onChange(p.id);
    setQuery('');
    setOpen(false);
  }

  const lista = open && pos && (
    <ul
      ref={listRef}
      className="psearch__list"
      style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
    >
      {results.length === 0 && <li className="psearch__empty">Sin resultados</li>}
      {results.map((p, i) => (
        <li
          key={p.id}
          className={`psearch__item ${i === hi ? 'is-hi' : ''} ${p.id === value ? 'is-sel' : ''}`}
          onMouseEnter={() => setHi(i)}
          onMouseDown={(e) => { e.preventDefault(); pick(p); }}
        >
          <span className="psearch__name">{p.nombre}</span>
          {p.plu != null && <span className="psearch__plu">PLU {p.plu}</span>}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="psearch" ref={wrapRef}>
      <input
        ref={inputRef}
        className="psearch__input"
        value={open ? query : selected?.nombre ?? ''}
        placeholder={selected ? selected.nombre : placeholder}
        onFocus={() => { setOpen(true); setQuery(''); setHi(0); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHi(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, results.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter') { if (open && results[hi]) { e.preventDefault(); pick(results[hi]); } }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {lista && createPortal(lista, document.body)}
    </div>
  );
}
