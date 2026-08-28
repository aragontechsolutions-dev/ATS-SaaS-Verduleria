import { useMemo, useState, type RefObject } from 'react';
import type { CatalogProduct } from '../lib/types';
import { formatMoney } from '../lib/format';

interface Props {
  products: CatalogProduct[];
  onPick: (p: CatalogProduct) => void;
  /** Ref al input de búsqueda, para enfocarlo con un atajo (F2 / «/»). */
  searchRef?: RefObject<HTMLInputElement>;
  /** Tecleá «3*» o «3x» en el buscador para fijar el multiplicador de cantidad. */
  onMultiplier?: (n: number) => void;
}

/** ¿Hay stock para vender? null = producto sin stock controlado → se vende libre. */
export function hayStock(p: CatalogProduct): boolean {
  return p.stock == null || p.stock > 0;
}

export function ProductGrid({ products, onPick, searchRef, onMultiplier }: Props) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);

  const categorias = useMemo(() => {
    const set = new Map<string, string>();
    for (const p of products) if (p.categoriaId) set.set(p.categoriaId, p.categoriaNombre ?? '—');
    return [...set.entries()];
  }, [products]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter((p) => {
      if (cat && p.categoriaId !== cat) return false;
      if (!term) return true;
      return (
        p.nombre.toLowerCase().includes(term) ||
        String(p.plu ?? '').includes(term) ||
        (p.codigoBarras?.toLowerCase().includes(term) ?? false)
      );
    });
  }, [products, q, cat]);

  return (
    <section className="grid-panel">
      <input
        ref={searchRef}
        className="search"
        placeholder="Buscar por nombre, PLU o código… (F2)"
        value={q}
        onChange={(e) => {
          const v = e.target.value;
          // «3*» o «3x» fija el multiplicador de cantidad y limpia el buscador.
          const m = v.match(/^(\d+)\s*[*xX]$/);
          if (m && onMultiplier) {
            onMultiplier(parseInt(m[1], 10));
            setQ('');
            return;
          }
          setQ(v);
        }}
        onKeyDown={(e) => {
          // Enter agrega el primer resultado disponible (venta rápida por teclado).
          if (e.key === 'Enter') {
            const first = filtered.find((p) => hayStock(p));
            if (first) {
              onPick(first);
              setQ('');
            }
          }
        }}
        autoFocus
      />
      <div className="chips">
        <button className={`chip ${cat === null ? 'chip--on' : ''}`} onClick={() => setCat(null)}>
          Todos
        </button>
        {categorias.map(([id, nombre]) => (
          <button key={id} className={`chip ${cat === id ? 'chip--on' : ''}`} onClick={() => setCat(id)}>
            {nombre}
          </button>
        ))}
      </div>
      <div className="grid">
        {filtered.map((p) => {
          const disponible = hayStock(p);
          const unidad = p.unidadVenta.toLowerCase();
          return (
            <button
              key={p.id}
              className={`pcard ${disponible ? '' : 'pcard--off'}`}
              onClick={() => disponible && onPick(p)}
              disabled={!disponible}
              title={disponible ? p.nombre : `${p.nombre} — sin stock`}
            >
              <span
                className="pcard__img"
                style={p.imagenUrl ? { backgroundImage: `url(${p.imagenUrl})` } : undefined}
              >
                {!p.imagenUrl && <span className="pcard__ph">🥬</span>}
                {p.esPesable && <span className="pcard__badge">⚖</span>}
                {!disponible && <span className="pcard__out">Sin stock</span>}
              </span>
              <span className="pcard__body">
                <span className="pcard__name">{p.nombre}</span>
                <span className="pcard__price">
                  {formatMoney(p.precio)}<small>/{unidad}</small>
                </span>
                {p.stock != null && disponible && (
                  <span className="pcard__stock">{p.stock} {unidad}</span>
                )}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && <p className="empty">Sin productos.</p>}
      </div>
    </section>
  );
}
