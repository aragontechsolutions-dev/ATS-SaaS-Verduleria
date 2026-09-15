import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { CatalogProduct } from '../lib/types';
import { formatMoney } from '../lib/format';

/** Productos por página: mantiene la grilla liviana aunque el catálogo tenga cientos. */
const POR_PAGINA = 12;

interface Props {
  products: CatalogProduct[];
  onPick: (p: CatalogProduct) => void;
  /** Ref al input de búsqueda, para enfocarlo con un atajo (F2 / «/»). */
  searchRef?: RefObject<HTMLInputElement>;
  /** Tecleá «3*» o «3x» en el buscador para fijar el multiplicador de cantidad. */
  onMultiplier?: (n: number) => void;
  /** Modo mayorista: productId → precio NETO. Si está, las tarjetas muestran
   *  el precio mayorista (neto, sin IVA) en vez del de mostrador. */
  preciosNetos?: Record<string, number> | null;
}

/** ¿Hay stock para vender? null = producto sin stock controlado → se vende libre. */
export function hayStock(p: CatalogProduct): boolean {
  return p.stock == null || p.stock > 0;
}

export function ProductGrid({ products, onPick, searchRef, onMultiplier, preciosNetos }: Props) {
  const mayorista = !!preciosNetos;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [page, setPage] = useState(0);

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

  // Al cambiar el filtro (o achicarse la lista), volvemos a la primera página.
  const totalPaginas = Math.max(1, Math.ceil(filtered.length / POR_PAGINA));
  useEffect(() => { setPage(0); }, [q, cat]);
  useEffect(() => { if (page > totalPaginas - 1) setPage(totalPaginas - 1); }, [page, totalPaginas]);

  const visibles = filtered.slice(page * POR_PAGINA, page * POR_PAGINA + POR_PAGINA);

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
        {visibles.map((p) => {
          const disponible = hayStock(p);
          const unidad = p.unidadVenta.toLowerCase();
          const precioMostrar = mayorista ? (preciosNetos![p.id] ?? p.precio) : p.precio;
          return (
            <button
              key={p.id}
              className={`pcard ${disponible ? '' : 'pcard--off'} ${mayorista ? 'pcard--may' : ''}`}
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
                {mayorista && <span className="pcard__may">may.</span>}
                {!disponible && <span className="pcard__out">Sin stock</span>}
              </span>
              <span className="pcard__body">
                <span className="pcard__name">{p.nombre}</span>
                <span className="pcard__price">
                  {formatMoney(precioMostrar)}<small>/{unidad}{mayorista ? ' + IVA' : ''}</small>
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

      {filtered.length > POR_PAGINA && (
        <div className="pager">
          <button className="pager__btn" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>‹ Anterior</button>
          <span className="pager__info">
            {page * POR_PAGINA + 1}–{Math.min(filtered.length, (page + 1) * POR_PAGINA)} de {filtered.length}
          </span>
          <button className="pager__btn" onClick={() => setPage((p) => Math.min(totalPaginas - 1, p + 1))} disabled={page >= totalPaginas - 1}>Siguiente ›</button>
        </div>
      )}
    </section>
  );
}
