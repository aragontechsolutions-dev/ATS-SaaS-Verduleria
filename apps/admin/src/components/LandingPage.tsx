import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getLanding, getProducts, getStock, publishLanding, saveLanding, unpublishLanding } from '../lib/api';
import type { LandingConfig, LandingProducto, Product, StockRow } from '../lib/api';
import { formatUyPhone, osmEmbedUrl, tieneUbicacion } from '../lib/mapPhone';
import { ImageUpload } from './ImageUpload';
import { LandingPreview } from './LandingPreview';

const UNIDAD_CORTA: Record<string, string> = {
  KG: 'kg', GRAMO: 'g', UNIDAD: 'un', ATADO: 'atado', DOCENA: 'docena', BANDEJA: 'bandeja',
  CAJON: 'cajón', BOLSA: 'bolsa', BIN: 'bin', BULTO: 'bulto',
};

/** Precio de mostrador con la unidad corta: `$120 /kg`. '' si no hay precio. */
function formatPrecio(precio: number, unidad: string): string {
  if (!precio || precio <= 0) return '';
  const monto = precio.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `$${monto} /${UNIDAD_CORTA[unidad] ?? unidad.toLowerCase()}`;
}

/** Producto del catálogo con su stock/precio actual, para el selector de la web. */
interface CatalogoItem {
  id: string;
  nombre: string;
  unidadVenta: string;
  imagenUrl: string;
  cantidad: number;
  precio: number;
}

type SectionId = 'portada' | 'productos' | 'horarios' | 'contacto';
const SECTIONS: Array<{ id: SectionId; label: string; icon: string }> = [
  { id: 'portada', label: 'Portada', icon: '🏷️' },
  { id: 'productos', label: 'Productos', icon: '🥬' },
  { id: 'horarios', label: 'Horarios y ubicación', icon: '📍' },
  { id: 'contacto', label: 'Contacto y redes', icon: '💬' },
];

export function LandingPage() {
  const [config, setConfig] = useState<LandingConfig | null>(null);
  const [slug, setSlug] = useState('');
  const [publicado, setPublicado] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [active, setActive] = useState<SectionId>('portada');
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const l = await getLanding();
        setConfig(l.draft);
        setSlug(l.slug);
        setPublicado(l.estaPublicado);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar');
      }
    })();
  }, []);

  // Catálogo con stock/precio para elegir qué productos mostrar en la web.
  useEffect(() => {
    void (async () => {
      try {
        const [products, stock] = await Promise.all([getProducts(), getStock()]);
        const stockBy = new Map<string, StockRow>(stock.map((s) => [s.productId, s]));
        const items: CatalogoItem[] = products
          .filter((p: Product) => p.activo)
          .map((p: Product) => {
            const s = stockBy.get(p.id);
            return {
              id: p.id,
              nombre: p.nombre,
              unidadVenta: p.unidadVenta,
              imagenUrl: p.imagenUrl ?? '',
              cantidad: s ? s.cantidad : 0,
              precio: s ? s.precio : p.precio,
            };
          })
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        setCatalogo(items);
      } catch {
        /* si falla, el selector queda vacío con su aviso */
      }
    })();
  }, []);

  const flash = useCallback((m: string) => {
    setOkMsg(m);
    window.setTimeout(() => setOkMsg(null), 2500);
  }, []);

  // Scrollspy: marca la sección visible en el menú.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !config) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (vis[0]) setActive(vis[0].target.getAttribute('data-id') as SectionId);
      },
      { root, rootMargin: '-20% 0px -60% 0px', threshold: [0.1, 0.5, 1] },
    );
    root.querySelectorAll('[data-id]').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [config]);

  const [geoLoading, setGeoLoading] = useState(false);

  function update<K extends keyof LandingConfig>(section: K, partial: Partial<LandingConfig[K]>) {
    setConfig((c) => (c ? { ...c, [section]: { ...c[section], ...partial } } : c));
    setDirty(true);
  }

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      setError('Tu navegador no permite ubicación. Ingresá las coordenadas a mano.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update('horarios', {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setGeoLoading(false);
      },
      () => {
        setError('No pudimos obtener tu ubicación. Revisá los permisos o ingresá las coordenadas a mano.');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function goTo(id: SectionId) {
    scrollRef.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function guardar() {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const r = await saveLanding(config);
      setConfig(r.draft);
      setDirty(false);
      flash('Borrador guardado');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function publicar() {
    if (!config) return;
    setSaving(true);
    try {
      if (dirty) await saveLanding(config);
      await publishLanding();
      setPublicado(true);
      setDirty(false);
      flash('¡Tu web está publicada!');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo publicar');
    } finally {
      setSaving(false);
    }
  }

  async function despublicar() {
    await unpublishLanding().catch((e) => setError(String(e)));
    setPublicado(false);
    flash('Web despublicada');
  }

  const publicPath = useMemo(() => `/v/${slug}`, [slug]);
  // URL pública completa: usa VITE_WEB_URL si está; si no, el mismo origen.
  const publicUrl = useMemo(() => {
    const base = (import.meta.env.VITE_WEB_URL ?? window.location.origin).replace(/\/+$/, '');
    return slug ? `${base}${publicPath}` : '';
  }, [slug, publicPath]);
  const [copiado, setCopiado] = useState(false);

  async function copiarUrl() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      // Fallback para navegadores viejos / sin permiso de portapapeles.
      const ta = document.createElement('textarea');
      ta.value = publicUrl;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1800);
  }

  // Productos elegidos (por id) → items resueltos con foto/precio actuales.
  // La web solo publica los que tienen stock; acá mostramos igual para avisar.
  const catById = useMemo(() => new Map(catalogo.map((c) => [c.id, c])), [catalogo]);
  const seleccion = config?.productos.productIds ?? [];
  const previewItems: LandingProducto[] = useMemo(
    () =>
      seleccion
        .map((id) => catById.get(id))
        .filter((c): c is CatalogoItem => !!c && c.cantidad > 0)
        .map((c) => ({ nombre: c.nombre, precio: formatPrecio(c.precio, c.unidadVenta), imagenUrl: c.imagenUrl })),
    [seleccion, catById],
  );
  const previewConfig: LandingConfig | null = useMemo(
    () => (config ? { ...config, productos: { ...config.productos, items: previewItems } } : null),
    [config, previewItems],
  );

  function toggleProducto(id: string) {
    if (!config) return;
    const cur = config.productos.productIds;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    update('productos', { productIds: next });
  }

  if (!config) {
    return (
      <>
        {error && <div className="banner banner--err">{error}</div>}
        {!error && <p className="muted">Cargando…</p>}
      </>
    );
  }

  return (
    <>
      {error && <div className="banner banner--err">{error}</div>}
      {okMsg && <div className="banner banner--ok">{okMsg}</div>}

      <div className="miweb__bar">
        <button className="btn btn--ghost btn--sm miweb__navtoggle" onClick={() => setNavOpen((o) => !o)} title="Secciones">
          ☰
        </button>
        <span className={`pill ${publicado ? 'mrg mrg--ok' : ''}`}>{publicado ? 'Publicada' : 'Borrador'}</span>
        <div className="miweb__link" title={publicUrl || publicPath}>
          <a className="miweb__url" href={publicUrl || publicPath} target="_blank" rel="noreferrer">{publicUrl || publicPath}</a>
          <button className="btn btn--ghost btn--sm miweb__copy" onClick={copiarUrl} disabled={!publicUrl} title="Copiar enlace">
            {copiado ? '✓ Copiado' : '📋 Copiar'}
          </button>
        </div>
        <div className="miweb__bar-right">
          <button className="btn btn--ghost btn--sm miweb__previewtoggle" onClick={() => setShowPreview((p) => !p)}>
            {showPreview ? 'Editar' : 'Vista previa'}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={guardar} disabled={saving || !dirty}>
            {saving ? '…' : 'Guardar'}
          </button>
          {publicado ? (
            <button className="btn btn--ghost btn--sm" onClick={despublicar} disabled={saving}>Despublicar</button>
          ) : null}
          <button className="btn btn--primary btn--sm" onClick={publicar} disabled={saving}>Publicar</button>
        </div>
      </div>

      <div className={`miweb ${showPreview ? 'miweb--preview' : ''}`}>
        <nav className={`miweb__nav ${navOpen ? '' : 'miweb__nav--closed'}`}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`miweb__navitem ${active === s.id ? 'is-active' : ''}`}
              onClick={() => goTo(s.id)}
            >
              <span>{s.icon}</span>
              {navOpen && <span>{s.label}</span>}
            </button>
          ))}
        </nav>

        <div className="miweb__editor" ref={scrollRef}>
          {/* Portada */}
          <section className="miweb-sec" data-id="portada">
            <SectionHead label="Portada" on={config.hero.mostrar} onToggle={(v) => update('hero', { mostrar: v })} />
            <label className="field">Nombre / título<input value={config.hero.titulo} onChange={(e) => update('hero', { titulo: e.target.value })} /></label>
            <label className="field">Lema<input value={config.hero.lema} onChange={(e) => update('hero', { lema: e.target.value })} placeholder="Lo más fresco del barrio" /></label>
            <div className="field">
              <span>Imagen de fondo</span>
              <ImageUpload value={config.hero.imagenUrl} onChange={(u) => update('hero', { imagenUrl: u })} hint="Horizontal, se ve mejor." />
            </div>
            <label className="field field--row">Color de la marca
              <input type="color" value={config.tema.color} onChange={(e) => update('tema', { color: e.target.value })} />
            </label>
          </section>

          {/* Productos — elegidos del catálogo, con su stock y foto */}
          <section className="miweb-sec" data-id="productos">
            <SectionHead label="Productos / ofertas" on={config.productos.mostrar} onToggle={(v) => update('productos', { mostrar: v })} />
            <label className="field">Título de la sección<input value={config.productos.titulo} onChange={(e) => update('productos', { titulo: e.target.value })} /></label>
            <p className="hint">Elegí de tu catálogo qué mostrar en la web. Se usa la foto y el precio que cargaste en cada producto. <strong>Sin stock no se publican.</strong></p>
            {catalogo.length === 0 ? (
              <p className="lp-empty">No hay productos todavía. Cargalos en <strong>Productos</strong> y volvé acá.</p>
            ) : (
              <div className="miweb-pick">
                {catalogo.map((c) => {
                  const sel = config.productos.productIds.includes(c.id);
                  const sinStock = c.cantidad <= 0;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      className={`miweb-pick__card ${sel ? 'is-sel' : ''} ${sinStock ? 'is-off' : ''}`}
                      onClick={() => toggleProducto(c.id)}
                      title={sinStock ? 'Sin stock: no se va a publicar hasta que cargues stock' : undefined}
                    >
                      <span className="miweb-pick__img" style={c.imagenUrl ? { backgroundImage: `url(${c.imagenUrl})` } : undefined}>
                        {!c.imagenUrl && <span className="miweb-pick__ph">🥬</span>}
                        {sel && <span className="miweb-pick__check">✓</span>}
                      </span>
                      <span className="miweb-pick__name">{c.nombre}</span>
                      <span className="miweb-pick__meta">
                        {formatPrecio(c.precio, c.unidadVenta) || 'sin precio'}
                        {sinStock ? <em className="miweb-pick__off"> · sin stock</em> : <span className="miweb-pick__stk"> · {c.cantidad} {UNIDAD_CORTA[c.unidadVenta] ?? ''}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {seleccion.length > 0 && previewItems.length === 0 && (
              <p className="hint hint--warn">Los productos elegidos no tienen stock: no se mostrarán hasta que cargues stock.</p>
            )}
          </section>

          {/* Horarios y ubicación */}
          <section className="miweb-sec" data-id="horarios">
            <SectionHead label="Horarios y ubicación" on={config.horarios.mostrar} onToggle={(v) => update('horarios', { mostrar: v })} />
            <label className="field">Horarios<input value={config.horarios.texto} onChange={(e) => update('horarios', { texto: e.target.value })} placeholder="Lun a Sáb 8:00–20:00" /></label>
            <label className="field">Dirección<input value={config.horarios.direccion} onChange={(e) => update('horarios', { direccion: e.target.value })} /></label>

            <div className="miweb-ubic">
              <div className="miweb-ubic__head">
                <span>Ubicación en el mapa</span>
                <button className="btn btn--sm btn--ghost" type="button" onClick={usarMiUbicacion} disabled={geoLoading}>
                  {geoLoading ? 'Ubicando…' : '📍 Usar mi ubicación'}
                </button>
              </div>
              <div className="row2">
                <label className="field">Latitud<input type="number" step="0.000001" value={config.horarios.lat || ''} onChange={(e) => update('horarios', { lat: parseFloat(e.target.value) || 0 })} placeholder="-34.9011" /></label>
                <label className="field">Longitud<input type="number" step="0.000001" value={config.horarios.lng || ''} onChange={(e) => update('horarios', { lng: parseFloat(e.target.value) || 0 })} placeholder="-56.1645" /></label>
              </div>
              {tieneUbicacion(config.horarios.lat, config.horarios.lng) ? (
                <>
                  <iframe className="miweb-map" title="Mapa" src={osmEmbedUrl(config.horarios.lat, config.horarios.lng)} loading="lazy" />
                  <button className="btn btn--sm btn--ghost" type="button" onClick={() => update('horarios', { lat: 0, lng: 0 })}>Quitar ubicación</button>
                </>
              ) : (
                <p className="hint">Tocá “Usar mi ubicación” estando en el local, o pegá las coordenadas. Se muestra un mapa en tu web.</p>
              )}
            </div>
          </section>

          {/* Contacto */}
          <section className="miweb-sec" data-id="contacto">
            <SectionHead label="Contacto y redes" on={config.contacto.mostrar} onToggle={(v) => update('contacto', { mostrar: v })} />
            <label className="field">WhatsApp<input value={config.contacto.whatsapp} onChange={(e) => update('contacto', { whatsapp: e.target.value })} onBlur={(e) => update('contacto', { whatsapp: formatUyPhone(e.target.value) })} placeholder="099 123 456" /></label>
            <label className="field">Teléfono<input value={config.contacto.telefono} onChange={(e) => update('contacto', { telefono: e.target.value })} onBlur={(e) => update('contacto', { telefono: formatUyPhone(e.target.value) })} placeholder="099 123 456" /></label>
            <label className="field">Instagram (URL)<input value={config.contacto.instagram} onChange={(e) => update('contacto', { instagram: e.target.value })} /></label>
            <label className="field">Facebook (URL)<input value={config.contacto.facebook} onChange={(e) => update('contacto', { facebook: e.target.value })} /></label>
          </section>
          <p className="hint">Los cambios se ven en la vista previa al instante. “Guardar” deja el borrador; “Publicar” lo pone online.</p>
        </div>

        <div className="miweb__preview">
          <LandingPreview config={previewConfig ?? config} />
        </div>
      </div>
    </>
  );
}

function SectionHead({ label, on, onToggle }: { label: string; on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="miweb-sechead">
      <h2>{label}</h2>
      <label className="chk"><input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} /> Mostrar</label>
    </div>
  );
}
