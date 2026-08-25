import { useEffect, useMemo, useRef, useState } from 'react';
import type { Product } from '../lib/api';

interface Props {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

/**
 * Buscador de productos en tiempo real (typeahead): a medida que se escribe el
 * nombre (o PLU) van apareciendo los resultados. Reemplaza al <select> largo.
 */
export function ProductSearchSelect({ products, value, onChange, placeholder = 'Buscar producto…' }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = products.find((p) => p.id === value) ?? null;

  const results = useMemo(() => {
    const t = query.trim().toLowerCase();
    const base = t
      ? products.filter((p) => p.nombre.toLowerCase().includes(t) || String(p.plu ?? '').includes(t))
      : products;
    return base.slice(0, 8);
  }, [products, query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pick(p: Product) {
    onChange(p.id);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="psearch" ref={wrapRef}>
      <input
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
      {open && (
        <ul className="psearch__list">
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
      )}
    </div>
  );
}
