import { useMemo, useState } from 'react';
import type { CatalogProduct } from '../lib/types';
import { formatMoney } from '../lib/format';

interface Props {
  products: CatalogProduct[];
  onPick: (p: CatalogProduct) => void;
}

export function ProductGrid({ products, onPick }: Props) {
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
      return p.nombre.toLowerCase().includes(term) || String(p.plu ?? '').includes(term);
    });
  }, [products, q, cat]);

  return (
    <section className="grid-panel">
      <input
        className="search"
        placeholder="Buscar por nombre o PLU…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
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
        {filtered.map((p) => (
          <button key={p.id} className="tile" onClick={() => onPick(p)}>
            <span className="tile__name">{p.nombre}</span>
            <span className="tile__price">
              {formatMoney(p.precio)}
              <small>/{p.unidadVenta.toLowerCase()}</small>
            </span>
            {p.esPesable && <span className="tile__badge">⚖ pesable</span>}
          </button>
        ))}
        {filtered.length === 0 && <p className="empty">Sin productos.</p>}
      </div>
    </section>
  );
}
