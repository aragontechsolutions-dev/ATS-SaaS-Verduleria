import { useMemo, useState } from 'react';
import type { CatalogProduct } from '../lib/types';
import { formatMoney, TASA_LABEL } from '../lib/format';
import { hayStock } from './ProductGrid';

interface Props {
  products: CatalogProduct[];
  /** Producto fijado por un escaneo (desde App). */
  product: CatalogProduct | null;
  onSelect: (p: CatalogProduct | null) => void;
  onClose: () => void;
}

/**
 * Verificador de precio: consulta un producto (por nombre / PLU / código o
 * escaneando) SIN agregarlo al carrito. Pensado para responder «¿cuánto sale?».
 */
export function PriceCheckModal({ products, product, onSelect, onClose }: Props) {
  const [q, setQ] = useState('');

  const resultados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return products
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(term) ||
          String(p.plu ?? '').includes(term) ||
          (p.codigoBarras?.toLowerCase().includes(term) ?? false),
      )
      .slice(0, 12);
  }, [products, q]);

  return (
    <div className="modal-backdrop">
      <div className="modal modal--wide">
        <div className="modal__head">
          <h3>Consultar precio</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Cerrar</button>
        </div>

        {product ? (
          <PriceCard product={product} onOtra={() => { onSelect(null); setQ(''); }} />
        ) : (
          <>
            <p className="modal__sub">Escaneá un producto o buscalo por nombre, PLU o código. No se agrega al carrito.</p>
            <label className="field">
              Producto
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre, PLU o código…"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && resultados[0]) onSelect(resultados[0]); }}
              />
            </label>
            <div className="pc-list">
              {q.trim() && resultados.length === 0 && <p className="empty">Sin resultados.</p>}
              {resultados.map((p) => (
                <button key={p.id} className="pc-row" onClick={() => onSelect(p)}>
                  <span className="pc-row__name">{p.nombre}</span>
                  <span className="pc-row__price">{formatMoney(p.precio)}<small>/{p.unidadVenta.toLowerCase()}</small></span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PriceCard({ product: p, onOtra }: { product: CatalogProduct; onOtra: () => void }) {
  const unidad = p.unidadVenta.toLowerCase();
  const disponible = hayStock(p);
  return (
    <div className="pc-card">
      <div className="pc-card__name">{p.nombre}</div>
      <div className="pc-card__price">
        {formatMoney(p.precio)}<span className="pc-card__unit">/{unidad}</span>
      </div>
      <div className="pc-card__meta">
        <span className="pill pill--muted">{TASA_LABEL[p.ivaIndicador] ?? p.ivaIndicador}</span>
        {p.plu != null && <span className="pill pill--muted">PLU {p.plu}</span>}
        {p.codigoBarras && <span className="pill pill--muted">{p.codigoBarras}</span>}
        {p.stock != null ? (
          <span className={`pill ${disponible ? 'pill--ok' : 'pill--warn'}`}>
            {disponible ? `Stock: ${p.stock} ${unidad}` : 'Sin stock'}
          </span>
        ) : null}
      </div>
      <button className="btn btn--primary" onClick={onOtra}>Otra consulta</button>
    </div>
  );
}
