import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createZone,
  deleteZone,
  getProducts,
  getStoreConfig,
  saveStoreConfig,
  setVisibleOnline,
  telegramLink,
  telegramTest,
  telegramUnlink,
  updateZone,
} from '../lib/api';
import type { Product, StoreConfig, StoreZone } from '../lib/api';
import { Spinner } from './Skeleton';
import { useToast } from '../lib/toast';

const WEB_URL = import.meta.env.VITE_WEB_URL ?? '';

export function TiendaPage() {
  const toast = useToast();
  const [cfg, setCfg] = useState<StoreConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Config editable.
  const [deliveryActivo, setDeliveryActivo] = useState(true);
  const [pickupActivo, setPickupActivo] = useState(true);
  const [franjas, setFranjas] = useState<string[]>([]);
  const [notaCheckout, setNotaCheckout] = useState('');

  function hydrate(c: StoreConfig) {
    setCfg(c);
    setDeliveryActivo(c.deliveryActivo);
    setPickupActivo(c.pickupActivo);
    setFranjas(c.franjas.length ? c.franjas : ['']);
    setNotaCheckout(c.notaCheckout);
  }

  useEffect(() => {
    getStoreConfig()
      .then(hydrate)
      .catch((e) => { const m = e instanceof Error ? e.message : String(e); setError(m); toast.error(m); });
  }, [toast]);

  async function guardarConfig() {
    setSaving(true);
    try {
      const c = await saveStoreConfig({
        deliveryActivo,
        pickupActivo,
        franjas: franjas.map((f) => f.trim()).filter(Boolean),
        notaCheckout: notaCheckout.trim(),
      });
      hydrate(c);
      toast.success('Tienda actualizada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  if (!cfg && !error) return <p className="loading-row"><Spinner /> Cargando tienda…</p>;
  if (!cfg) return <div className="banner banner--err">{error}</div>;

  const publicUrl = WEB_URL && cfg.slug ? `${WEB_URL}/v/${cfg.slug}/tienda` : '';

  return (
    <div>
      {!cfg.tiendaOnlineActiva && (
        <div className="banner banner--warn">
          La tienda online está <strong>desactivada</strong>. Activala en <strong>Configuración → Tienda online</strong> para
          que tus clientes puedan verla.
        </div>
      )}

      <section className="panel">
        <div className="panel__head"><h2>Tienda online</h2></div>
        {publicUrl && (
          <p className="hint">
            Dirección pública: <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>
          </p>
        )}
        <p className="hint">
          Elegí abajo qué productos se muestran en tu tienda. También podés marcarlos uno a uno desde <strong>Productos</strong>.
        </p>
      </section>

      <ProductosTiendaPanel />

      <section className="panel">
        <div className="panel__head"><h2>Formas de entrega</h2></div>
        <label className="field field--check">
          <input type="checkbox" checked={deliveryActivo} onChange={(e) => setDeliveryActivo(e.target.checked)} />
          Envío a domicilio (con zonas de reparto)
        </label>
        <label className="field field--check">
          <input type="checkbox" checked={pickupActivo} onChange={(e) => setPickupActivo(e.target.checked)} />
          Retiro en el local (pickup)
        </label>

        <div className="panel__head" style={{ marginTop: 16 }}><h3>Franjas horarias</h3></div>
        <p className="hint">El cliente elige una franja al hacer el pedido. Ej.: “Lun a Vie 16–19h”, “Sáb 9–13h”.</p>
        {franjas.map((f, i) => (
          <div className="row-inline" key={i}>
            <input
              value={f}
              onChange={(e) => setFranjas(franjas.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder="Ej.: Lun a Vie 16–19h"
            />
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFranjas(franjas.filter((_, j) => j !== i))}>
              Quitar
            </button>
          </div>
        ))}
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFranjas([...franjas, ''])}>
          + Agregar franja
        </button>

        <label className="field" style={{ marginTop: 16 }}>
          Nota en el checkout (opcional)
          <textarea value={notaCheckout} onChange={(e) => setNotaCheckout(e.target.value)} rows={2} placeholder="Ej.: Los pedidos se reparten el mismo día si entran antes de las 15h." />
        </label>

        <div className="modal__actions" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn--primary" onClick={() => void guardarConfig()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </section>

      <TelegramPanel cfg={cfg} onChange={setCfg} />

      <ZonesPanel zonas={cfg.zonas} onChange={setCfg} />
    </div>
  );
}

function ProductosTiendaPanel() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setProducts(await getProducts());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron cargar los productos');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t
      ? products.filter((p) => p.nombre.toLowerCase().includes(t) || String(p.plu ?? '').includes(t))
      : products;
  }, [products, q]);

  const totalVisibles = products.filter((p) => p.visibleOnline).length;

  // Actualiza en bloque con UI optimista y revierte si falla el guardado.
  async function aplicar(ids: string[], visible: boolean) {
    if (!ids.length) return;
    setBusy(true);
    const previo = products;
    const set = new Set(ids);
    setProducts(previo.map((p) => (set.has(p.id) ? { ...p, visibleOnline: visible } : p)));
    try {
      const { actualizados } = await setVisibleOnline(ids, visible);
      toast.success(`${actualizados} producto${actualizados === 1 ? '' : 's'} ${visible ? 'en la tienda' : 'ocultos'}`);
    } catch (e) {
      setProducts(previo);
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setBusy(false);
    }
  }

  const idsFiltro = filtered.map((p) => p.id);
  const ocultosEnFiltro = filtered.filter((p) => !p.visibleOnline).map((p) => p.id);
  const visiblesEnFiltro = filtered.filter((p) => p.visibleOnline).map((p) => p.id);
  const hayFiltro = q.trim().length > 0;

  return (
    <section className="panel">
      <div className="panel__head"><h2>Productos en la tienda</h2></div>
      <p className="hint">
        Marcá los productos que querés mostrar en tu tienda online. Ahora mismo hay <strong>{totalVisibles}</strong> de {products.length} publicado{totalVisibles === 1 ? '' : 's'}.
      </p>

      <div className="row-inline" style={{ flexWrap: 'wrap', gap: 8 }}>
        <input className="search" placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <button className="btn btn--sm btn--primary" disabled={busy || !ocultosEnFiltro.length} onClick={() => void aplicar(ocultosEnFiltro, true)}>
          🛒 Mostrar {hayFiltro ? `los ${idsFiltro.length} del filtro` : 'todos'}
        </button>
        <button className="btn btn--sm btn--ghost" disabled={busy || !visiblesEnFiltro.length} onClick={() => void aplicar(visiblesEnFiltro, false)}>
          Ocultar {hayFiltro ? 'los del filtro' : 'todos'}
        </button>
      </div>

      {loading ? (
        <p className="loading-row"><Spinner /> Cargando productos…</p>
      ) : filtered.length === 0 ? (
        <p className="hint">Sin productos{hayFiltro ? ' para esa búsqueda' : ''}.</p>
      ) : (
        <ul className="storeprods">
          {filtered.map((p) => (
            <li key={p.id} className={`storeprods__row ${p.visibleOnline ? 'is-on' : ''}`}>
              <label className="storeprods__lbl">
                <input
                  type="checkbox"
                  checked={p.visibleOnline}
                  disabled={busy}
                  onChange={() => void aplicar([p.id], !p.visibleOnline)}
                />
                <span className="storeprods__name">{p.nombre}</span>
                {p.plu != null && <span className="muted"> · PLU {p.plu}</span>}
              </label>
              {p.visibleOnline && <span className="storeprods__badge">En tienda</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TelegramPanel({ cfg, onChange }: { cfg: StoreConfig; onChange: (c: StoreConfig) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function refrescar() {
    try { onChange(await getStoreConfig()); } catch { /* noop */ }
  }

  async function vincular() {
    setBusy(true);
    try {
      const { deepLink } = await telegramLink();
      window.open(deepLink, '_blank', 'noopener');
      toast.info('Abrí el chat con el bot y tocá "Iniciar / Start". Después tocá "Actualizar estado".');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el enlace');
    } finally {
      setBusy(false);
    }
  }

  async function probar() {
    try { await telegramTest(); toast.success('Mensaje de prueba enviado'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo enviar'); }
  }

  async function desvincular() {
    if (!confirm('¿Desvincular Telegram? Dejarás de recibir avisos de pedidos.')) return;
    try { onChange(await telegramUnlink().then(() => getStoreConfig())); toast.success('Telegram desvinculado'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo desvincular'); }
  }

  return (
    <section className="panel">
      <div className="panel__head"><h2>Avisos por Telegram</h2></div>
      {!cfg.telegram.disponible ? (
        <p className="hint">Las notificaciones por Telegram no están habilitadas en el sistema. Pedile al soporte de Aragon Tech Solutions que active el bot.</p>
      ) : cfg.telegram.vinculado ? (
        <>
          <p className="hint">✅ <strong>Telegram vinculado.</strong> Te avisamos por ahí cada vez que entre un pedido nuevo.</p>
          <div className="modal__actions" style={{ justifyContent: 'flex-start' }}>
            <button className="btn btn--ghost btn--sm" onClick={() => void probar()}>Enviar prueba</button>
            <button className="btn btn--ghost btn--sm" onClick={() => void desvincular()}>Desvincular</button>
          </div>
        </>
      ) : (
        <>
          <p className="hint">Recibí un aviso en tu celular apenas entra un pedido. Tocá <strong>Vincular</strong>, abrí el chat con el bot, tocá <strong>Iniciar</strong> y volvé acá.</p>
          <div className="modal__actions" style={{ justifyContent: 'flex-start' }}>
            <button className="btn btn--primary btn--sm" onClick={() => void vincular()} disabled={busy}>Vincular Telegram</button>
            <button className="btn btn--ghost btn--sm" onClick={() => void refrescar()}>Actualizar estado</button>
          </div>
        </>
      )}
    </section>
  );
}

function ZonesPanel({ zonas, onChange }: { zonas: StoreZone[]; onChange: (c: StoreConfig) => void }) {
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [costoEnvio, setCostoEnvio] = useState('');
  const [pedidoMinimo, setPedidoMinimo] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!nombre.trim()) return;
    setBusy(true);
    try {
      const c = await createZone({
        nombre: nombre.trim(),
        costoEnvio: Number(costoEnvio.replace(',', '.')) || 0,
        pedidoMinimo: Number(pedidoMinimo.replace(',', '.')) || 0,
      });
      onChange(c);
      setNombre(''); setCostoEnvio(''); setPedidoMinimo('');
      toast.success('Zona agregada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo agregar');
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, data: Parameters<typeof updateZone>[1]) {
    try {
      onChange(await updateZone(id, data));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar');
    }
  }

  async function quitar(z: StoreZone) {
    if (!confirm(`¿Eliminar la zona "${z.nombre}"?`)) return;
    try {
      onChange(await deleteZone(z.id));
      toast.success('Zona eliminada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  }

  return (
    <section className="panel">
      <div className="panel__head"><h2>Zonas de reparto</h2></div>
      <p className="hint">Cada zona tiene su costo de envío y (opcional) un pedido mínimo.</p>

      {zonas.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Zona</th><th>Envío ($)</th><th>Mínimo ($)</th><th>Activa</th><th></th></tr>
            </thead>
            <tbody>
              {zonas.map((z) => (
                <tr key={z.id} className={z.activo ? '' : 'is-muted'}>
                  <td>{z.nombre}</td>
                  <td>
                    <input
                      className="cell-input"
                      type="number" min={0} step="1" defaultValue={z.costoEnvio}
                      onBlur={(e) => { const v = Number(e.target.value); if (v !== z.costoEnvio) void patch(z.id, { costoEnvio: v }); }}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      type="number" min={0} step="1" defaultValue={z.pedidoMinimo}
                      onBlur={(e) => { const v = Number(e.target.value); if (v !== z.pedidoMinimo) void patch(z.id, { pedidoMinimo: v }); }}
                    />
                  </td>
                  <td>
                    <input type="checkbox" checked={z.activo} onChange={(e) => void patch(z.id, { activo: e.target.checked })} />
                  </td>
                  <td><button className="btn btn--ghost btn--sm" onClick={() => void quitar(z)}>Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="row-inline" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la zona (ej. Centro)" />
        <input type="number" min={0} step="1" value={costoEnvio} onChange={(e) => setCostoEnvio(e.target.value)} placeholder="Envío $" style={{ maxWidth: 120 }} />
        <input type="number" min={0} step="1" value={pedidoMinimo} onChange={(e) => setPedidoMinimo(e.target.value)} placeholder="Mínimo $" style={{ maxWidth: 120 }} />
        <button className="btn btn--primary btn--sm" onClick={() => void add()} disabled={busy || !nombre.trim()}>+ Agregar zona</button>
      </div>
    </section>
  );
}
