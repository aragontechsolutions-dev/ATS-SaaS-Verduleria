import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getStock,
  getSugerido,
  getSuppliers,
  registrarCompra,
  type StockProduct,
  type SugeridoGrupo,
  type Supplier,
} from '../lib/api';

const money = (n: number) => '$' + n.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const num = (s: string) => parseFloat(s.replace(',', '.')) || 0;

/** Borrador de compra de un producto (lo que el comprador va cargando). */
interface Draft {
  comprado: boolean;
  cantidad: string; // en unidad de compra (cajones/bolsas)
  precio: string; // costo por unidad de compra
}

/** Producto agregado manualmente (fuera del sugerido). */
interface Extra {
  p: StockProduct;
  cantidad: string;
  precio: string;
}

type Toast = { tipo: 'ok' | 'err'; msg: string } | null;

export function Comprador({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [grupos, setGrupos] = useState<SugeridoGrupo[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stock, setStock] = useState<StockProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [supplierSel, setSupplierSel] = useState<Record<string, string>>({}); // por grupo "Sin proveedor"
  const [enviando, setEnviando] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  // --- Agregar producto (fuera del sugerido) ---
  const [addOpen, setAddOpen] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [extras, setExtras] = useState<Record<string, Extra>>({});
  const [extraSupplier, setExtraSupplier] = useState('');
  const [enviandoExtras, setEnviandoExtras] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [g, s, st] = await Promise.all([getSugerido(4), getSuppliers(), getStock()]);
      setGrupos(g);
      setSuppliers(s.filter((x) => x.activo));
      setStock(st);
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Error';
      if (m === 'SESION_EXPIRADA') return;
      setError(m);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function draftDe(g: SugeridoGrupo, productId: string): Draft {
    const d = drafts[productId];
    if (d) return d;
    const it = g.items.find((x) => x.productId === productId)!;
    return { comprado: false, cantidad: String(it.sugeridoCompra || 1), precio: it.costoUnit ? String(it.costoUnit) : '' };
  }
  function setDraft(productId: string, patch: Partial<Draft>, base: Draft) {
    setDrafts((prev) => ({ ...prev, [productId]: { ...base, ...prev[productId], ...patch } }));
  }

  function totalGrupo(g: SugeridoGrupo): { items: number; total: number } {
    let items = 0;
    let total = 0;
    for (const it of g.items) {
      const d = drafts[it.productId];
      if (d?.comprado) {
        items++;
        total += num(d.cantidad) * num(d.precio);
      }
    }
    return { items, total };
  }

  async function registrar(g: SugeridoGrupo) {
    const items = g.items
      .map((it) => ({ it, d: drafts[it.productId] }))
      .filter(({ d }) => d?.comprado && num(d.cantidad) > 0)
      .map(({ it, d }) => ({ productId: it.productId, cantidadCompra: num(d!.cantidad), costoUnitCompra: num(d!.precio) }));
    if (items.length === 0) {
      setToast({ tipo: 'err', msg: 'Marcá al menos un producto comprado.' });
      return;
    }
    const supplierId = g.proveedorId ?? (supplierSel[grupoKey(g)] || undefined);
    setEnviando(grupoKey(g));
    try {
      const r = await registrarCompra({ supplierId, notas: 'Compra UAM (app comprador)', items });
      setToast({ tipo: 'ok', msg: `Compra registrada · ${money(r.total)}` });
      // Limpia los drafts de este grupo y refresca el sugerido.
      setDrafts((prev) => {
        const n = { ...prev };
        for (const it of g.items) delete n[it.productId];
        return n;
      });
      await cargar();
      setAbierto(null);
    } catch (e) {
      setToast({ tipo: 'err', msg: e instanceof Error ? e.message : 'No se pudo registrar' });
    } finally {
      setEnviando(null);
    }
  }

  const totalGeneral = useMemo(
    () => (grupos ?? []).reduce((s, g) => s + g.totalEstimado, 0),
    [grupos],
  );

  // --- Agregar producto: búsqueda y carrito manual ---
  const resultados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (q.length < 1) return [];
    return stock
      .filter((p) => !extras[p.productId] && p.nombre.toLowerCase().includes(q))
      .slice(0, 25);
  }, [buscar, stock, extras]);

  function agregarExtra(p: StockProduct) {
    setExtras((prev) => ({
      ...prev,
      [p.productId]: { p, cantidad: '1', precio: p.costoPromedio ? String(Number(p.costoPromedio.toFixed(2))) : '' },
    }));
    setBuscar('');
  }
  function setExtra(productId: string, patch: Partial<Extra>) {
    setExtras((prev) => (prev[productId] ? { ...prev, [productId]: { ...prev[productId], ...patch } } : prev));
  }
  function quitarExtra(productId: string) {
    setExtras((prev) => {
      const n = { ...prev };
      delete n[productId];
      return n;
    });
  }

  const extrasList = useMemo(() => Object.values(extras), [extras]);
  const totalExtras = useMemo(
    () => extrasList.reduce((s, e) => s + num(e.cantidad) * num(e.precio), 0),
    [extrasList],
  );

  async function registrarExtras() {
    const items = extrasList
      .filter((e) => num(e.cantidad) > 0)
      .map((e) => ({ productId: e.p.productId, cantidadCompra: num(e.cantidad), costoUnitCompra: num(e.precio) }));
    if (items.length === 0) {
      setToast({ tipo: 'err', msg: 'Agregá al menos un producto con cantidad.' });
      return;
    }
    setEnviandoExtras(true);
    try {
      const r = await registrarCompra({
        supplierId: extraSupplier || undefined,
        notas: 'Compra UAM (app comprador)',
        items,
      });
      setToast({ tipo: 'ok', msg: `Compra registrada · ${money(r.total)}` });
      setExtras({});
      setExtraSupplier('');
      await cargar();
    } catch (e) {
      setToast({ tipo: 'err', msg: e instanceof Error ? e.message : 'No se pudo registrar' });
    } finally {
      setEnviandoExtras(false);
    }
  }

  return (
    <div className="app">
      <header className="top">
        <div className="top__brand"><img src="/icon.svg" alt="" className="top__logo" /> Compras · UAM</div>
        <div className="top__right">
          <button className="ic" onClick={() => void cargar()} title="Actualizar" aria-label="Actualizar">↻</button>
          <button className="ic" onClick={onLogout} title="Salir" aria-label="Salir">⎋</button>
        </div>
      </header>

      {toast && <div className={`toast toast--${toast.tipo}`}>{toast.msg}</div>}

      <main className="wrap">
        {error && <div className="banner banner--err">{error}</div>}

        {/* Agregar producto fuera del sugerido */}
        <section className={`grupo grupo--add ${addOpen ? 'is-open' : ''}`}>
          <button className="grupo__head" onClick={() => setAddOpen((v) => !v)}>
            <div>
              <strong>➕ Agregar producto</strong>
              <span className="grupo__sub">
                {extrasList.length > 0 ? `${extrasList.length} en la lista · ${money(totalExtras)}` : 'Comprá algo que no está en el sugerido'}
              </span>
            </div>
            <span className="grupo__chevron">{addOpen ? '▲' : '▼'}</span>
          </button>

          {addOpen && (
            <div className="grupo__body">
              <div className="buscar">
                <input
                  type="search"
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                  placeholder="Buscar producto por nombre…"
                  autoComplete="off"
                />
                {resultados.length > 0 && (
                  <ul className="buscar__res">
                    {resultados.map((p) => (
                      <li key={p.productId}>
                        <button onClick={() => agregarExtra(p)}>
                          <span className="buscar__nom">{p.nombre}</span>
                          <span className="buscar__meta">
                            {p.categoriaNombre ? `${p.categoriaNombre} · ` : ''}stock {p.cantidad} {corta(p.unidadVenta)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {buscar.trim().length >= 1 && resultados.length === 0 && (
                  <p className="buscar__vacio">Sin coincidencias.</p>
                )}
              </div>

              {extrasList.length > 0 && (
                <>
                  {extrasList.map((e) => (
                    <div className="item is-on" key={e.p.productId}>
                      <div className="item__head">
                        <span className="item__name">{e.p.nombre}</span>
                        <button className="item__x" onClick={() => quitarExtra(e.p.productId)} aria-label="Quitar">✕</button>
                      </div>
                      <div className="item__buy">
                        <label>Cant. ({corta(e.p.unidadCompra)})
                          <input type="number" inputMode="decimal" value={e.cantidad} onChange={(ev) => setExtra(e.p.productId, { cantidad: ev.target.value })} onFocus={(ev) => ev.currentTarget.select()} />
                        </label>
                        <label>Precio / {corta(e.p.unidadCompra)}
                          <input type="number" inputMode="decimal" value={e.precio} onChange={(ev) => setExtra(e.p.productId, { precio: ev.target.value })} onFocus={(ev) => ev.currentTarget.select()} placeholder="0" />
                        </label>
                        <span className="item__sub">= {money(num(e.cantidad) * num(e.precio))}</span>
                      </div>
                    </div>
                  ))}

                  <label className="field field--sm">
                    Proveedor (opcional)
                    <select value={extraSupplier} onChange={(e) => setExtraSupplier(e.target.value)}>
                      <option value="">Sin proveedor</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nombre}{s.esUam ? ' (UAM)' : ''}</option>)}
                    </select>
                  </label>

                  <div className="grupo__foot">
                    <span>{extrasList.length} para comprar · <strong>{money(totalExtras)}</strong></span>
                    <button className="btn btn--primary" disabled={enviandoExtras || totalExtras <= 0} onClick={() => void registrarExtras()}>
                      {enviandoExtras ? 'Registrando…' : 'Registrar compra'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {!grupos ? (
          <div className="center"><span className="spinner" /></div>
        ) : grupos.length === 0 ? (
          <div className="empty">
            <div className="empty__ico">✅</div>
            <p>No hay nada para reponer según el stock y las ventas. Podés agregar productos con el botón de arriba.</p>
            <button className="btn btn--ghost" onClick={() => void cargar()}>Actualizar</button>
          </div>
        ) : (
          <>
            <p className="resumen">Sugerido de reposición · estimado <strong>{money(totalGeneral)}</strong></p>
            {grupos.map((g) => {
              const key = grupoKey(g);
              const open = abierto === key;
              const tg = totalGrupo(g);
              return (
                <section className={`grupo ${open ? 'is-open' : ''}`} key={key}>
                  <button className="grupo__head" onClick={() => setAbierto(open ? null : key)}>
                    <div>
                      <strong>{g.proveedorNombre}</strong>
                      <span className="grupo__sub">{g.items.length} producto{g.items.length === 1 ? '' : 's'} · est. {money(g.totalEstimado)}</span>
                    </div>
                    <span className="grupo__chevron">{open ? '▲' : '▼'}</span>
                  </button>

                  {open && (
                    <div className="grupo__body">
                      {g.proveedorId === null && (
                        <label className="field field--sm">
                          Asignar proveedor (opcional)
                          <select value={supplierSel[key] ?? ''} onChange={(e) => setSupplierSel((s) => ({ ...s, [key]: e.target.value }))}>
                            <option value="">Sin proveedor</option>
                            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nombre}{s.esUam ? ' (UAM)' : ''}</option>)}
                          </select>
                        </label>
                      )}

                      {g.items.map((it) => {
                        const d = draftDe(g, it.productId);
                        return (
                          <div className={`item ${d.comprado ? 'is-on' : ''}`} key={it.productId}>
                            <div className="item__head">
                              <label className="item__check">
                                <input type="checkbox" checked={d.comprado} onChange={(e) => setDraft(it.productId, { comprado: e.target.checked }, d)} />
                                <span className="item__name">{it.nombre}</span>
                              </label>
                              {it.quiebre ? <span className="tag tag--red">Sin stock</span> : it.bajoMinimo ? <span className="tag tag--warn">Bajo mínimo</span> : null}
                            </div>
                            <div className="item__info">
                              Stock: {it.stockActual} {corta(it.unidadVenta)}
                              {it.diasCobertura != null && <> · cobertura {it.diasCobertura}d</>}
                              {' · '}sugerido <strong>{it.sugeridoCompra} {corta(it.unidadCompra)}</strong>
                            </div>
                            {d.comprado && (
                              <div className="item__buy">
                                <label>Cant. ({corta(it.unidadCompra)})
                                  <input type="number" inputMode="decimal" value={d.cantidad} onChange={(e) => setDraft(it.productId, { cantidad: e.target.value }, d)} onFocus={(e) => e.currentTarget.select()} />
                                </label>
                                <label>Precio / {corta(it.unidadCompra)}
                                  <input type="number" inputMode="decimal" value={d.precio} onChange={(e) => setDraft(it.productId, { precio: e.target.value }, d)} onFocus={(e) => e.currentTarget.select()} placeholder="0" />
                                </label>
                                <span className="item__sub">= {money(num(d.cantidad) * num(d.precio))}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="grupo__foot">
                        <span>{tg.items} para comprar · <strong>{money(tg.total)}</strong></span>
                        <button className="btn btn--primary" disabled={enviando === key || tg.items === 0} onClick={() => void registrar(g)}>
                          {enviando === key ? 'Registrando…' : 'Registrar compra'}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </>
        )}
        <p className="foot">Sesión: {email}</p>
      </main>
    </div>
  );
}

function grupoKey(g: SugeridoGrupo): string {
  return g.proveedorId ?? 'sin';
}

const CORTA: Record<string, string> = {
  KG: 'kg', GRAMO: 'g', UNIDAD: 'un', ATADO: 'atado', DOCENA: 'doc', BANDEJA: 'band',
  CAJON: 'cajón', BOLSA: 'bolsa', BIN: 'bin', BULTO: 'bulto',
};
function corta(u: string): string {
  return CORTA[u] ?? u.toLowerCase();
}
