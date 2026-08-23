import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getLanding, publishLanding, saveLanding, unpublishLanding } from '../lib/api';
import type { LandingConfig } from '../lib/api';
import { LandingPreview } from './LandingPreview';

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

  function update<K extends keyof LandingConfig>(section: K, partial: Partial<LandingConfig[K]>) {
    setConfig((c) => (c ? { ...c, [section]: { ...c[section], ...partial } } : c));
    setDirty(true);
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
        <code className="miweb__url">{publicPath}</code>
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
            <label className="field">Imagen de fondo (URL)<input value={config.hero.imagenUrl} onChange={(e) => update('hero', { imagenUrl: e.target.value })} placeholder="https://…" /></label>
            <label className="field field--row">Color de la marca
              <input type="color" value={config.tema.color} onChange={(e) => update('tema', { color: e.target.value })} />
            </label>
          </section>

          {/* Productos */}
          <section className="miweb-sec" data-id="productos">
            <SectionHead label="Productos / ofertas" on={config.productos.mostrar} onToggle={(v) => update('productos', { mostrar: v })} />
            <label className="field">Título de la sección<input value={config.productos.titulo} onChange={(e) => update('productos', { titulo: e.target.value })} /></label>
            <div className="miweb-items">
              {config.productos.items.map((it, i) => (
                <div className="miweb-item" key={i}>
                  <input placeholder="Producto" value={it.nombre} onChange={(e) => {
                    const items = config.productos.items.slice(); items[i] = { ...items[i], nombre: e.target.value }; update('productos', { items });
                  }} />
                  <input placeholder="$/kg" value={it.precio} onChange={(e) => {
                    const items = config.productos.items.slice(); items[i] = { ...items[i], precio: e.target.value }; update('productos', { items });
                  }} />
                  <button className="btn btn--sm btn--ghost" onClick={() => update('productos', { items: config.productos.items.filter((_, x) => x !== i) })}>✕</button>
                </div>
              ))}
            </div>
            <button className="btn btn--ghost btn--sm" onClick={() => update('productos', { items: [...config.productos.items, { nombre: '', precio: '', imagenUrl: '' }] })}>+ Agregar producto</button>
          </section>

          {/* Horarios y ubicación */}
          <section className="miweb-sec" data-id="horarios">
            <SectionHead label="Horarios y ubicación" on={config.horarios.mostrar} onToggle={(v) => update('horarios', { mostrar: v })} />
            <label className="field">Horarios<input value={config.horarios.texto} onChange={(e) => update('horarios', { texto: e.target.value })} placeholder="Lun a Sáb 8:00–20:00" /></label>
            <label className="field">Dirección<input value={config.horarios.direccion} onChange={(e) => update('horarios', { direccion: e.target.value })} /></label>
            <label className="field">Link del mapa (Google Maps)<input value={config.horarios.mapaUrl} onChange={(e) => update('horarios', { mapaUrl: e.target.value })} placeholder="https://maps.google.com/…" /></label>
          </section>

          {/* Contacto */}
          <section className="miweb-sec" data-id="contacto">
            <SectionHead label="Contacto y redes" on={config.contacto.mostrar} onToggle={(v) => update('contacto', { mostrar: v })} />
            <label className="field">WhatsApp<input value={config.contacto.whatsapp} onChange={(e) => update('contacto', { whatsapp: e.target.value })} placeholder="099 123 456" /></label>
            <label className="field">Teléfono<input value={config.contacto.telefono} onChange={(e) => update('contacto', { telefono: e.target.value })} /></label>
            <label className="field">Instagram (URL)<input value={config.contacto.instagram} onChange={(e) => update('contacto', { instagram: e.target.value })} /></label>
            <label className="field">Facebook (URL)<input value={config.contacto.facebook} onChange={(e) => update('contacto', { facebook: e.target.value })} /></label>
          </section>
          <p className="hint">Los cambios se ven en la vista previa al instante. “Guardar” deja el borrador; “Publicar” lo pone online.</p>
        </div>

        <div className="miweb__preview">
          <LandingPreview config={config} />
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
